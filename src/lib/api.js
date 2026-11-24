import { assetUrl } from './asset.js'
import { useEffect, useState, useCallback } from 'react'
import staticDrivers from './static/drivers.json'
import staticTeams from './static/teams.json'
import staticCalendar from './static/calendar.json'
import staticChampions from './static/champions.json'
import staticRecords from './static/records.json'
import staticTrivia from './static/trivia.json'
import staticNews from './static/news.json'
import staticSeason from './static/season.json'
import { readLive, writeLive, readCacheRaw, writeCacheRaw, JOLPICA } from './live.js'
import {
  fetchVia, rowsOf, raceRoundsFromSessions, latestCompletedRound, driverDirectory,
  openf1Sessions, openf1Drivers, openf1SessionResult,
  openf1ChampionshipDrivers, openf1ChampionshipTeams
} from './providers.js'

const LIVE_BASES = { f1: JOLPICA, openf1: import.meta.env.VITE_OPENF1_BASE || 'https://api.openf1.org/v1' }
export { LIVE_BASES }
import staticResults2025 from './static/results-2025.json'
import staticStandings2025 from './static/standings-2025.json'
import staticResults2026 from './static/results-2026.json'
import staticStandings2026 from './static/standings-2026.json'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function getJSON(path) {
  // The app can live under a subpath (GitHub Pages: /F1/). A bare "/api/x"
  // would hit the host root and 404, so resolve it against the built asset
  // root; the dev server and Express both answer at "/api/...".
  const url = String(path).startsWith('/api/') ? assetUrl(path) : path
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Browser-direct fetch with short timeout (relay-aware; null on failure). */
export async function tryBrowser(url, timeoutMs = 3000) {
  try {
    return await fetchVia(url, timeoutMs)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Static fallback: keeps the whole site usable on hosts without our API
// (GitHub Pages / Netlify / plain static). Server data remains the source of
// truth; these copies are refreshed by `npm run bundle` (= prebuild).
// ---------------------------------------------------------------------------
const STATIC = {
  // portraits resolve to the bundled official crop (same single source as the server)
  '/api/drivers': () => staticDrivers.map((d) => ({
    ...d, photo: assetUrl(`images/drivers/${d.id}.jpg`)
  })),
  '/api/teams': () => staticTeams,
  '/api/champions': () => staticChampions,
  '/api/records': () => staticRecords,
  '/api/trivia': () => staticTrivia,
  '/api/news': () => ({ source: 'offline', items: staticNews }),
  '/api/meta': () => ({
    app: 'PITWALL', mode: 'static-host',
    season: new Date().getFullYear(),
    currentSeason: staticSeason.current, bundleSeason: staticSeason.current,
    bundleSource: staticSeason.source, bundleUpdatedAt: staticSeason.updatedAt,
    sources: { live: 'OpenF1 API', history: 'Jolpica F1 API', offline: 'bundled dataset (client)' },
    bases: LIVE_BASES,
    lastSyncAt: null,
    refreshMode: 'manual'
  }),
  // Static host: the current season comes from the baked snapshot so the page
  // still shows real 2026 data; the previous-season file is only an archive tab.
  // On a real host these paths never hit (Express answers first); the copies
  // matter only if a page is opened without the API layer.
  '/api/results': () => ({
    season: staticSeason.current,
    source: 'bundle',
    provider: 'OpenF1 (bundled snapshot)',
    updatedAt: staticResults2026?.retrievedAt,
    rounds: staticResults2026?.rounds || []
  }),
  '/api/results?year=:y&round=:r': () => ({ source: 'offline', classification: [], note: 'static host' }),
  '/api/standings': () => ({
    season: staticSeason.current,
    source: 'bundle',
    provider: 'OpenF1 (bundled snapshot)',
    updatedAt: staticStandings2026?.retrievedAt,
    drivers: staticStandings2026?.drivers || [],
    constructors: staticStandings2026?.constructors || []
  }),
  '/api/predictions': () => ({ leaderboard: [] }),
  '/api/posts': () => ({ items: [] }),
  '/api/sync': () => ({ lastSyncAt: null, note: 'static host' })
}


/**
 * Static-host fallback for a request path. Handles both the collection routes
 * (`/api/drivers`) and the item routes (`/api/drivers/max-verstappen`), so deep
 * links keep working where there is no Express API behind the page.
 */
function staticFallback(path) {
  const exact = STATIC[path]
  if (exact) return exact()
  const item = String(path).match(/^\/api\/(drivers|teams)\/([^/?]+)$/)
  if (!item) return undefined
  const collection = STATIC[`/api/${item[1]}`]
  if (!collection) return undefined
  const found = collection().find((row) => row.id === item[2])
  return found ?? null
}

export function useApi(path, deps = [], opts = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const load = useCallback(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    getJSON(path)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => {
        const data = staticFallback(path)
        if (data !== undefined && alive) setState({ data, loading: false, error: null, staticFallback: true })
        else if (alive) setState({ data: null, loading: false, error })
      })
    return () => { alive = false }
  }, [path])
  useEffect(() => load(), [load, ...deps])
  useEffect(() => {
    if (!opts.refreshMs) return undefined
    const id = setInterval(load, opts.refreshMs)
    return () => clearInterval(id)
  }, [load, opts.refreshMs])
  return { ...state, reload: load }
}

/** lightweight poll for endpoints consumed outside useApi */
export function usePolled(path, refreshMs = 120000) {
  const [data, setData] = useState(null)
  useEffect(() => {
    let alive = true
    const run = () => getJSON(path).then((d) => alive && setData(d)).catch(() => {})
    run()
    const id = setInterval(run, refreshMs)
    return () => { alive = false; clearInterval(id) }
  }, [path, refreshMs])
  return data
}

/**
 * Merge live calendar rows into the bundled official race-hub facts.
 * Live providers number rounds differently (Jolpica counts cancelled rounds),
 * so match by race date first, then by normalised circuit name.
 */
function mergeCalendarFacts(bundled, live) {
  if (!bundled?.length || !Array.isArray(live) || !live.length) return bundled || []
  const key = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '')
  const byDate = new Map(); const byCircuit = new Map()
  for (const r of live) {
    if (r.date) byDate.set(r.date, r)
    const k = key(r.circuit)
    if (k) byCircuit.set(k, r)
  }
  return bundled.map((b) => {
    const l = (b.date && byDate.get(b.date)) || byCircuit.get(key(b.circuit))
    if (!l) return b
    return {
      ...b,
      date: l.date ?? b.date,
      laps: l.laps ?? b.laps,
      circuit: l.circuit || b.circuit,
      country: l.country || b.country,
      trackImage: l.trackImage || b.trackImage || null,
      meetingKey: l.meetingKey ?? b.meetingKey
    }
  })
}

/** Calendar: server → browser-direct → manual cache → client bundle. */
export async function getCalendar(year) {
  const toRaces = (rows) => rows.map((r) => ({
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

  try {
    const srv = await getJSON(`/api/calendar?year=${year}`)
    if (srv?.source === 'live') return srv
    if (srv?.races?.length) return srv          // server bundle / snapshot tier
  } catch { /* fall through */ }

  // static hosts: browser talks to the public API directly. If the requested
  // season is not published yet, fall back to the last available one.
  let season = null
  let races = null
  for (const y of [year, year - 1]) {
    const direct = await fetchVia(`${LIVE_BASES.f1}/${y}/races/?limit=100`, 9000).then((d) => Array.isArray(d) ? d : d?.results ?? null).catch(() => null)
    const rows = Array.isArray(direct) ? direct : direct?.results
    if (Array.isArray(rows) && rows.length) {
      season = y
      races = toRaces(rows)
      break
    }
  }
  if (races) {
    const merged = mergeCalendarFacts(Array.isArray(staticCalendar) ? staticCalendar : staticCalendar?.races || [], races)
    writeLive('calendar', year, { season, races: merged })
    return { source: 'live', season, seasonLabel: season, races: merged }
  }

  // freshest manually-refreshed snapshot (GitHub Pages flow)
  const cached = readLive('calendar', year)
  if (cached?.races?.length) {
    const s = cached.season || year
    const merged = mergeCalendarFacts(Array.isArray(staticCalendar) ? staticCalendar : staticCalendar?.races || [], cached.races)
    return { source: 'cache', season: s, seasonLabel: s, races: merged, updatedAt: cached.at }
  }

  // last resort: client-bundled current-season dataset (works offline).
  // 2026 calendar ships enriched with official race-hub facts (sessions, circuit
  // stats, lap record); older shapes are normalised so the UI stays stable.
  const bundled = Array.isArray(staticCalendar) ? staticCalendar : staticCalendar?.races || []
  if (bundled.length) {
    return {
      source: 'bundle',
      season: Array.isArray(staticCalendar) ? staticSeason.current : (staticCalendar?.season || staticSeason.current),
      seasonLabel: Array.isArray(staticCalendar) ? staticSeason.current : (staticCalendar?.season || staticSeason.current),
      races: bundled.map((r) => ({
        ...r,
        nameJa: r.nameJa || r.name,
        circuitJa: r.circuitJa || r.circuit || '',
        countryJa: r.countryJa || r.country || '',
        sessions: r.sessions || []
      })),
      updatedAt: staticSeason.updatedAt
    }
  }
  return { source: 'offline', season: year, races: [] }
}

/** Standings: server → browser-direct → manual cache → offline(empty). */
export async function getStandings(year, type) {
  const mapRows = (rows, kind) => rows.map((r) => ({
    position: r.position,
    name: kind === 'constructors' ? (r.team_name ?? r.constructor_name ?? r.name) : (r.driver_name ?? r.name),
    team: kind === 'drivers' ? (r.team_name ?? r.constructor_name ?? '') : undefined,
    points: r.points ?? 0,
    wins: r.wins ?? 0
  }))
  // server: live standings, or the baked static-host snapshot (source "bundle")
  try {
    const srv = await getJSON(`/api/standings?year=${year}&type=${type}`)
    const rows = srv?.source === 'live'
      ? srv.standings
      : (srv?.source === 'bundle' && type === 'constructors' ? srv.constructors : srv?.drivers)
    if (Array.isArray(rows) && rows.length) return { source: srv.source, season: srv.season || year, provider: srv.provider, requestedSeason: year, updatedAt: srv.updatedAt, standings: rows }
  } catch { /* fall through */ }
  const kind = type === 'constructors' ? 'standingsConstructors' : 'standingsDrivers'
  for (const y of [year, year - 1, year - 2]) {
    const direct = await fetchVia(`${LIVE_BASES.f1}/${y}/${type}/?limit=100`, 9000).then((d) => Array.isArray(d) ? d : d?.results ?? null).catch(() => null)
    const rows = Array.isArray(direct) ? direct : direct?.results
    if (Array.isArray(rows) && rows.length) {
      const standings = mapRows(rows, type)
      writeLive(kind, year, { season: y, standings, provider: 'Jolpica' })
      return { source: 'live', season: y, standings }
    }
  }
  const cached = readLive(kind, year)
  if (cached?.standings?.length) {
    const s = cached.season || year
    return { source: 'cache', season: s, provider: cached.provider, standings: cached.standings, updatedAt: cached.at }
  }
  // OpenF1 championship after the last finished race (3 requests)
  try {
    const sessions = await openf1Sessions(year)
    const rounds = raceRoundsFromSessions(sessions)
    const last = latestCompletedRound(rounds)
    if (last) {
      const [drivers, rows] = await Promise.all([
        openf1Drivers(last.sessionKey),
        type === 'constructors' ? openf1ChampionshipTeams(last.sessionKey) : openf1ChampionshipDrivers(last.sessionKey)
      ])
      if (rows.length) {
        const dir = driverDirectory(drivers)
        const standings = rows.map((r) => ({
          position: r.position_current ?? null,
          number: type === 'constructors' ? undefined : Number(r.driver_number),
          name: type === 'constructors' ? (r.team_name ?? '') : (dir.get(String(r.driver_number))?.name || `#${r.driver_number}`),
          team: type === 'constructors' ? undefined : (dir.get(String(r.driver_number))?.team || ''),
          points: r.points_current ?? 0
        })).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
        writeLive(kind, year, { season: year, standings, provider: 'OpenF1', sessionKey: last.sessionKey })
        return { source: 'live', provider: 'OpenF1', season: year, sessionKey: last.sessionKey, standings }
      }
    }
  } catch { /* fall through */ }
  // bundled 2026 snapshot, then the 2025 archive (never an empty table)
  if (year >= staticStandings2026.season && staticStandings2026[type]?.length) {
    return { source: 'bundle', season: staticStandings2026.season, requestedSeason: year, provider: 'bundled', standings: staticStandings2026[type] }
  }
  if (staticStandings2025?.[type]?.length) {
    return { source: 'bundle', season: staticStandings2025.season, requestedSeason: year, standings: staticStandings2025[type] }
  }
  try { return await getJSON(`/api/standings?year=${year}&type=${type}`) } catch { return { source: 'offline', season: year, standings: [] } }
}

// ---------------------------------------------------------------------------
// Race results: server → browser-direct → manual cache → bundled archive.
// ---------------------------------------------------------------------------
const mapResultRow = (r, i) => ({
  position: r.position ?? i + 1,
  driver: r.driver_name ?? r.full_name ?? r.name ?? r.Driver?.givenName + ' ' + r.Driver?.familyName ?? '—',
  team: r.team_name ?? r.constructor_name ?? r.Constructor?.name ?? '',
  points: r.points ?? 0,
  time: r.time ?? r.Time ?? null,
  status: r.status ?? r.Status ?? ''
})

// ---------------------------------------------------------------------------
// OpenF1 tiers (browser-direct, used when there is no Express API behind us)
// ---------------------------------------------------------------------------
async function openf1LatestRoundPatch(y) {
  /** sessions + the last finished round's podium: 2 requests, never a full scan. */
  const sessions = await fetchVia(`${LIVE_BASES.openf1}/sessions?year=${y}`, 12000).then((d) => rowsOf(d)).catch(() => [])
  const rounds = raceRoundsFromSessions(sessions)
  if (!rounds.length) return {}
  const now = new Date()
  const last = latestCompletedRound(rounds, now)
  if (!last) return {}
  const drivers = driverDirectory(await openf1Drivers(last.sessionKey).catch(() => []))
  const rows = rowsOf(await fetchVia(`${LIVE_BASES.openf1}/session_result?session_key=${last.sessionKey}&position<=3`, 9000).catch(() => []))
  const podium = rows.map((x) => ({
    position: x.position,
    number: x.driver_number,
    name: drivers.get(String(x.driver_number))?.name || `#${x.driver_number}`,
    team: drivers.get(String(x.driver_number))?.team || ''
  })).sort((a, b) => a.position - b.position)
  const patch = {
    [last.round]: {
      ...last, status: 'completed',
      winner: podium[0] ? { number: podium[0].number, name: podium[0].name, team: podium[0].team } : null
    }
  }
  return patch
}

function mergeSummary(baseRounds, patch, season) {
  if (!patch || !Object.keys(patch).length) return baseRounds
  return baseRounds.map((r) => patch[r.round] || r)
}

/**
 * Season summary.
 * Tiers: server → manual cache → bundled 2026 snapshot (+live patch) → 2025 archive.
 */
export async function getResults(year) {
  const y = Number(year) || new Date().getFullYear()
  try {
    const srv = await getJSON(`/api/results?year=${y}`)
    if (srv?.rounds?.length && srv.rounds.some((r) => r.winner || r.status === 'completed')) {
      // normalise the source label: a baked snapshot must be presented as such
      const src = srv.source === 'bundle' || srv.source === 'snapshot' ? 'bundle' : srv.source
      return { ...srv, source: src }
    }
  } catch { /* fall through */ }

  const cached = readLive('results', y)
  if (cached?.rounds?.length && cached.rounds.some((r) => r.winner)) {
    return { season: cached.season || y, source: 'cache', provider: cached.provider, updatedAt: cached.at, rounds: cached.rounds }
  }

  if (y >= staticResults2026.season && staticResults2026.rounds?.length) {
    const patch = await openf1LatestRoundPatch(y).catch(() => ({}))
    const rounds = mergeSummary(staticResults2026.rounds, patch, y)
    return { season: staticResults2026.season, source: patch && Object.keys(patch).length ? 'live' : 'bundle', provider: 'OpenF1', rounds }
  }
  if (y >= staticResults2025.season && staticResults2025.rounds?.length) {
    return { season: staticResults2025.season, source: 'archive', rounds: staticResults2025.rounds }
  }
  return { season: y, source: 'offline', rounds: [] }
}

/** Full classification of one race. */
export async function getRaceResult(year, round) {
  const y = Number(year) || new Date().getFullYear()
  const slot = `results.${y}.${round}`
  const cached = readCacheRaw(slot)
  try {
    const srv = await getJSON(`/api/results?year=${y}&round=${round}`)
    if (srv?.classification?.length) {
      writeCacheRaw(slot, { classification: srv.classification })
      return { source: 'live', provider: srv.provider, season: srv.season || y, classification: srv.classification }
    }
    if (srv?.note === 'upcoming' || srv?.note === 'cancelled') {
      return { source: 'offline', season: srv.season || y, classification: [], note: srv.note }
    }
  } catch { /* fall through */ }
  if (cached?.classification?.length) return { source: 'cache', season: y, classification: cached.classification }
  // browser-direct OpenF1 (works on GitHub Pages too)
  try {
    const sessions = await openf1Sessions(y)
    const info = raceRoundsFromSessions(sessions).find((r) => r.round === Number(round))
    if (!info) return { source: 'offline', season: y, classification: [], note: 'round not found' }
    if (info.cancelled) return { source: 'offline', season: y, classification: [], note: 'cancelled' }
    if (info.dateEnd && new Date(info.dateEnd) > new Date()) return { source: 'offline', season: y, classification: [], note: 'upcoming' }
    const [drivers, rows] = await Promise.all([
      openf1Drivers(info.sessionKey),
      openf1SessionResult(info.sessionKey)
    ])
    if (rows.length) {
      const dir = driverDirectory(drivers)
      const classification = rows.map((r) => ({
        position: r.position ?? null,
        number: r.driver_number,
        driver: dir.get(String(r.driver_number))?.name || `#${r.driver_number}`,
        team: dir.get(String(r.driver_number))?.team || '',
        points: r.points ?? 0,
        laps: r.number_of_laps ?? null,
        status: r.dnf ? 'DNF' : r.dns ? 'DNS' : r.dsq ? 'DSQ' : ''
      })).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
      writeCacheRaw(slot, { classification })
      return { source: 'live', provider: 'OpenF1', season: y, classification }
    }
  } catch { /* fall through */ }
  const jolpica = await fetchVia(`${LIVE_BASES.f1}/${y}/${round}/results/?limit=100`, 9000).then((d) => rowsOf(d)).catch(() => [])
  if (jolpica.length) {
    const classification = jolpica.map(mapResultRow)
    writeCacheRaw(slot, { classification })
    return { source: 'live', provider: 'Jolpica', season: y, classification }
  }
  if (staticResults2025.rounds?.length && y >= staticResults2025.season) {
    return { source: 'archive', season: staticResults2025.season, classification: [], note: 'archive has no per-race classification' }
  }
  return { source: 'offline', season: y, classification: [] }
}
