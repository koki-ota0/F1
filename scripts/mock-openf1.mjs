#!/usr/bin/env node
// ---------------------------------------------------------------------------
// OpenF1-shaped mock used ONLY for local QA (browser/jsdom screenshots).
// It serves a fixed 2026 dataset captured from the public API on 2026-11-23 so
// the sandbox (which cannot reach api.openf1.org) can still exercise the real
// code paths. Nothing here ships to the user: the production app talks to
// https://api.openf1.org/v1 unless VITE_OPENF1_BASE / PITWALL_OPENF1_BASE is set.
//
//   node scripts/mock-openf1.mjs [port]
// ---------------------------------------------------------------------------
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PORT = Number(process.argv[2]) || 4190

const rawCal = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'data', 'calendar.json'), 'utf8'))
// tolerate both the old flat array and the current {season,races} payload
const calendar = Array.isArray(rawCal) ? rawCal : (rawCal.races || [])
const drivers = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'data', 'drivers.json'), 'utf8'))

/** round -> race session key (OpenF1 2026) */
const SESSION_KEYS = [11234, 11245, 11253, 11261, 11269, 11280, 11291, 11299, 11307, 11315, 11326,
  11334, 11342, 11353, 11361, 11369, 11377, 11731, 11388, 11396, 11404, 11412, 11420, 11428, 11436]
const CANCELLED = new Set([4, 5])

const podiumByRound = {
  1: [63, 12, 16], 2: [12, 63, 44], 3: [12, 81, 16],
  6: [12, 1, 81], 7: [12, 44, 3], 8: [12, 44, 6], 9: [44, 63, 1],
  10: [63, 3, 12], 11: [16, 63, 44], 12: [12, 16, 3], 13: [1, 3, 12],
  14: [1, 12, 63], 15: [12, 63, 3], 16: [12, 3, 1], 17: [63, 3, 6],
  18: [3, 12, 44], 19: [3, 16, 12], 20: [12, 16, 3], 21: [3, 44, 12],
  22: [1, 3, 6], 23: [3, 1, 81]
}

/** Full Las Vegas 2026 classification (captured verbatim from OpenF1). */
const LAS_VEGAS = [
  [1, 3, 50, 25.0, false, 5259.624, 0],
  [2, 1, 50, 18.0, false, 5260.263, 0.639],
  [3, 81, 50, 15.0, false, 5261.153, 1.529],
  [4, 12, 50, 12.0, false, 5262.198, 2.574],
  [5, 10, 50, 10.0, false, 5262.551, 2.927],
  [6, 43, 50, 8.0, false, 5267.579, 7.955],
  [7, 44, 50, 6.0, false, 5272.419, 12.795],
  [8, 55, 50, 4.0, false, 5272.562, 12.938],
  [9, 63, 50, 2.0, false, 5272.816, 13.192],
  [10, 16, 50, 1.0, false, 5277.178, 17.554],
  [11, 27, 50, 0.0, false, 5282.344, 22.72],
  [12, 5, 50, 0.0, false, 5288.226, 28.602],
  [13, 87, 50, 0.0, false, 5288.467, 28.843],
  [14, 30, 50, 0.0, false, 5296.212, 36.588],
  [15, 6, 50, 0.0, false, 5306.112, 46.488],
  [16, 51, 50, 0.0, false, 5307.438, 47.814],
  [17, 18, 50, 0.0, false, 5327.977, 68.353],
  [18, 77, 50, 0.0, false, 5331.297, 71.673],
  [19, 14, 49, 0.0, true, null, null],
  [null, 41, 19, 0.0, true, null, null],
  [null, 11, 17, 0.0, true, null, null],
  [null, 23, 0, 0.0, false, null, null]
]

const byNumber = new Map(drivers.map((d) => [String(d.number), d]))
const openF1Drivers = drivers.map((d) => ({
  meeting_key: 1300,
  session_key: 11420,
  driver_number: d.number,
  broadcast_name: d.name?.toUpperCase() ?? '',
  full_name: d.name,
  name_acronym: (d.id || '').slice(0, 3).toUpperCase(),
  team_name: ({ mercedes: 'Mercedes', ferrari: 'Ferrari', mclaren: 'McLaren', 'red-bull': 'Red Bull Racing' })[d.team] || d.team,
  team_colour: ({ mercedes: '00D7B6', ferrari: 'ED1131', mclaren: 'F47600', 'red-bull': '4781D7' })[d.team] || '999999',
  first_name: (d.name || '').split(' ')[0],
  last_name: (d.name || '').split(' ').slice(-1)[0],
  headshot_url: null,
  country_code: null
}))

const sessions = calendar.map((c, i) => {
  const start = new Date(`${c.date}T12:00:00Z`)
  const end = new Date(start.getTime() + 2 * 3600_000)
  return {
    session_key: SESSION_KEYS[i],
    session_type: 'Race',
    session_name: 'Race',
    meeting_name: c.name,
    date_start: start.toISOString(),
    date_end: end.toISOString(),
    meeting_key: 1279 + i,
    circuit_key: 1,
    circuit_short_name: c.circuit,
    country_key: 1,
    country_code: 'XXX',
    country_name: c.country,
    location: c.location || c.circuit,
    gmt_offset: '+00:00:00',
    year: 2026,
    is_cancelled: CANCELLED.has(c.round)
  }
})

function sessionResult(sessionKey) {
  const idx = SESSION_KEYS.indexOf(Number(sessionKey))
  const round = idx >= 0 ? idx + 1 : null
  if (round === 23) {
    return LAS_VEGAS.map(([position, number, laps, points, dnf, duration, gap]) => ({
      position, driver_number: number, number_of_laps: laps, points,
      dnf, dns: !dnf && position == null && number === 23, dsq: false,
      duration, gap_to_leader: gap, meeting_key: 1300, session_key: 11420
    }))
  }
  const pod = podiumByRound[round]
  if (!pod) return []
  // full 22-car classification (podium order first, then the rest by number) so
  // QA can assert a realistic timing table on any completed round
  const rest = LAS_VEGAS.map((row) => row[1]).filter((n) => !pod.includes(n))
  const order = [...pod, ...rest]
  const pts = [25, 18, 15]
  return order.map((number, i) => ({
    position: i + 1, driver_number: number, number_of_laps: 50, points: pts[i] || 0,
    dnf: false, dns: false, dsq: false, duration: null, gap_to_leader: i === 0 ? 0 : null,
    meeting_key: 1279 + idx, session_key: Number(sessionKey)
  }))
}

const wdc = [
  [1, 12, 402], [2, 3, 304], [3, 44, 267], [4, 63, 264], [5, 1, 264],
  [6, 16, 250], [7, 81, 167], [8, 6, 122], [9, 30, 89], [10, 10, 52],
  [11, 41, 38], [12, 43, 35], [13, 87, 23], [14, 5, 14], [15, 27, 14],
  [16, 55, 11], [17, 31, 7], [18, 14, 7], [19, 23, 5], [20, 22, 1],
  [21, 50, 1], [22, 18, 0], [23, 77, 0], [24, 11, 0], [25, 51, 0]
].map(([position_current, driver_number, points_current]) => ({
  meeting_key: 1300, session_key: 11420, driver_number, position_start: position_current, position_current, points_start: 0, points_current
}))
const wcc = [
  ['Mercedes', 666], ['Ferrari', 517], ['Red Bull Racing', 440], ['McLaren', 431],
  ['Racing Bulls', 114], ['Alpine', 87], ['Haas F1 Team', 31], ['Audi', 28],
  ['Williams', 16], ['Aston Martin', 7], ['Cadillac', 0]
].map(([team_name, points_current], i) => ({
  meeting_key: 1300, session_key: 11420, team_name, position_start: i + 1, position_current: i + 1, points_start: 0, points_current
}))

const json = (res, body) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(body))
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const p = url.pathname
  const q = url.searchParams
  try {
    if (p.endsWith('/sessions')) return json(res, sessions)
    if (p.endsWith('/meetings')) {
      return json(res, sessions.map((s) => {
        const idx = SESSION_KEYS.indexOf(s.session_key)
        const c = calendar[idx] || {}
        return {
          meeting_key: s.meeting_key, meeting_name: c.name ?? 'Grand Prix',
          circuit_short_name: c.circuit, country_name: c.country,
          country_flag: c.flag ?? '', circuit_image: null,
          date_start: s.date_start, date_end: s.date_end, is_cancelled: s.is_cancelled,
          year: 2026
        }
      }))
    }
    if (p.endsWith('/session_result')) return json(res, sessionResult(q.get('session_key')))
    if (p.endsWith('/championship_drivers')) return json(res, wdc)
    if (p.endsWith('/championship_teams')) return json(res, wcc)
    if (p.endsWith('/drivers')) return json(res, openF1Drivers)
    if (p.endsWith('/weather')) return json(res, [{
      date: new Date().toISOString(), session_key: Number(q.get('session_key') || 11420), meeting_key: 1300,
      humidity: 31, track_temperature: 14.9, air_temperature: 12.0, wind_direction: 140, pressure: 944.9, wind_speed: 0.6, rainfall: 0
    }])
    if (p.endsWith('/position')) {
      // a small deterministic window so the live-timing branch is exercised
      const now = new Date()
      return json(res, LAS_VEGAS.slice(0, 8).map(([position, number], i) => ({
        date: new Date(now.getTime() - (8 - i) * 4000).toISOString(),
        session_key: Number(q.get('session_key') || 11420),
        meeting_key: 1300, driver_number: number, position
      })))
    }
    res.writeHead(404); res.end('{}')
  } catch (e) {
    res.writeHead(500); res.end(String(e?.message || e))
  }
}).listen(PORT, '0.0.0.0', () => console.log(`mock OpenF1 → http://0.0.0.0:${PORT}`))
