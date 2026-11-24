#!/usr/bin/env node
// ---------------------------------------------------------------------------
// OpenF1-shaped mock used ONLY for local QA (browser/jsdom screenshots).
// It serves a fixed 2026 dataset captured from the public API on 2026-11-24 so
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

/** round -> race session key (the REAL OpenF1 2026 keys, captured 2026-11-24) */
const SESSION_KEYS = [11234, 11245, 11253, 11280, 11291, 11299, 11307, 11315, 11326, 11334,
  11342, 11353, 11361, 11369, 11377, 11731, 11388, 11396, 11404, 11412, 11420, 11428, 11436]

/**
 * Full classification per round, captured verbatim from OpenF1 session_result
 * on 2026-11-24 (Rd.21 Las Vegas latest). Row = [position, driver_number,
 * laps, points, status] with status 0=finish 1=DNF 2=DNS 3=DSQ and position 0
 * meaning "not classified".
 */
const RESULTS = {"1":[[1,63,58,25,0],[2,12,58,18,0],[3,16,58,15,0],[4,44,58,12,0],[5,1,58,10,0],[6,3,58,8,0],[7,87,57,6,0],[8,41,57,4,0],[9,5,57,2,0],[10,10,57,1,0],[11,31,57,0,0],[12,23,57,0,0],[13,30,57,0,0],[14,43,56,0,0],[15,55,56,0,0],[16,11,55,0,0],[0,18,43,0,0],[0,14,21,0,1],[0,77,15,0,1],[0,6,10,0,1],[0,81,0,0,2],[0,27,0,0,2]],"2":[[1,12,56,25,0],[2,63,56,18,0],[3,44,56,15,0],[4,16,56,12,0],[5,87,56,10,0],[6,10,56,8,0],[7,30,56,6,0],[8,6,56,4,0],[9,55,55,2,0],[10,43,55,1,0],[11,27,55,0,0],[12,41,55,0,0],[13,77,55,0,0],[14,31,55,0,0],[15,11,55,0,0],[0,3,45,0,1],[0,14,32,0,1],[0,18,9,0,1],[0,81,0,0,2],[0,1,0,0,2],[0,5,0,0,2],[0,23,0,0,2]],"3":[[1,12,53,25,0],[2,81,53,18,0],[3,16,53,15,0],[4,63,53,12,0],[5,1,53,10,0],[6,44,53,8,0],[7,10,53,6,0],[8,3,53,4,0],[9,30,53,2,0],[10,31,53,1,0],[11,27,53,0,0],[12,6,53,0,0],[13,5,53,0,0],[14,41,53,0,0],[15,55,53,0,0],[16,43,53,0,0],[17,11,53,0,0],[18,14,52,0,0],[19,77,52,0,0],[20,23,51,0,0],[0,18,30,0,1],[0,87,20,0,1]],"4":[[1,12,57,25,0],[2,1,57,18,0],[3,81,57,15,0],[4,63,57,12,0],[5,3,57,10,0],[6,44,57,8,0],[7,43,57,6,0],[8,16,57,4,0],[9,55,57,2,0],[10,23,57,1,0],[11,87,56,0,0],[12,5,56,0,0],[13,31,56,0,0],[14,41,56,0,0],[15,14,56,0,0],[16,11,56,0,0],[17,18,56,0,0],[18,77,55,0,0],[0,27,7,0,1],[0,30,6,0,1],[0,10,4,0,1],[0,6,4,0,1]],"5":[[1,12,68,25,0],[2,44,68,18,0],[3,3,68,15,0],[4,16,68,12,0],[5,6,67,10,0],[6,43,67,8,0],[7,30,67,6,0],[8,10,67,4,0],[9,55,67,2,0],[10,87,67,1,0],[11,81,66,0,0],[12,27,66,0,0],[13,5,66,0,0],[14,31,66,0,0],[15,18,64,0,0],[16,77,64,0,0],[0,11,39,0,1],[0,1,38,0,1],[0,63,29,0,1],[0,14,23,0,1],[0,23,11,0,1],[0,41,0,0,2]],"6":[[1,12,78,25,0],[2,44,78,18,0],[3,6,78,15,0],[4,81,78,12,0],[5,30,78,10,0],[6,41,78,8,0],[7,10,78,6,0],[8,23,78,4,0],[9,31,78,2,0],[10,14,78,1,0],[11,5,78,0,0],[12,63,78,0,0],[13,27,78,0,0],[14,43,78,0,0],[15,11,78,0,0],[16,55,70,0,1],[0,16,64,0,1],[0,18,56,0,1],[0,1,43,0,1],[0,87,27,0,1],[0,77,15,0,1],[0,3,0,0,1]],"7":[[1,44,66,25,0],[2,63,66,18,0],[3,1,66,15,0],[4,3,66,12,0],[5,81,66,10,0],[6,6,65,8,0],[7,10,65,6,0],[8,30,65,4,0],[9,41,65,2,0],[10,43,65,1,0],[11,5,64,0,0],[12,55,64,0,0],[13,31,64,0,0],[14,11,63,0,0],[15,16,62,0,1],[16,12,61,0,1],[17,87,60,0,1],[0,23,55,0,0],[0,14,37,0,1],[0,27,29,0,1],[0,77,15,0,1],[0,18,5,0,1]],"8":[[1,63,71,25,0],[2,3,71,18,0],[3,12,71,15,0],[4,81,71,12,0],[5,44,71,10,0],[6,6,71,8,0],[7,1,71,6,0],[8,16,71,4,0],[9,30,70,2,0],[10,41,70,1,0],[11,5,70,0,0],[12,27,70,0,0],[13,10,70,0,0],[14,87,70,0,0],[15,43,70,0,0],[16,31,69,0,0],[17,23,69,0,0],[18,14,68,0,0],[0,18,45,0,1],[0,55,23,0,1],[0,11,4,0,1],[0,77,2,0,1]],"9":[[1,16,52,25,0],[2,63,52,18,0],[3,44,52,15,0],[4,1,52,12,0],[5,6,52,10,0],[6,30,52,8,0],[7,41,52,6,0],[8,5,52,4,0],[9,43,52,2,0],[10,10,52,1,0],[11,81,52,0,0],[12,87,52,0,0],[13,31,52,0,0],[14,11,52,0,0],[15,12,52,0,0],[16,77,52,0,0],[17,55,51,0,0],[18,14,51,0,0],[19,18,51,0,0],[20,3,46,0,1],[0,23,43,0,1],[0,27,36,0,1]],"10":[[1,12,44,25,0],[2,16,44,18,0],[3,3,44,15,0],[4,44,44,12,0],[5,81,44,10,0],[6,6,44,8,0],[7,1,44,6,0],[8,5,44,4,0],[9,41,44,2,0],[10,43,44,1,0],[11,10,44,0,0],[12,30,44,0,0],[13,27,44,0,0],[14,87,44,0,0],[15,23,44,0,0],[16,55,44,0,0],[17,31,44,0,0],[18,77,43,0,0],[19,14,42,0,0],[0,18,25,0,1],[0,11,13,0,1],[0,63,0,0,1]],"11":[[1,1,70,25,0],[2,3,70,18,0],[3,12,70,15,0],[4,16,70,12,0],[5,44,70,10,0],[6,6,70,8,0],[7,63,70,6,0],[8,30,69,4,0],[9,27,69,2,0],[10,41,69,1,0],[11,5,69,0,0],[12,10,69,0,0],[13,18,69,0,0],[14,14,69,0,0],[15,43,68,0,0],[16,31,68,0,0],[17,23,68,0,0],[18,55,68,0,0],[19,87,68,0,0],[0,81,55,0,1],[0,11,48,0,1],[0,77,13,0,1]],"12":[[1,1,72,25,0],[2,12,72,18,0],[3,63,72,15,0],[4,44,72,12,0],[5,16,72,10,0],[6,81,72,8,0],[7,30,72,6,0],[8,27,71,4,0],[9,14,71,2,0],[10,10,71,1,0],[11,22,71,0,0],[12,41,71,0,0],[13,5,71,0,0],[14,43,70,0,0],[15,11,70,0,0],[16,55,70,0,0],[17,23,66,0,1],[0,77,61,0,1],[0,31,52,0,1],[0,18,45,0,1],[0,87,2,0,1],[0,3,0,0,1]],"13":[[1,12,53,25,0],[2,63,53,18,0],[3,3,53,15,0],[4,1,53,12,0],[5,81,53,10,0],[6,44,53,8,0],[7,10,53,6,0],[8,41,53,4,0],[9,43,53,2,0],[10,22,53,1,0],[11,5,53,0,0],[12,27,53,0,0],[13,55,53,0,0],[14,30,53,0,0],[15,87,53,0,0],[16,31,52,0,0],[17,23,52,0,0],[18,11,52,0,0],[19,77,51,0,0],[0,18,26,0,1],[0,14,23,0,1],[0,16,1,0,1]],"14":[[1,12,57,25,0],[2,3,57,18,0],[3,1,57,15,0],[4,16,57,12,0],[5,63,57,10,0],[6,30,57,8,0],[7,43,57,6,0],[8,81,57,4,0],[9,41,56,2,0],[10,27,56,1,0],[11,31,56,0,0],[12,10,56,0,0],[13,5,56,0,0],[14,22,56,0,0],[15,23,56,0,0],[16,87,56,0,0],[17,14,55,0,0],[18,77,54,0,0],[0,55,43,0,1],[0,11,31,0,1],[0,18,12,0,1],[0,44,6,0,1]],"15":[[1,63,51,25,0],[2,3,51,18,0],[3,6,51,15,0],[4,16,51,12,0],[5,12,51,10,0],[6,44,51,8,0],[7,41,51,6,0],[8,31,51,4,0],[9,87,51,2,0],[10,55,51,1,0],[11,27,51,0,0],[12,30,51,0,0],[13,81,51,0,0],[14,11,51,0,0],[15,5,51,0,0],[16,77,49,0,1],[0,43,36,0,1],[0,10,35,0,1],[0,1,35,0,1],[0,23,29,0,1],[0,14,20,0,1],[0,18,7,0,1]],"16":[[1,3,55,25,0],[2,12,55,18,0],[3,44,55,15,0],[4,16,55,12,0],[5,6,55,10,0],[6,81,55,8,0],[7,30,55,6,0],[8,14,55,4,0],[9,1,55,2,0],[10,41,55,1,0],[11,27,55,0,0],[12,18,55,0,0],[13,43,55,0,0],[14,87,55,0,0],[15,31,55,0,0],[16,10,55,0,0],[17,55,55,0,0],[18,5,55,0,0],[19,11,55,0,0],[20,63,49,0,1],[0,23,41,0,1],[0,77,7,0,1]],"17":[[1,3,62,25,0],[2,16,62,18,0],[3,12,62,15,0],[4,1,62,12,0],[5,81,62,10,0],[6,44,62,8,0],[7,30,62,6,0],[8,27,62,4,0],[9,63,62,2,0],[10,6,62,1,0],[11,10,61,0,0],[12,87,61,0,0],[13,31,61,0,0],[14,55,61,0,0],[15,41,61,0,0],[16,14,61,0,0],[17,11,60,0,0],[18,23,59,0,1],[19,77,59,0,0],[0,18,36,0,1],[0,43,29,0,1],[0,5,7,0,1]],"18":[[1,12,56,25,0],[2,16,56,18,0],[3,3,56,15,0],[4,44,56,12,0],[5,1,56,10,0],[6,6,56,8,0],[7,81,56,6,0],[8,63,56,4,0],[9,30,56,2,0],[10,10,56,1,0],[11,27,56,0,0],[12,41,55,0,0],[13,5,55,0,0],[14,31,55,0,0],[15,18,55,0,0],[16,14,55,0,0],[17,23,55,0,0],[18,55,55,0,0],[19,11,55,0,0],[0,77,48,0,1],[0,43,35,0,1],[0,87,24,0,1]],"19":[[1,3,71,25,0],[2,44,71,18,0],[3,12,71,15,0],[4,16,71,12,0],[5,1,71,10,0],[6,63,71,8,0],[7,30,71,6,0],[8,5,71,4,0],[9,6,71,2,0],[10,50,71,1,0],[11,23,71,0,0],[12,55,71,0,0],[13,81,71,0,0],[14,27,71,0,0],[15,43,71,0,0],[16,11,71,0,0],[17,10,71,0,0],[0,41,58,0,1],[0,87,47,0,1],[0,77,42,0,1],[0,18,5,0,1],[0,14,5,0,1]],"20":[[1,1,71,25,0],[2,3,71,18,0],[3,6,71,15,0],[4,63,71,12,0],[5,12,71,10,0],[6,81,71,8,0],[7,30,71,6,0],[8,16,71,4,0],[9,44,70,2,0],[10,27,70,1,0],[11,41,70,0,0],[12,14,70,0,0],[13,43,70,0,0],[14,10,70,0,0],[15,23,70,0,0],[16,5,70,0,0],[17,87,70,0,0],[18,11,69,0,0],[19,55,69,0,0],[20,51,69,0,0],[0,18,30,0,1],[0,77,0,0,2]],"21":[[1,3,50,25,0],[2,1,50,18,0],[3,81,50,15,0],[4,12,50,12,0],[5,10,50,10,0],[6,43,50,8,0],[7,44,50,6,0],[8,55,50,4,0],[9,63,50,2,0],[10,16,50,1,0],[11,27,50,0,0],[12,5,50,0,0],[13,87,50,0,0],[14,30,50,0,0],[15,6,50,0,0],[16,51,50,0,0],[17,18,50,0,0],[18,77,50,0,0],[19,14,49,0,1],[0,41,19,0,1],[0,11,17,0,1],[0,23,0,0,2]]}

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
    is_cancelled: false
  }
})

function sessionResult(sessionKey, positionFilter) {
  const idx = SESSION_KEYS.indexOf(Number(sessionKey))
  const round = idx >= 0 ? idx + 1 : null
  let rows = RESULTS[String(round)]
  if (!rows) return []
  // honour OpenF1's `position<=N` / `position=N` selector (the raw query has to
  // be parsed here because `<=` splits into a `position<` key in URLSearchParams)
  if (positionFilter) {
    rows = positionFilter.lte
      ? rows.filter(([position]) => position >= 1 && position <= positionFilter.n)
      : rows.filter(([position]) => position === positionFilter.n)
  }
  return rows.map(([position, number, laps, points, st]) => ({
    position: position || null,
    driver_number: number,
    number_of_laps: laps,
    points,
    dnf: st === 1,
    dns: st === 2,
    dsq: st === 3,
    duration: position === 1 ? 0 : null,
    gap_to_leader: position === 1 ? 0 : null,
    meeting_key: 1279 + idx,
    session_key: Number(sessionKey)
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
    if (p.endsWith('/session_result')) {
      const sel = decodeURIComponent(url.search).match(/[?&]position(<?)=\s*(\d+)/)
      return json(res, sessionResult(q.get('session_key'), sel ? { lte: sel[1] === '<', n: Number(sel[2]) } : null))
    }
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
      return json(res, (RESULTS['21'] || []).slice(0, 8).map(([position, number], i) => ({
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
