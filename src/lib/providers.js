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

// ---------- providers ----------
export async function openf1Meetings(year) {
  const rows = rowsOf(await fetchVia(`${OPENF1}/meetings?year=${year}`))
  return rows.filter((m) => m && !m.is_cancelled)
}

export async function openf1RaceSession(meetingKey) {
  const rows = rowsOf(await fetchVia(`${OPENF1}/sessions?meeting_key=${meetingKey}&session_type=Race`))
  return rows[0] || null
}

export async function openf1Drivers(sessionKey) {
  return rowsOf(await fetchVia(`${OPENF1}/drivers?session_key=${sessionKey}`))
}

export async function openf1Positions(sessionKey) {
  return rowsOf(await fetchVia(`${OPENF1}/positions?session_key=${sessionKey}`, 12000))
}

export async function openf1Weather(sessionKey) {
  const rows = rowsOf(await fetchVia(`${OPENF1}/weather?session_key=${sessionKey}`))
  return rows.at(-1) || null
}

export async function jolpicaJSON(pathAndQuery, timeoutMs = 9000) {
  return fetchVia(`${JOLPICA}${pathAndQuery}`, timeoutMs)
}

/** small reachability probes for the diagnostics panel */
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
