// ============================================================================
// PITWALL — data provider layer
// ----------------------------------------------------------------------------
// Browser-direct access to the public F1 APIs, with a provider chain and
// optional CORS relays so a blocked host can still be read through a relay:
//
//   VITE_OPENF1_BASE  OpenF1 root   (default https://api.openf1.org/v1)
//   VITE_F1_BASE      Jolpica root  (default https://api.jolpica.org/f1)
//   VITE_F1_RELAYS    JSON array of relay templates using "{url}", e.g.
//                     ["https://api.allorigins.win/raw?url={url}"]
//
// Every request tries the direct URL first, then each relay in order.
//
// NOTE on endpoint names: the public OpenF1 API renamed several endpoints.
//   positions          -> position
//   driver_standings   -> championship_drivers (beta)
//   constructor_standings -> championship_teams (beta)
//   results            -> session_result
// The old names return an error, which is why the site used to fall back to
// the bundled 2025 archive.
// ============================================================================

export const OPENF1 = (import.meta.env.VITE_OPENF1_BASE || 'https://api.openf1.org/v1').replace(/\/$/, '')
export const JOLPICA = (import.meta.env.VITE_F1_BASE || 'https://api.jolpica.org/f1').replace(/\/$/, '')

export const RELAYS = (() => {
  try {
    const raw = import.meta.env.VITE_F1_RELAYS
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x.includes('{url}')) : []
  } catch { return [] }
})()

async function fetchJson(url, timeoutMs) {
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

/** direct → relays, returns parsed JSON or throws */
export async function fetchVia(url, timeoutMs = 9000) {
  try {
    return await fetchJson(url, timeoutMs)
  } catch (err) {
    let last = err
    for (const tpl of RELAYS) {
      try {
        return await fetchJson(tpl.replace('{url}', encodeURIComponent(url)), timeoutMs + 4000)
      } catch (e) { last = e }
    }
    throw last
  }
}

export const rowsOf = (d) => (Array.isArray(d) ? d : d?.results ?? [])
const iso = (s) => (s ? encodeURIComponent(s) : '')

// ---------- OpenF1 ----------
export async function openf1Meetings(year) {
  return rowsOf(await fetchVia(`${OPENF1}/meetings?year=${year}`))
}

/** All sessions of a season (practice, qualifying, sprint and race). */
export async function openf1Sessions(year) {
  return rowsOf(await fetchVia(`${OPENF1}/sessions?year=${year}`, 12000))
}

export async function openf1RaceSession(meetingKey) {
  const rows = rowsOf(await fetchVia(`${OPENF1}/sessions?meeting_key=${meetingKey}&session_type=Race`))
  return rows.find((s) => s.session_name === 'Race') || rows[0] || null
}

export async function openf1Drivers(sessionKey) {
  return rowsOf(await fetchVia(`${OPENF1}/drivers?session_key=${sessionKey}`, 12000))
}

/** Full final classification of a session (race/quali/practice). */
export async function openf1SessionResult(sessionKey) {
  return rowsOf(await fetchVia(`${OPENF1}/session_result?session_key=${sessionKey}`, 12000))
}

/** Current/most recent championship standings after a race session. */
export async function openf1ChampionshipDrivers(sessionKey) {
  return rowsOf(await fetchVia(`${OPENF1}/championship_drivers?session_key=${sessionKey}`, 12000))
}
export async function openf1ChampionshipTeams(sessionKey) {
  return rowsOf(await fetchVia(`${OPENF1}/championship_teams?session_key=${sessionKey}`, 12000))
}

/**
 * Live positions inside a time window (seconds resolution).
 * `/position` without a window returns the whole session and is too large,
 * so we always ask for a short slice ending at `toIso`.
 */
export async function openf1PositionWindow(sessionKey, fromIso, toIso) {
  const q = [`session_key=${sessionKey}`]
  if (fromIso) q.push(`date>=${iso(fromIso)}`)
  if (toIso) q.push(`date<=${iso(toIso)}`)
  return rowsOf(await fetchVia(`${OPENF1}/position?${q.join('&')}`, 9000))
}

export async function openf1Weather(sessionKey) {
  const rows = rowsOf(await fetchVia(`${OPENF1}/weather?session_key=${sessionKey}`, 12000))
  return rows.at(-1) || null
}

export async function jolpicaJSON(pathAndQuery, timeoutMs = 9000) {
  return fetchVia(`${JOLPICA}${pathAndQuery}`, timeoutMs)
}

/** Race rounds ordered by start date (round = index + 1, sprints excluded). */
export function raceRoundsFromSessions(sessions) {
  const races = rowsOf(sessions)
    .filter((s) => s.session_type === 'Race' && s.session_name !== 'Sprint')
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
  return races.map((s, i) => ({
    round: i + 1,
    meetingKey: s.meeting_key,
    sessionKey: s.session_key,
    name: s.meeting_name || 'Grand Prix',
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

export function driverDirectory(driversRows) {
  const map = new Map()
  for (const d of rowsOf(driversRows)) {
    map.set(String(d.driver_number), {
      number: d.driver_number,
      name: d.full_name ?? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim(),
      team: d.team_name ?? '',
      teamColour: d.team_colour ?? null,
      headshot: d.headshot_url ?? null
    })
  }
  return map
}

/** small reachability probes for diagnostics */
export async function probeProviders(year = new Date().getFullYear()) {
  const probe = async (name, fn) => {
    const t0 = performance.now()
    try { await fn(); return { name, ok: true, ms: Math.round(performance.now() - t0) } }
    catch { return { name, ok: false, ms: Math.round(performance.now() - t0) } }
  }
  return Promise.all([
    probe('OpenF1', () => fetchJson(`${OPENF1}/meetings?year=${year}`, 6000)),
    probe('Jolpica', () => fetchJson(`${JOLPICA}/${year}/races/?limit=1`, 6000))
  ])
}
