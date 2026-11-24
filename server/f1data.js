// ============================================================================
// PITWALL — server-side OpenF1 aggregation (Node, ESM)
// ----------------------------------------------------------------------------
// Builds the season results summary / classification / championship standings
// from the public OpenF1 API. Jolpica stays the primary historical source in
// api.js; this module is the fallback that made 2026 data reachable after the
// endpoint renames (positions -> position, driver_standings -> championship_*,
// results -> session_result).
//
// Rate limits (free tier): 3 req/s, 30 req/min. We therefore aggregate slowly
// and cache aggressively; callers should treat failures as "try again later".
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')

export const OPENF1_BASE = (process.env.PITWALL_OPENF1_BASE || 'https://api.openf1.org/v1').replace(/\/$/, '')

/** Simple in-process TTL cache (URL -> {at,data}). */
const cache = new Map()
export async function httpJSON(url, { ttlMs = 300_000, timeoutMs = 12_000 } = {}) {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < ttlMs) return hit.data
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    cache.set(url, { at: Date.now(), data })
    return data
  } finally {
    clearTimeout(timer)
  }
}

const rowsOf = (d) => (Array.isArray(d) ? d : d?.results ?? [])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// season structure
// ---------------------------------------------------------------------------

/**
 * Race rounds of a season, ordered by start date (round = index + 1).
 * Sprint sessions are excluded; cancelled races keep their slot so the round
 * numbering matches the official calendar.
 */
export function raceRoundsFromSessions(sessions) {
  const races = rowsOf(sessions)
    .filter((s) => s.session_type === 'Race' && s.session_name !== 'Sprint')
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
  return races.map((s, i) => ({
    round: i + 1,
    meetingKey: s.meeting_key,
    sessionKey: s.session_key,
    name: s.session_name === 'Race' ? (s.meeting_name || 'Grand Prix') : s.session_name,
    circuit: s.circuit_short_name ?? '',
    country: s.country_name ?? '',
    location: s.location ?? '',
    dateStart: s.date_start ?? null,
    dateEnd: s.date_end ?? null,
    date: (s.date_start ?? '').slice(0, 10) || null,
    cancelled: !!s.is_cancelled
  }))
}

export function latestCompletedRound(rounds, now = new Date()) {
  return [...rounds]
    .filter((r) => !r.cancelled && r.dateEnd && new Date(r.dateEnd) <= now)
    .sort((a, b) => new Date(b.dateStart) - new Date(a.dateStart))[0] || null
}

// ---------------------------------------------------------------------------
// driver directory (number -> display info)
// ---------------------------------------------------------------------------

let bundledDrivers = null
function loadBundledDrivers() {
  if (bundledDrivers) return bundledDrivers
  try {
    bundledDrivers = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'drivers.json'), 'utf8'))
  } catch {
    bundledDrivers = []
  }
  return bundledDrivers
}

export function buildDriverMap(driversRows) {
  const jaByNumber = new Map(loadBundledDrivers().map((d) => [String(d.number), d]))
  const map = new Map()
  for (const d of rowsOf(driversRows)) {
    const n = String(d.driver_number)
    const bundled = jaByNumber.get(n)
    map.set(n, {
      number: d.driver_number,
      name: d.full_name ?? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim(),
      nameJa: bundled?.nameJa ?? d.last_name ?? '',
      team: d.team_name ?? '',
      teamColour: d.team_colour ?? null,
      headshot: d.headshot_url ?? null
    })
  }
  return map
}

// ---------------------------------------------------------------------------
// results
// ---------------------------------------------------------------------------

export async function fetchDriverMap(sessionKey) {
  try {
    return buildDriverMap(await httpJSON(`${OPENF1_BASE}/drivers?session_key=${sessionKey}`, { ttlMs: 6 * 3600_000 }))
  } catch {
    return new Map()
  }
}

const resultRow = (r, drivers) => {
  const d = drivers.get(String(r.driver_number)) || {}
  return {
    position: r.position ?? null,
    number: r.driver_number,
    driver: d.name || `#${r.driver_number}`,
    driverJa: d.nameJa || '',
    team: d.team || '',
    points: r.points ?? 0,
    laps: r.number_of_laps ?? null,
    gap: r.gap_to_leader ?? null,
    time: r.duration ?? null,
    status: r.dnf ? 'DNF' : r.dns ? 'DNS' : r.dsq ? 'DSQ' : ''
  }
}

/** Full classification of one race session. */
export async function buildRoundClassification(sessionKey, drivers) {
  const rows = rowsOf(await httpJSON(`${OPENF1_BASE}/session_result?session_key=${sessionKey}`))
  if (!rows.length) return null
  const classification = rows.map((r) => resultRow(r, drivers))
  classification.sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
  return { sessionKey, classification }
}

/**
 * Season summary used by the Results page.
 * @returns {{season:number, source:'live', provider:string, rounds:Array}}
 */
export async function buildSeasonResults(year, { maxRequests = 30, paceMs = 420 } = {}) {
  const sessions = await httpJSON(`${OPENF1_BASE}/sessions?year=${year}`, { ttlMs: 6 * 3600_000 })
  const rounds = raceRoundsFromSessions(sessions)
  if (!rounds.length) return { season: year, source: 'offline', provider: 'none', rounds: [] }

  const now = new Date()
  // one driver directory per season is enough (numbers are stable)
  const lastDone = latestCompletedRound(rounds, now)
  const drivers = await fetchDriverMap(lastDone?.sessionKey ?? rounds[rounds.length - 1].sessionKey)

  const out = []
  let used = 0
  for (const r of rounds) {
    if (r.cancelled) {
      out.push({ ...r, status: 'cancelled', winner: null, podium: [] })
      continue
    }
    const done = r.dateEnd && new Date(r.dateEnd) <= now
    if (!done) {
      out.push({ ...r, status: 'upcoming', winner: null, podium: [] })
      continue
    }
    if (used >= maxRequests) {
      out.push({ ...r, status: 'unknown', winner: null, podium: [] })
      continue
    }
    used++
    try {
      const rows = rowsOf(await httpJSON(`${OPENF1_BASE}/session_result?session_key=${r.sessionKey}&position<=3`))
      const podium = rows.map((x) => resultRow(x, drivers)).sort((a, b) => a.position - b.position)
      out.push({
        ...r,
        status: 'completed',
        winner: podium[0] ? { number: podium[0].number, name: podium[0].driver, nameJa: podium[0].driverJa, team: podium[0].team } : null,
        podium
      })
    } catch {
      out.push({ ...r, status: 'unknown', winner: null, podium: [] })
    }
    await sleep(paceMs)
  }
  return { season: year, source: 'live', provider: 'OpenF1', rounds: out, updatedAt: new Date().toISOString() }
}

// ---------------------------------------------------------------------------
// championship standings
// ---------------------------------------------------------------------------

/**
 * WDC/WCC after the given race session.
 * @returns {{season, provider, type, sessionKey, standings:Array}}
 */
export async function buildChampionship(sessionKey, type, drivers) {
  const url = type === 'constructors'
    ? `${OPENF1_BASE}/championship_teams?session_key=${sessionKey}`
    : `${OPENF1_BASE}/championship_drivers?session_key=${sessionKey}`
  const rows = rowsOf(await httpJSON(url))
  if (!rows.length) return null
  const key = (r) => (type === 'constructors' ? (r.team_name ?? '') : String(r.driver_number))
  const standings = rows.map((r) => {
    const id = key(r)
    const d = type === 'constructors' ? null : drivers.get(id)
    return {
      position: r.position_current ?? null,
      number: type === 'constructors' ? undefined : Number(id),
      name: type === 'constructors' ? (r.team_name ?? '') : (d?.name || `#${id}`),
      nameJa: d?.nameJa || '',
      team: type === 'constructors' ? undefined : (d?.team || ''),
      teamColour: type === 'constructors' ? undefined : (d?.teamColour || null),
      points: r.points_current ?? 0,
      wins: undefined
    }
  })
  standings.sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
  return { provider: 'OpenF1', type, sessionKey, season: null, standings }
}

export function cacheSize() { return cache.size }
