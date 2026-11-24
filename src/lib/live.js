// ============================================================================
// PITWALL — browser-direct live data (static hosts such as GitHub Pages)
// ----------------------------------------------------------------------------
// Static hosts have no Express server, so the browser talks to the public F1
// APIs directly (see providers.js for the provider chain + relays). Nothing runs
// continuously: the user presses the navbar 「更新」 button, we fetch once,
// cache the result in localStorage, and every page reads the freshest snapshot.
//
// Uses the current OpenF1 endpoint names (position / session_result /
// championship_drivers|teams) so real 2026 data actually arrives.
// ============================================================================

import { load, save } from './store.js'
import {
  OPENF1, JOLPICA, RELAYS, fetchVia, rowsOf,
  openf1Meetings, openf1Sessions, openf1RaceSession, openf1Drivers,
  openf1SessionResult, openf1ChampionshipDrivers, openf1ChampionshipTeams,
  openf1PositionWindow, openf1Weather,
  raceRoundsFromSessions, latestCompletedRound, driverDirectory
} from './providers.js'
import staticCalendar from './static/calendar.json'

export { OPENF1, JOLPICA, RELAYS }

// ---------- cache ----------
const keyFor = (kind, year) => `live.${kind}.${year}`
export function readLive(kind, year) {
  const v = load(keyFor(kind, year), null)
  return v && v.at ? v : null
}
export function writeLive(kind, year, payload) {
  save(keyFor(kind, year), { at: new Date().toISOString(), ...payload })
}
export function readCacheRaw(key) { return load(`live.${key}`, null) }
export function writeCacheRaw(key, payload) {
  save(`live.${key}`, { at: new Date().toISOString(), ...payload })
}

const STATUS_KEY = 'live.status'
export function readStatus() {
  return load(STATUS_KEY, { at: null, results: [], okCount: 0 })
}

// ---------- helpers ----------
async function timed(name, provider, fn) {
  const t0 = performance.now()
  try {
    const data = await fn()
    return { name, provider, ok: true, ms: Math.round(performance.now() - t0), data }
  } catch (e) {
    return { name, provider, ok: false, ms: Math.round(performance.now() - t0), error: String(e?.message || e) }
  }
}

/** Japanese display names for the current calendar (from the bundled copy). */
function jaMap() {
  const map = {}
  for (const r of staticCalendar || []) {
    if (r.name) map[r.name.toLowerCase()] = { nameJa: r.nameJa, flag: r.flag, circuitJa: r.circuitJa, countryJa: r.countryJa }
  }
  return map
}

export function meetingToRace(m, idx, map) {
  const ja = map[(m.meeting_name || '').toLowerCase()] || {}
  return {
    round: idx + 1,
    meetingKey: m.meeting_key,
    name: m.meeting_name,
    nameJa: ja.nameJa || m.meeting_name,
    circuit: m.circuit_short_name ?? m.location ?? '',
    circuitJa: ja.circuitJa || m.circuit_short_name || '',
    country: m.country_name ?? '',
    countryJa: ja.countryJa || m.country_name || '',
    flag: ja.flag || '',
    date: (m.date_start ?? '').slice(0, 10) || (m.date ?? '') || null,
    dateStart: m.date_start ?? null,
    dateEnd: m.date_end ?? null,
    gmtOffset: m.gmt_offset ?? null,
    trackImage: m.circuit_image ?? null,
    cancelled: !!m.is_cancelled
  }
}

const mapRaces = (rows) => rows.map((r) => ({
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

const mapStandings = (rows, type, drivers) => rows.map((r) => {
  const n = String(type === 'constructors' ? (r.team_name ?? '') : (r.driver_number ?? ''))
  const d = drivers?.get(n)
  return {
    position: r.position_current ?? r.position ?? null,
    number: type === 'constructors' ? undefined : Number(r.driver_number),
    name: type === 'constructors' ? (r.team_name ?? r.constructor_name ?? '') : (d?.name || r.driver_name || `#${n}`),
    nameJa: d?.nameJa || '',
    team: type === 'constructors' ? undefined : (d?.team || r.team_name || ''),
    points: r.points_current ?? r.points ?? 0
  }
}).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// one manual refresh pass (navbar 「更新」)
// ---------------------------------------------------------------------------
export async function refreshLive(year = new Date().getFullYear()) {
  const jmap = jaMap()

  const calendarTask = async () => {
    try {
      const meetings = await openf1Meetings(year)
      if (meetings.length) {
        const races = meetings.map((m, i) => meetingToRace(m, i, jmap))
        writeLive('calendar', year, { season: year, races, provider: 'OpenF1' })
        return { count: races.length, provider: 'OpenF1' }
      }
    } catch { /* fall through to Jolpica */ }
    const d = await fetchVia(`${JOLPICA}/${year}/races/?limit=100`)
    const rows = rowsOf(d)
    if (!rows.length) throw new Error('empty')
    const races = mapRaces(rows)
    writeLive('calendar', year, { season: year, races, provider: 'Jolpica' })
    return { count: races.length, provider: 'Jolpica' }
  }

  const lineupTask = async () => {
    let meetings = []
    try { meetings = await openf1Meetings(year) } catch { return { count: 0, provider: 'none', note: 'no meetings' } }
    const now = new Date()
    const sorted = [...meetings].sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
    const near = sorted.find((m) => new Date(m.date_end) >= new Date(now.getTime() - 2 * 86400000)) ||
      sorted[sorted.length - 1]
    if (!near) throw new Error('no meeting')
    const session = await openf1RaceSession(near.meeting_key)
    if (!session) throw new Error('no race session')
    const drivers = await openf1Drivers(session.session_key)
    const payload = {
      season: year,
      meetingKey: near.meeting_key,
      meetingName: near.meeting_name,
      sessionKey: session.session_key,
      sessionStart: session.date_start,
      drivers: drivers.map((d) => ({
        number: d.driver_number,
        name: d.full_name ?? `${d.first_name} ${d.last_name}`,
        acronym: d.name_acronym,
        team: d.team_name,
        teamColour: d.team_colour,
        headshot: d.headshot_url
      }))
    }
    writeCacheRaw(`lineup.${year}`, payload)
    return { count: drivers.length, provider: 'OpenF1', sessionKey: session.session_key }
  }

  // Results summary: sessions -> per-round top-3. Kept small (rate limits).
  const resultsTask = async () => {
    const sessions = await openf1Sessions(year)
    const rounds = raceRoundsFromSessions(sessions)
    if (!rounds.length) throw new Error('no sessions')
    const now = new Date()
    const lastDone = [...rounds].filter((r) => !r.cancelled && r.dateEnd && new Date(r.dateEnd) <= now)
      .sort((a, b) => new Date(b.dateStart) - new Date(a.dateStart))[0]
    const driversRows = await openf1Drivers(lastDone?.sessionKey || rounds[rounds.length - 1].sessionKey).catch(() => [])
    const driverMap = new Map(driversRows.map((d) => [String(d.driver_number), {
      name: d.full_name ?? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim(),
      nameJa: '', team: d.team_name ?? ''
    }]))
    const out = []
    for (const r of rounds) {
      if (r.cancelled) { out.push({ ...r, status: 'cancelled', winner: null }); continue }
      if (!r.dateEnd || new Date(r.dateEnd) > now) { out.push({ ...r, status: 'upcoming', winner: null }); continue }
      try {
        const rows = rowsOf(await fetchVia(`${OPENF1}/session_result?session_key=${r.sessionKey}&position<=3`))
        const podium = rows.map((x) => ({ position: x.position, number: x.driver_number, name: driverMap.get(String(x.driver_number))?.name || `#${x.driver_number}`, team: driverMap.get(String(x.driver_number))?.team || '' }))
          .sort((a, b) => a.position - b.position)
        out.push({ ...r, status: 'completed', winner: podium[0] ? { number: podium[0].number, name: podium[0].name, team: podium[0].team } : null })
      } catch {
        out.push({ ...r, status: 'unknown', winner: null })
      }
      await sleep(420)
    }
    writeLive('results', year, { season: year, source: 'cache', provider: 'OpenF1', rounds: out })
    return { count: out.filter((r) => r.winner).length, provider: 'OpenF1' }
  }

  const standingsTask = (type) => async () => {
    const sessions = await openf1Sessions(year)
    const rounds = raceRoundsFromSessions(sessions)
    const now = new Date()
    const last = [...rounds].filter((r) => !r.cancelled && r.dateEnd && new Date(r.dateEnd) <= now)
      .sort((a, b) => new Date(b.dateStart) - new Date(a.dateStart))[0]
    if (!last) throw new Error('no finished race')
    try {
      const path = type === 'constructors' ? 'constructors' : 'drivers'
      const d = await fetchVia(`${JOLPICA}/${year}/${path}/?limit=100`, 9000)
      const rows = rowsOf(d)
      if (rows.length) {
        const standings = mapStandings(rows.map((r) => ({ ...r, position_current: r.position, points_current: r.points })), type, null)
        writeLive(type === 'constructors' ? 'standingsConstructors' : 'standingsDrivers', year, { season: year, standings, provider: 'Jolpica' })
        return { season: year, count: standings.length, provider: 'Jolpica' }
      }
    } catch { /* fall through to OpenF1 */ }
    const drv = await openf1Drivers(last.sessionKey).catch(() => [])
    const driverMap = new Map(drv.map((x) => [String(x.driver_number), { name: x.full_name ?? '', nameJa: '', team: x.team_name ?? '' }]))
    const rows = type === 'constructors'
      ? rowsOf(await openf1ChampionshipTeams(last.sessionKey))
      : rowsOf(await openf1ChampionshipDrivers(last.sessionKey))
    if (!rows.length) throw new Error('empty')
    const standings = mapStandings(rows, type, driverMap)
    writeLive(type === 'constructors' ? 'standingsConstructors' : 'standingsDrivers', year, { season: year, standings, provider: 'OpenF1' })
    return { season: year, count: standings.length, provider: 'OpenF1', sessionKey: last.sessionKey }
  }

  const results = await Promise.all([
    timed('calendar', 'auto', calendarTask),
    timed('lineup', 'OpenF1', lineupTask),
    timed('results', 'OpenF1', resultsTask),
    timed('standings.drivers', 'auto', standingsTask('drivers')),
    timed('standings.constructors', 'auto', standingsTask('constructors'))
  ])
  const okCount = results.filter((r) => r.ok).length
  const status = { at: new Date().toISOString(), year, results, okCount, relays: RELAYS.length }
  save(STATUS_KEY, status)
  return status
}

/**
 * Timing tower payload for `/live`.
 *   - while a race weekend is hot: positions inside a short time window
 *   - otherwise: the final classification of the most recent race
 */
export async function loadClientLive(year = new Date().getFullYear()) {
  const sessions = await openf1Sessions(year)
  const rounds = raceRoundsFromSessions(sessions).filter((r) => !r.cancelled)
  if (!rounds.length) throw new Error('no race session')
  const now = new Date()
  const meta = rounds.find((r) => new Date(r.dateStart) <= now && new Date(r.dateEnd) >= new Date(now.getTime() - 90 * 60000))
    || [...rounds].reverse().find((r) => r.dateEnd && new Date(r.dateEnd) <= now)
    || rounds[rounds.length - 1]
  const drivers = await openf1Drivers(meta.sessionKey)
  const driverMap = new Map(drivers.map((d) => [String(d.driver_number), d]))

  const start = new Date(meta.dateStart)
  const end = new Date(meta.dateEnd)
  const inSession = now >= new Date(start.getTime() - 90 * 60000) && now <= new Date(end.getTime() + 90 * 60000)
  if (inSession) {
    const from = new Date(now.getTime() - 6 * 60000).toISOString()
    try {
      const posRows = await openf1PositionWindow(meta.sessionKey, from, now.toISOString())
      const last = new Map()
      for (const p of posRows) last.set(String(p.driver_number), p)
      const positions = [...last.values()].sort((a, b) => Number(a.position) - Number(b.position))
      if (positions.length) {
        const weather = await openf1Weather(meta.sessionKey).catch(() => null)
        return {
          source: 'live', provider: 'OpenF1', sessionKey: meta.sessionKey, window: { from, to: now.toISOString() },
          meetingName: meta.name, circuit: meta.circuit, dateStart: meta.dateStart,
          positions, drivers, weather
        }
      }
    } catch { /* fall through to the final classification */ }
  }

  const rows = await openf1SessionResult(meta.sessionKey)
  if (!rows.length) throw new Error('no session result')
  const classification = rows.map((r) => ({
    position: r.position ?? null,
    number: r.driver_number,
    driver: driverMap.get(String(r.driver_number))?.full_name || `#${r.driver_number}`,
    driverJa: '',
    team: driverMap.get(String(r.driver_number))?.team_name || '',
    points: r.points ?? 0,
    laps: r.number_of_laps ?? null,
    status: r.dnf ? 'DNF' : r.dns ? 'DNS' : r.dsq ? 'DSQ' : ''
  })).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
  const weather = await openf1Weather(meta.sessionKey).catch(() => null)
  return {
    source: 'result', provider: 'OpenF1', sessionKey: meta.sessionKey,
    meetingName: meta.name, circuit: meta.circuit, dateStart: meta.dateStart, dateEnd: meta.dateEnd,
    classification, drivers, weather
  }
}
