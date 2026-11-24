#!/usr/bin/env node
// One-off generator for the bundled 2026 snapshot.
//
// The values below were read from the public OpenF1 API on 2026-11-23
// (endpoints: /v1/sessions, /v1/session_result, /v1/championship_drivers,
// /v1/championship_teams). Keeping a baked copy means GitHub Pages still shows
// the current season when the live API is unreachable; the live tiers in
// api.js/f1data.js overwrite it as soon as a request succeeds.
//
// Round winners come from session_result?position<=3 of each round's race
// session. Rounds 4 (Bahrain) and 5 (Saudi Arabia) are cancelled by OpenF1.
// Qatar (Rd.24) and Abu Dhabi (Rd.25) had not been run yet at capture time.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'server', 'data')

const rawCal = JSON.parse(fs.readFileSync(path.join(DATA, 'calendar.json'), 'utf8'))
// tolerate both the old flat array and the current {season,races} payload
const calendar = Array.isArray(rawCal) ? rawCal : (rawCal.races || [])
const drivers = JSON.parse(fs.readFileSync(path.join(DATA, 'drivers.json'), 'utf8'))
const ja = new Map(drivers.map((d) => [String(d.number), d]))
const teamName = { mercedes: 'Mercedes', ferrari: 'Ferrari', 'red-bull': 'Red Bull Racing', mclaren: 'McLaren' }

/** round -> [winnerNumber, constructorTeamId] (OpenF1 session_result P1) */
// official 23-round calendar: rounds 4/5 are no longer the cancelled Bahrain/
// Saudi Arabia GPs (Bahrain moved to Sepang = Rd.16)
const winners = {
  1: [63, 'mercedes'], 2: [12, 'mercedes'], 3: [12, 'mercedes'],
  4: [12, 'mercedes'], 5: [12, 'mercedes'], 6: [12, 'mercedes'],
  7: [44, 'ferrari'], 8: [63, 'mercedes'], 9: [16, 'ferrari'],
  10: [12, 'mercedes'], 11: [1, 'mclaren'], 12: [1, 'mclaren'],
  13: [12, 'mercedes'], 14: [12, 'mercedes'], 15: [63, 'mercedes'],
  16: [3, 'red-bull'], 17: [3, 'red-bull'], 18: [12, 'mercedes'],
  19: [3, 'red-bull'], 20: [1, 'mclaren'], 21: [3, 'red-bull']
}
const cancelled = new Set([])
const RETRIEVED = '2026-11-23T00:00:00Z'

const rounds = calendar.map((c) => {
  const w = winners[c.round]
  const d = w ? ja.get(String(w[0])) : null
  const done = Boolean(w)
  return {
    round: c.round,
    name: c.name,
    nameJa: c.nameJa || c.name,
    circuit: c.circuit,
    country: c.country,
    flag: c.flag || '',
    date: c.date,
    status: cancelled.has(c.round) ? 'cancelled' : done ? 'completed' : 'upcoming',
    winner: w && d ? { number: d.number, name: d.name, nameJa: d.nameJa, team: teamName[w[1]] } : null,
    provider: 'OpenF1'
  }
})

fs.writeFileSync(
  path.join(DATA, 'results-2026.json'),
  JSON.stringify({
    season: 2026,
    source: 'OpenF1 API (api.openf1.org/v1)',
    provider: 'OpenF1',
    retrievedAt: RETRIEVED,
    note: '2026年シーズンのバンドルスナップショット。ライブ到達時は API の結果が優先されます。',
    rounds
  }, null, 2)
)

/** championship after Rd.23 (Las Vegas), captured from championship_* endpoints */
const wdcRaw = [
  [1, 12, 402], [2, 3, 304], [3, 44, 267], [4, 63, 264], [5, 1, 264],
  [6, 16, 250], [7, 81, 167], [8, 6, 122], [9, 30, 89], [10, 10, 52],
  [11, 41, 38], [12, 43, 35], [13, 87, 23], [14, 5, 14], [15, 27, 14],
  [16, 55, 11], [17, 31, 7], [18, 14, 7], [19, 23, 5], [20, 22, 1],
  [21, 50, 1], [22, 18, 0], [23, 77, 0], [24, 11, 0], [25, 51, 0]
]
const wdc = wdcRaw.map(([position, number, points]) => {
  const d = ja.get(String(number))
  return {
    position,
    number,
    name: d?.name || `#${number}`,
    nameJa: d?.nameJa || '',
    team: d ? teamName[d.team] || d.team : '',
    points
  }
})
const wcc = [
  [1, 'Mercedes', 666], [2, 'Ferrari', 517], [3, 'Red Bull Racing', 440],
  [4, 'McLaren', 431], [5, 'Racing Bulls', 114], [6, 'Alpine', 87],
  [7, 'Haas F1 Team', 31], [8, 'Audi', 28], [9, 'Williams', 16],
  [10, 'Aston Martin', 7], [11, 'Cadillac', 0]
].map(([position, name, points]) => ({ position, name, points }))

fs.writeFileSync(
  path.join(DATA, 'standings-2026.json'),
  JSON.stringify({
    season: 2026,
    source: 'OpenF1 API (api.openf1.org/v1) — championship after Rd.23 (Las Vegas)',
    provider: 'OpenF1',
    retrievedAt: RETRIEVED,
    note: '#31/#22/#50 はドライバー名が公開APIに未掲載のためナンバー表示。',
    drivers: wdc,
    constructors: wcc
  }, null, 2)
)

console.log('[gen-2026-snapshot] wrote results-2026.json + standings-2026.json')
