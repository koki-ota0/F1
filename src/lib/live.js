// ============================================================================
// PITWALL — browser-direct live data (static hosts such as GitHub Pages)
// ----------------------------------------------------------------------------
// Static hosts have no Express server, so the browser talks to the public F1
// APIs directly (see providers.js for the provider chain + relays). Nothing runs
// continuously: the user presses the navbar 「更新」 button, we fetch once,
// cache the result in localStorage, and every page reads the freshest snapshot.
// ============================================================================

import { load, save } from './store.js'
import {
  OPENF1, JOLPICA, RELAYS, fetchVia, rowsOf,
  openf1Meetings, openf1RaceSession, openf1Drivers,
  openf1Positions, openf1Weather
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

const mapStandings = (rows) => rows.map((r) => ({
  position: r.position,
  name: r.driver_name ?? r.team_name ?? r.constructor_name ?? r.name,
  team: r.team_name ?? r.constructor_name ?? '',
  points: r.points ?? 0,
  wins: r.wins ?? 0
}))

/**
 * One manual refresh pass. Tries the providers in parallel and caches successes:
 *  - calendar    : OpenF1 (primary, keyless/CORS) → Jolpica
 *  - lineup      : OpenF1 race session + drivers for the nearest meeting
 *  - standings   : Jolpica (drivers / constructors), relay-aware
 */
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

  const standingsTask = (type) => async () => {
    const path = type === 'constructors' ? 'constructors' : 'drivers'
    let lastError = null
    for (let y = year; y >= year - 2; y--) {
      try {
        const d = await fetchVia(`${JOLPICA}/${y}/${path}/?limit=100`)
        const rows = rowsOf(d)
        if (rows.length) {
          const standings = mapStandings(rows)
          writeLive(type === 'constructors' ? 'standingsConstructors' : 'standingsDrivers', year, { season: y, standings, provider: 'Jolpica' })
          return { season: y, count: standings.length, provider: 'Jolpica' }
        }
        lastError = new Error('empty')
      } catch (e) { lastError = e }
    }
    throw lastError || new Error('empty')
  }

  const results = await Promise.all([
    timed('calendar', 'auto', calendarTask),
    timed('lineup', 'OpenF1', lineupTask),
    timed('standings.drivers', 'Jolpica', standingsTask('drivers')),
    timed('standings.constructors', 'Jolpica', standingsTask('constructors'))
  ])
  const okCount = results.filter((r) => r.ok).length
  const status = { at: new Date().toISOString(), year, results, okCount, relays: RELAYS.length }
  save(STATUS_KEY, status)
  return status
}

/**
 * Client-side live timing for the `/live` page on static hosts.
 * Uses OpenF1 (meetings → race session → positions/drivers/weather).
 * Throws when nothing usable is available.
 */
export async function loadClientLive(year = new Date().getFullYear()) {
  const meetings = await openf1Meetings(year)
  if (!meetings.length) throw new Error('no meetings')
  const sorted = [...meetings].sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
  const now = new Date()
  const meeting =
    sorted.find((m) => new Date(m.date_start) <= now && new Date(m.date_end) >= now) ||
    sorted.reverse().find((m) => new Date(m.date_end) >= new Date(now.getTime() - 2 * 86400000)) ||
    sorted[sorted.length - 1]
  const session = await openf1RaceSession(meeting.meeting_key)
  if (!session) throw new Error('no race session')
  const drivers = await openf1Drivers(session.session_key)
  let positions = []
  try { positions = await openf1Positions(session.session_key) } catch { positions = [] }
  let weather = null
  try { weather = await openf1Weather(session.session_key) } catch { weather = null }
  if (!positions.length) throw new Error('positions unavailable')

  // keep the latest record per driver number
  const last = new Map()
  for (const p of positions) last.set(p.driver_number, p)
  const pos = [...last.values()].sort((a, b) => Number(a.position) - Number(b.position))

  return {
    source: 'live',
    provider: 'OpenF1',
    sessionKey: session.session_key,
    meetingName: meeting.meeting_name,
    sessionStart: session.date_start,
    positions: pos,
    drivers,
    weather
  }
}
