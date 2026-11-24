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
import { fetchVia } from './providers.js'

const LIVE_BASES = { f1: JOLPICA, openf1: import.meta.env.VITE_OPENF1_BASE || 'https://api.openf1.org/v1' }
export { LIVE_BASES }
import staticResults2025 from './static/results-2025.json'
import staticStandings2025 from './static/standings-2025.json'

export async function getJSON(path) {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
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
  '/api/drivers': () => staticDrivers,
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
  '/api/results': () => ({ season: staticResults2025.season, source: 'archive', rounds: staticResults2025.rounds }),
  '/api/predictions': () => ({ leaderboard: [] }),
  '/api/posts': () => ({ items: [] }),
  '/api/sync': () => ({ lastSyncAt: null, note: 'static host' })
}

export function useApi(path, deps = [], opts = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const load = useCallback(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    getJSON(path)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => {
        const fallback = STATIC[path]
        if (fallback && alive) setState({ data: fallback(), loading: false, error: null, staticFallback: true })
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
    writeLive('calendar', year, { season, races })
    return { source: 'live', season, seasonLabel: season, races }
  }

  // freshest manually-refreshed snapshot (GitHub Pages flow)
  const cached = readLive('calendar', year)
  if (cached?.races?.length) {
    const s = cached.season || year
    return { source: 'cache', season: s, seasonLabel: s, races: cached.races, updatedAt: cached.at }
  }

  // last resort: client-bundled current-season dataset (works offline)
  if (staticCalendar?.length) {
    return { source: 'bundle', season: staticSeason.current, seasonLabel: staticSeason.current, races: staticCalendar, updatedAt: staticSeason.updatedAt }
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
  try {
    const srv = await getJSON(`/api/standings?year=${year}&type=${type}`)
    if (srv?.source === 'live' && srv.standings?.length) return srv
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
    return { source: 'cache', season: s, standings: cached.standings, updatedAt: cached.at }
  }
  // last resort: bundled archive of the last completed season (never an empty table)
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

/**
 * Season summary (round winners / pole / fastest lap).
 * @returns {season, source, rounds}
 */
export async function getResults(year) {
  const y = Number(year) || new Date().getFullYear()
  try {
    const srv = await getJSON(`/api/results?year=${y}`)
    // only accept a live summary when it actually carries result columns
    if (srv?.rounds?.length && srv.rounds.some((r) => r.winner || r.winningDriver)) return srv
  } catch { /* fall through */ }
  // bundled archive covers the most recent completed season
  if (y >= staticResults2025.season && staticResults2025.rounds?.length) {
    return { season: staticResults2025.season, source: 'archive', rounds: staticResults2025.rounds }
  }
  return { season: y, source: 'offline', rounds: [] }
}

/** Full classification for one race (live API only; archive has no per-race table). */
export async function getRaceResult(year, round) {
  const slot = `results.${year}.${round}`
  const cached = readCacheRaw(slot)
  try {
    const srv = await getJSON(`/api/results?year=${year}&round=${round}`)
    if (srv?.classification?.length) {
      writeCacheRaw(slot, { classification: srv.classification })
      return { source: 'live', season: year, classification: srv.classification }
    }
  } catch { /* fall through */ }
  if (cached?.classification?.length) return { source: 'cache', season: year, classification: cached.classification }
  const direct = await fetchVia(`${LIVE_BASES.f1}/${year}/${round}/results/?limit=100`, 9000).then((d) => Array.isArray(d) ? d : d?.results ?? null).catch(() => null)
  const rows = Array.isArray(direct) ? direct : direct?.results
  if (Array.isArray(rows) && rows.length) {
    const classification = rows.map(mapResultRow)
    writeCacheRaw(slot, { classification })
    return { source: 'live', season: year, classification }
  }
  return { source: 'offline', season: year, classification: [] }
}
