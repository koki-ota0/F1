// ============================================================================
// PITWALL — browser-direct live data (for static hosts such as GitHub Pages)
// ----------------------------------------------------------------------------
// Static hosts have no Express server, so the browser talks to the public F1
// APIs directly. Nothing runs continuously: the user presses the 「更新」 button
// in the navbar, we fetch calendar + standings once, cache them in
// localStorage, and every page reads the freshest cached snapshot.
//
// Base URLs can be overridden at build time for restricted networks / mirrors:
//   VITE_F1_BASE      (Jolpica-style Ergast API, history + standings)
//   VITE_OPENF1_BASE  (OpenF1 live timing)
// ============================================================================

import { load, save } from './store.js'

const F1 = (import.meta.env.VITE_F1_BASE || 'https://api.jolpica.org/f1').replace(/\/$/, '')
const OPENF1 = (import.meta.env.VITE_OPENF1_BASE || 'https://api.openf1.org/v1').replace(/\/$/, '')

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// ---------- cache ----------
const keyFor = (kind, year) => `live.${kind}.${year}`
export function readLive(kind, year) {
  const v = load(keyFor(kind, year), null)
  return v && v.at ? v : null
}
export function writeLive(kind, year, payload) {
  save(keyFor(kind, year), { at: new Date().toISOString(), ...payload })
}

const STATUS_KEY = 'live.status'
export function readStatus() {
  return load(STATUS_KEY, { at: null, results: [], okCount: 0 })
}

// ---------- fetchers ----------
async function timed(name, fn) {
  const t0 = performance.now()
  try {
    const data = await fn()
    return { name, ok: true, ms: Math.round(performance.now() - t0), data }
  } catch (e) {
    return { name, ok: false, ms: Math.round(performance.now() - t0), error: String(e?.message || e) }
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
 * One manual refresh pass. Returns per-task results and caches successes.
 * @param year number — defaults to the current season
 */
export async function refreshLive(year = new Date().getFullYear()) {
  const tasks = [
    timed('calendar', async () => {
      const d = await fetchJson(`${F1}/${year}/races/?limit=100`)
      const rows = Array.isArray(d) ? d : d?.results
      if (!Array.isArray(rows) || !rows.length) throw new Error('empty')
      const races = mapRaces(rows)
      writeLive('calendar', year, { races })
      return races.length
    }),
    timed('standings.drivers', async () => {
      const d = await fetchJson(`${F1}/${year}/drivers/?limit=100`)
      const rows = Array.isArray(d) ? d : d?.results
      if (!Array.isArray(rows) || !rows.length) throw new Error('empty')
      const standings = mapStandings(rows)
      writeLive('standingsDrivers', year, { standings })
      return standings.length
    }),
    timed('standings.constructors', async () => {
      const d = await fetchJson(`${F1}/${year}/constructors/?limit=100`)
      const rows = Array.isArray(d) ? d : d?.results
      if (!Array.isArray(rows) || !rows.length) throw new Error('empty')
      const standings = mapStandings(rows)
      writeLive('standingsConstructors', year, { standings })
      return standings.length
    })
  ]
  const results = await Promise.all(tasks)
  const okCount = results.filter((r) => r.ok).length
  const status = { at: new Date().toISOString(), year, results, okCount }
  save(STATUS_KEY, status)
  return status
}

export const LIVE_BASES = { f1: F1, openf1: OPENF1 }
