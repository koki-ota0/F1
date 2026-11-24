import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { predictRaceWithAI, aiStatus } from './ai.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')

const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'))

const teams = read('teams.json')
const drivers = read('drivers.json')
const calendar = read('calendar.json')
const champions = read('champions.json')
const records = read('records.json')
const trivia = read('trivia.json')
const news = read('news.json')
const season = read('season.json')
const POSTS_FILE = path.join(DATA_DIR, 'posts.json')

// ---------- community posts (fan SNS) ----------
function loadPosts() {
  const inMem = postCache.get('list')
  if (inMem?.data) return inMem.data
  const list = read('posts.json')
  postCache.set('list', { at: Date.now(), data: list })
  return list
}
const postCache = new Map()
function savePosts(list) {
  postCache.set('list', { at: Date.now(), data: list })
  try { fs.writeFileSync(POSTS_FILE, JSON.stringify(list, null, 2)) } catch { /* ignore */ }
}

const teamById = Object.fromEntries(teams.map((t) => [t.id, t]))
const driverById = Object.fromEntries(drivers.map((d) => [d.id, d]))

// ---------- snapshot (written by scripts/update-data.mjs) ----------
const SNAPSHOT_FILE = path.join(DATA_DIR, 'snapshot.json')
let snapshotCache = null
function readSnapshot() {
  if (snapshotCache) return snapshotCache
  try { snapshotCache = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')) } catch { snapshotCache = null }
  return snapshotCache
}
function snapshotFresh(snap) {
  return snap && snap.updatedAt && Date.now() - new Date(snap.updatedAt).getTime() < 7 * 86400000
}

// ---------- outbound fetch helpers (best-effort, short timeout) ----------
const cache = new Map()
async function fetchJSON(url, ttlMs = 30_000, timeoutMs = 6000) {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < ttlMs) return hit.data
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'pitwall-f1-hub/0.1' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    cache.set(url, { at: Date.now(), data })
    return data
  } catch (e) {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchText(url, timeoutMs = 6000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'pitwall-f1-hub/0.1' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// minimal RSS/Atom XML -> items
function parseFeed(xml, limit = 12) {
  const items = []
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || []
  for (const b of blocks.slice(0, limit)) {
    const pick = (tag) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
      if (!m) return ''
      return m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').trim()
    }
    items.push({
      title: pick('title'),
      link: pick('link'),
      date: pick('pubDate') || pick('published') || pick('updated')
    })
  }
  return items
}

// ---------- live / historical sources ----------
// Multi-source providers. Jolpica remains the historical source; OpenF1 is the
// primary for anything session-scoped (calendar media, lineups, live timing).
// Every provider is tried in order and a total outage degrades honestly.
const OPENF1 = process.env.PITWALL_OPENF1_BASE || 'https://api.openf1.org/v1'
const JOLPICA = process.env.PITWALL_F1_BASE || 'https://api.jolpica.org/f1'
const providerHealth = new Map()

function rowsOf(d) { return Array.isArray(d) ? d : d?.results ?? [] }

async function getCalendar(year) {
  const y = Number(year) || season.current
  const mapJolpica = (rows) => rows.map((r) => ({
    round: r.round,
    name: r.race_name,
    nameJa: r.race_name,
    circuit: r.circuit?.circuit_name ?? r.circuit_name ?? '',
    circuitJa: r.circuit?.circuit_name ?? r.circuit_name ?? '',
    country: r.country?.country_name ?? r.country_name ?? '',
    countryJa: r.country?.country_name ?? r.country_name ?? '',
    flag: '',
    date: (r.date ?? '').slice(0, 10) || null,
    laps: r.laps_total ?? null,
    lengthKm: null, turns: null, drsZones: null, lapRecord: null
  }))
  // 1) Jolpica historical calendar (rich per-round metadata)
  for (const sy of [y, y - 1]) {
    const data = await fetchJSON(`${JOLPICA}/${sy}/races/?limit=100`, 120_000)
    const rows = rowsOf(data)
    if (rows.length) {
      providerHealth.set('jolpica', { ok: true, at: Date.now() })
      return { source: 'live', provider: 'Jolpica', season: sy, requestedSeason: y, races: mapJolpica(rows) }
    }
  }
  providerHealth.set('jolpica', { ok: false, at: Date.now() })
  // 2) OpenF1 meetings (keyless + CORS-friendly; supplies flags/circuit art)
  try {
    const mrows = rowsOf(await fetchJSON(`${OPENF1}/meetings?year=${y}`, 120_000))
    if (mrows.length) {
      const races = mrows.map((m, i) => ({
        round: i + 1,
        name: m.meeting_name,
        nameJa: m.meeting_name,
        circuit: m.circuit_short_name ?? m.location ?? '',
        circuitJa: m.circuit_short_name ?? m.location ?? '',
        country: m.country_name ?? '',
        countryJa: m.country_name ?? '',
        flag: m.country_flag ?? '',
        date: (m.date_start ?? '').slice(0, 10) || null,
        laps: null, lengthKm: null, turns: null, drsZones: null, lapRecord: null,
        trackImage: m.circuit_image ?? null,
        meetingKey: m.meeting_key
      }))
      providerHealth.set('openf1', { ok: true, at: Date.now() })
      return { source: 'live', provider: 'OpenF1', season: y, requestedSeason: y, races }
    }
  } catch { /* fall through */ }
  providerHealth.set('openf1', { ok: false, at: Date.now() })
  const snap = readSnapshot()
  if (snap?.year === y && snapshotFresh(snap) && snap.races?.length) {
    return { source: 'snapshot', season: y, races: snap.races, updatedAt: snap.updatedAt }
  }
  // bundled current-season dataset (source: OpenF1 baked in)
  if (calendar?.length) {
    return { source: 'bundle', provider: 'bundled', season: season.current, seasonLabel: season.current, races: calendar, updatedAt: season.updatedAt }
  }
  return { source: 'offline', season: y, races: [], note: 'calendar unavailable' }
}

async function getStandings(year, type) {
  const y = Number(year) || new Date().getFullYear()
  const map = (rows) => rows.map((r) => ({
    position: r.position,
    name: type === 'constructors' ? (r.team_name ?? r.constructor_name ?? r.name) : (r.driver_name ?? r.name),
    team: type === 'constructors' ? undefined : (r.team_name ?? r.constructor_name ?? ''),
    points: r.points ?? 0,
    wins: r.wins ?? 0
  }))
  // Jolpica is currently the only public source that publishes mid-season WDC/WCC.
  for (const sy of [y, y - 1, y - 2]) {
    const path = type === 'constructors' ? 'constructors' : 'drivers'
    const data = await fetchJSON(`${JOLPICA}/${sy}/${path}/?limit=100`, 120_000)
    const rows = rowsOf(data)
    if (rows.length) return { source: 'live', provider: 'Jolpica', season: sy, requestedSeason: y, standings: map(rows) }
  }
  providerHealth.set('jolpica', { ok: false, at: Date.now() })
  const snap = readSnapshot()
  const key = type === 'constructors' ? 'constructors' : 'drivers'
  if (snap?.year === y && snapshotFresh(snap) && snap[key]?.length) {
    return { source: 'snapshot', season: y, standings: snap[key], updatedAt: snap.updatedAt }
  }
  return { source: 'offline', season: y, standings: [], note: 'standings unavailable' }
}

async function getGrid(year) {
  const y = Number(year) || new Date().getFullYear()
  try {
    const meetings = rowsOf(await fetchJSON(`${OPENF1}/meetings?year=${y}`, 120_000))
    if (!meetings.length) return { source: 'offline', season: y, drivers: [] }
    const sorted = [...meetings].sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
    const now = new Date()
    const meeting = sorted.find((m) => new Date(m.date_start) <= now) ?? sorted[sorted.length - 1]
    const sessions = rowsOf(await fetchJSON(`${OPENF1}/sessions?meeting_key=${meeting.meeting_key}&session_type=Race`, 120_000))
    const key = sessions[0]?.session_key
    if (!key) return { source: 'offline', season: y, drivers: [] }
    const list = rowsOf(await fetchJSON(`${OPENF1}/drivers?session_key=${key}`, 120_000))
    return {
      source: 'live', provider: 'OpenF1', season: y, meetingKey: meeting.meeting_key,
      sessionKey: key,
      drivers: list.map((d) => ({
        number: d.driver_number,
        name: d.full_name ?? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim(),
        acronym: d.name_acronym,
        team: d.team_name,
        teamColour: d.team_colour,
        headshot: d.headshot_url
      }))
    }
  } catch {
    return { source: 'offline', season: y, drivers: [] }
  }
}

async function getLive(year, sessionKey) {
  const y = Number(year) || new Date().getFullYear()
  let key = sessionKey
  if (!key) {
    const meetings = await fetchJSON(`${OPENF1}/meetings?year=${y}`)
    const rows = Array.isArray(meetings) ? meetings : meetings?.results
    const m = rows?.find((x) => new Date(x.date_start) <= new Date()) ?? rows?.[rows.length - 1]
    if (!m) return { source: 'offline', sessionKey: null, note: 'no meeting' }
    const sessions = await fetchJSON(`${OPENF1}/sessions?meeting_key=${m.meeting_key}&session_type=Race`)
    const srows = Array.isArray(sessions) ? sessions : sessions?.results
    key = srows?.[0]?.session_key
    if (!key) return { source: 'offline', sessionKey: null, note: 'no race session' }
  }
  const [driversRes, positions, weather, pit] = await Promise.allSettled([
    fetchJSON(`${OPENF1}/drivers?session_key=${key}`, 60_000),
    fetchJSON(`${OPENF1}/positions?session_key=${key}`, 60_000),
    fetchJSON(`${OPENF1}/weather?session_key=${key}`, 60_000),
    fetchJSON(`${OPENF1}/pit?session_key=${key}`, 60_000)
  ])
  if (positions.status !== 'fulfilled' || !positions.value) {
    return { source: 'offline', sessionKey: key, note: 'live timing unavailable' }
  }
  const pos = Array.isArray(positions.value) ? positions.value : positions.value.results || []
  const drv = Array.isArray(driversRes.value) ? driversRes.value : driversRes.value?.results || []
  const wth = Array.isArray(weather.value) ? weather.value : weather.value?.results || []
  const pits = Array.isArray(pit.value) ? pit.value : pit.value?.results || []
  return {
    source: 'live',
    sessionKey: key,
    positions: pos,
    drivers: drv,
    weather: wth[wth.length - 1] ?? null,
    pitStops: pits
  }
}

// ---------- local prediction store (seeded demo + in-memory) ----------
const predictions = [
  { id: 'seed-1', name: 'ApexAce', points: 128, picks: 12, at: Date.now() - 86400000 * 6 },
  { id: 'seed-2', name: 'PapayaPower', points: 117, picks: 11, at: Date.now() - 86400000 * 5 },
  { id: 'seed-3', name: 'SuzukaSage', points: 96, picks: 10, at: Date.now() - 86400000 * 4 },
  { id: 'seed-4', name: 'DRS_Judy', points: 81, picks: 9, at: Date.now() - 86400000 * 3 },
  { id: 'seed-5', name: 'GridGai', points: 64, picks: 8, at: Date.now() - 86400000 * 2 }
]

const router = express.Router()

router.get('/health', (_req, res) => res.json({ ok: true, app: 'pitwall', time: new Date().toISOString() }))

router.get('/meta', (_req, res) => {
  res.json({
    app: 'PITWALL',
    season: new Date().getFullYear(),
    currentSeason: season.current,
    bundleSeason: season.current,
    bundleSource: season.source,
    bundleUpdatedAt: season.updatedAt,
    sources: {
      live: 'OpenF1 API (api.openf1.org)',
      history: 'Jolpica F1 API (api.jolpica.org)',
      offline: 'bundled dataset (server/data)'
    },
    providers: Object.fromEntries([...providerHealth.entries()].map(([k, v]) => [k, { ok: v.ok, at: new Date(v.at).toISOString() }])),
    note: 'ライブAPIに到達できない環境ではバンドルデータを返します。',
    lastSyncAt,
    cacheEntries: cache.size,
    ai: aiStatus()
  })
})

router.get('/calendar', async (req, res) => {
  res.json(await getCalendar(req.query.year))
})

router.get('/standings', async (req, res) => {
  const type = req.query.type === 'constructors' ? 'constructors' : 'drivers'
  res.json(await getStandings(req.query.year, type))
})

// Race results: live classification per round; season summary falls back to the
// bundled archive of the last completed season.
const archiveResults = read('results-2025.json')
const archiveStandings = read('standings-2025.json')

async function getRaceResult(year, round) {
  const y = Number(year) || season.current
  const r = Number(round)
  if (!r) return { source: 'offline', season: y, classification: [], note: 'round required' }
  try {
    const data = await fetchJSON(`${JOLPICA}/${y}/${r}/results/?limit=100`)
    const rows = Array.isArray(data) ? data : data?.results
    if (rows?.length) {
      return {
        source: 'live',
        season: y,
        round: r,
        classification: rows.map((x, i) => ({
          position: x.position ?? i + 1,
          driver: x.driver_name ?? x.full_name ?? x.name ?? '',
          team: x.team_name ?? x.constructor_name ?? '',
          points: x.points ?? 0,
          time: x.time ?? null,
          status: x.status ?? ''
        }))
      }
    }
  } catch { /* fall through */ }
  if (archiveResults?.season === y && archiveResults.rounds?.length) {
    return { source: 'archive', season: y, classification: [], note: 'archive has no per-race classification' }
  }
  return { source: 'offline', season: y, classification: [] }
}

router.get('/results', async (req, res) => {
  const y = Number(req.query.year) || season.current
  if (req.query.round) return res.json(await getRaceResult(y, req.query.round))
  try {
    // live season summary: reuse the calendar feed's race order + winners when available
    const data = await fetchJSON(`${JOLPICA}/${y}/races/?limit=100`)
    const rows = Array.isArray(data) ? data : data?.results
    if (rows?.length) {
      return res.json({ source: 'live', season: y, rounds: rows.map((r) => ({ round: r.round, name: r.race_name, date: (r.date ?? '').slice(0, 10) || null })) })
    }
  } catch { /* fall through */ }
  if (archiveResults?.rounds?.length && y >= archiveResults.season) {
    return res.json({ source: 'archive', season: archiveResults.season, rounds: archiveResults.rounds })
  }
  return res.json({ source: 'offline', season: y, rounds: [] })
})

router.get('/drivers', (_req, res) => {
  res.json(drivers.map((d) => ({ ...d, teamInfo: teamById[d.team] ?? null })))
})

router.get('/drivers/:id', (req, res) => {
  const d = driverById[req.params.id]
  if (!d) return res.status(404).json({ error: 'not found' })
  res.json({ ...d, teamInfo: teamById[d.team] ?? null })
})

router.get('/teams', (_req, res) => {
  res.json(teams.map((t) => ({ ...t, drivers: t.drivers.map((id) => driverById[id]).filter(Boolean) })))
})

router.get('/teams/:id', (req, res) => {
  const t = teamById[req.params.id]
  if (!t) return res.status(404).json({ error: 'not found' })
  res.json({ ...t, drivers: t.drivers.map((id) => driverById[id]).filter(Boolean) })
})

router.get('/champions', (_req, res) => res.json(champions))
router.get('/records', (_req, res) => res.json(records))

router.get('/trivia', (req, res) => {
  const cat = req.query.category
  const list = cat && cat !== 'all' ? trivia.filter((q) => q.category === cat) : trivia
  res.json(list)
})

router.get('/news', async (_req, res) => {
  const feeds = [
    'https://www.formula1.com/content/fom-website/en/latest/all.xml',
    'https://www.autosport.com/f1/news/feed/',
    'https://www.crash.net/f1/rss/news'
  ]
  for (const url of feeds) {
    const xml = await fetchText(url, 5000)
    if (xml) {
      const items = parseFeed(xml, 10)
      if (items.length) return res.json({ source: 'live', items })
    }
  }
  res.json({ source: 'offline', items: news })
})

router.get('/live', async (req, res) => {
  res.json(await getLive(req.query.year, req.query.sessionKey))
})

// Current entry list / driver lineup for the season (OpenF1).
router.get('/grid', async (req, res) => {
  res.json(await getGrid(req.query.year))
})

router.get('/predictions', (_req, res) => {
  res.json({ leaderboard: [...predictions].sort((a, b) => b.points - a.points) })
})

router.post('/predictions', (req, res) => {
  const { name, points = 0, picks = 0 } = req.body || {}
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' })
  const entry = { id: `u-${Date.now()}`, name: name.slice(0, 24), points: Number(points) || 0, picks: Number(picks) || 0, at: Date.now() }
  predictions.push(entry)
  res.json({ ok: true, entry, leaderboard: [...predictions].sort((a, b) => b.points - a.points) })
})

// ---------- AI prediction ----------
router.get('/ai-prediction', async (req, res) => {
  const round = Number(req.query.race)
  const race = calendar.find((r) => r.round === round) || calendar[0]
  try {
    const result = await predictRaceWithAI({ drivers, teams, race })
    res.json({ ok: true, race: { round: race.round, name: race.name }, ...result, status: aiStatus() })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
})

// ---------- fan SNS ----------
router.get('/posts', (_req, res) => {
  const list = [...loadPosts()].sort((a, b) => new Date(b.at) - new Date(a.at))
  res.json({ items: list })
})

router.post('/posts', (req, res) => {
  const { name = 'F1 FAN', text = '', tags = [], color = '#e10600' } = req.body || {}
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'text required' })
  if (text.length > 280) return res.status(400).json({ error: 'too long (max 280)' })
  const list = loadPosts()
  const post = {
    id: `u-${Date.now()}`,
    name: String(name).slice(0, 24),
    color,
    text: text.trim(),
    tags: Array.isArray(tags) ? tags.map((t) => String(t).slice(0, 30)).slice(0, 5) : [],
    likes: 0,
    at: new Date().toISOString()
  }
  list.push(post)
  savePosts(list)
  res.json({ ok: true, post })
})

router.post('/posts/:id/like', (req, res) => {
  const list = loadPosts()
  const post = list.find((p) => p.id === req.params.id)
  if (!post) return res.status(404).json({ error: 'not found' })
  post.likes += 1
  savePosts(list)
  res.json({ ok: true, likes: post.likes })
})

router.get('/posts/:id/replies', (req, res) => {
  const post = loadPosts().find((p) => p.id === req.params.id)
  if (!post) return res.status(404).json({ error: 'not found' })
  res.json({ replies: post.replies || [] })
})

router.post('/posts/:id/replies', (req, res) => {
  const { name = 'F1 FAN', text = '' } = req.body || {}
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'text required' })
  if (text.length > 280) return res.status(400).json({ error: 'too long (max 280)' })
  const list = loadPosts()
  const post = list.find((p) => p.id === req.params.id)
  if (!post) return res.status(404).json({ error: 'not found' })
  if (!Array.isArray(post.replies)) post.replies = []
  const reply = {
    id: `r-${Date.now()}`,
    name: String(name).slice(0, 24),
    text: text.trim(),
    at: new Date().toISOString()
  }
  post.replies.push(reply)
  savePosts(list)
  res.json({ ok: true, reply, count: post.replies.length })
})

// ---------- data freshness / sync ----------
router.get('/sync', (_req, res) => {
  res.json({
    lastSyncAt,
    now: new Date().toISOString(),
    cacheEntries: cache.size,
    ai: aiStatus(),
    note: 'サーバは5分ごとにライブAPIのキャッシュを自動更新します。'
  })
})

router.post('/sync', async (_req, res) => {
  // force warm-up of cached endpoints (best effort; offline環境ではスキップ)
  const year = new Date().getFullYear()
  await getCalendar(year)
  await getStandings(year, 'drivers')
  lastSyncAt = new Date().toISOString()
  res.json({ ok: true, lastSyncAt })
})

let lastSyncAt = new Date().toISOString()
// background auto-refresh (best effort)
setInterval(() => {
  const year = new Date().getFullYear()
  Promise.allSettled([getCalendar(year), getStandings(year, 'drivers'), getStandings(year, 'constructors')])
    .then(() => { lastSyncAt = new Date().toISOString() })
    .catch(() => {})
}, 5 * 60 * 1000).unref?.()

export default router
