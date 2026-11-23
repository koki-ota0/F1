import { useEffect, useState, useCallback } from 'react'

export async function getJSON(path) {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Browser-direct fetch with short timeout (CORS-permitting sources only). */
export async function tryBrowser(url, timeoutMs = 3000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const load = useCallback(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    getJSON(path)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }))
    return () => { alive = false }
  }, [path])
  useEffect(() => load(), [load, ...deps])
  return { ...state, reload: load }
}

const JOLPICA = 'https://api.jolpica.org/f1'

/** Calendar: server (which itself tries Jolpica) → browser-direct → bundle. */
export async function getCalendar(year) {
  try {
    const srv = await getJSON(`/api/calendar?year=${year}`)
    if (srv?.source === 'live') return srv
  } catch { /* fall through */ }
  const direct = await tryBrowser(`${JOLPICA}/${year}/races/?limit=100`, 2500)
  const rows = Array.isArray(direct) ? direct : direct?.results
  if (Array.isArray(rows) && rows.length) {
    return {
      source: 'live',
      season: year,
      races: rows.map((r) => ({
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
    }
  }
  try {
    const srv = await getJSON(`/api/calendar?year=${year}`)
    if (srv?.races?.length) return srv
  } catch { /* ignore */ }
  // last resort: bundled 2025 season
  try {
    const bundle = await getJSON('/api/calendar?year=2025')
    if (bundle?.races?.length) return { ...bundle, seasonLabel: 2025 }
  } catch { /* ignore */ }
  return { source: 'offline', season: year, races: [] }
}

/** Standings: server → browser-direct → bundle(empty). */
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
  const direct = await tryBrowser(`${JOLPICA}/${year}/${type}/?limit=100`)
  const rows = Array.isArray(direct) ? direct : direct?.results
  if (Array.isArray(rows) && rows.length) return { source: 'live', season: year, standings: mapRows(rows, type) }
  try { return await getJSON(`/api/standings?year=${year}&type=${type}`) } catch { return { source: 'offline', season: year, standings: [] } }
}
