// ============================================================================
// PITWALL — prediction scoring against REAL race results
// ----------------------------------------------------------------------------
// Points are only awarded from published classifications (live API, cached
// copy, or the bundled official snapshot). Nothing is simulated.
//
// Rules (see docs/DESIGN.md §21):
//   P1 exact 10 · P1 on podium 4 · P1 in top-10 1
//   P2 exact  8 · P2 on podium 3
//   P3 exact  6 · P3 on podium 2
//   FL exact  5 · FL in top-10 1
//   Sweep bonus +5 when P1/P2/P3 are all exact
// Accuracy = exact-category hits / categories whose position is known.
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')

const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'))
const DRIVERS = read('drivers.json')
const BY_NUMBER = new Map(DRIVERS.map((d) => [String(d.number), d]))
const BY_NAME = new Map()
for (const d of DRIVERS) {
  for (const n of [d.name, d.nameJa]) {
    if (!n) continue
    BY_NAME.set(String(n).toLowerCase().replace(/[^a-zぁ-んァ-ヶ一-龥ー]/g, ''), d)
  }
}

export function driverIdForNumber(number) {
  return BY_NUMBER.get(String(number))?.id || null
}

export function driverIdForName(name) {
  const key = String(name || '').toLowerCase().replace(/[^a-zぁ-んァ-ヶ一-龥ー]/g, '')
  if (!key) return null
  if (BY_NAME.has(key)) return BY_NAME.get(key).id
  // tolerate "Sergio Pérez" vs "セルヒオ・ペレス" style mismatches by prefix
  for (const [k, d] of BY_NAME) if (k.startsWith(key.slice(0, 6)) || key.startsWith(k.slice(0, 6))) return d.id
  return null
}

/**
 * Normalise a classification row (Jolpica/OpenF1/bundled shapes) into a map of
 * driverId -> position. Unknown drivers are skipped, never guessed.
 */
export function indexRows(rows) {
  const out = new Map()
  for (const r of rows || []) {
    const pos = Number(r.position ?? r.pos)
    if (!pos) continue
    const id = r.driverId || driverIdForNumber(r.number ?? r.driver_number) ||
      (r.driver ? driverIdForName(r.driver) : null)
    if (id && !out.has(id)) out.set(id, pos)
  }
  return out
}

/** Pick ids must all exist; validation happens before storage. */
export function isValidPick(ids) {
  return ids.every((id) => id == null || DRIVERS.some((d) => d.id === id))
}

/**
 * @param positions Map<driverId, position> (only known positions)
 * @param picks {p1,p2,p3,fl}
 */
export function scorePicks(positions, picks = {}, flDriverId = null) {
  const breakdown = { p1: 0, p2: 0, p3: 0, fl: 0, bonus: 0 }
  let known = 0
  let exact = 0
  let scoringHits = 0

  const cat = (key, id, rules) => {
    if (!id) return
    const pos = positions.get(id)
    if (pos == null) return
    known++
    if (pos === rules.exactPos) { breakdown[key] += rules.exact; exact++; scoringHits++ }
    else if (pos <= rules.podium) { breakdown[key] += rules.podiumPts; scoringHits++ }
    else if (pos <= 10 && rules.top10) { breakdown[key] += rules.top10; scoringHits++ }
  }

  cat('p1', picks.p1, { exactPos: 1, exact: 10, podium: 4, top10: 1 })
  cat('p2', picks.p2, { exactPos: 2, exact: 8, podium: 3, top10: 0 })
  cat('p3', picks.p3, { exactPos: 3, exact: 6, podium: 2, top10: 0 })

  // Fastest lap is an identity call: the exact credit does not depend on where
  // that driver finished, while the top-10 consolation does.
  if (flDriverId && picks.fl) {
    known++
    if (picks.fl === flDriverId) { breakdown.fl += 5; exact++; scoringHits++ }
    else {
      const pos = positions.get(picks.fl)
      if (pos != null && pos <= 10) { breakdown.fl += 1; scoringHits++ }
    }
  }

  if (picks.p1 && picks.p2 && picks.p3 &&
      positions.get(picks.p1) === 1 && positions.get(picks.p2) === 2 && positions.get(picks.p3) === 3) {
    breakdown.bonus = 5
  }

  const points = Object.values(breakdown).reduce((a, b) => a + b, 0)
  return {
    points,
    breakdown,
    known,
    exact,
    hits: scoringHits,
    hitRate: known ? scoringHits / known : 0,
    accuracy: known ? exact / known : 0,
    perfect: points >= 30
  }
}

function bundledRound(year, round) {
  const file = path.join(DATA_DIR, `results-${year}.json`)
  if (!fs.existsSync(file)) return null
  try {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'))
    return d.rounds.find((r) => Number(r.round) === Number(round)) || null
  } catch {
    return null
  }
}

/**
 * Build the authoritative result index for one race.
 * Order: live/cached classification → bundled official snapshot.
 * @returns {{positions:Map, provider:string, source:string, known:string[]}|null}
 */
export async function buildResultIndex(year, round, { classification } = {}) {
  const rows = Array.isArray(classification) ? classification : []
  if (rows.length) {
    const positions = indexRows(rows)
    if (positions.size >= 10) {
      return { positions, flDriverId: flFromRows(rows), provider: 'classification', source: 'live', known: [] }
    }
  }
  const bundled = bundledRound(year, round)
  if (!bundled || bundled.status === 'upcoming' || bundled.status === 'cancelled') return null
  const positions = new Map()
  const known = []
  const put = (driverId, pos, label) => {
    if (!driverId || positions.has(driverId)) return
    positions.set(driverId, pos)
    known.push(label)
  }
  const w = bundled.winner
  if (w) put(w.driverId || driverIdForNumber(w.number) || driverIdForName(w.name), 1, 'p1')
  for (const p of bundled.podium || []) {
    put(p.driverId || driverIdForNumber(p.number) || driverIdForName(p.name), Number(p.position), 'podium')
  }
  const flId = driverIdForName(bundled.fastestLap)
  if (!positions.size && !flId) return null
  return { positions, flDriverId: flId || null, provider: 'bundled official results', source: 'bundle', known: [] }
}

/** The classification carries fastest-lap info only via the API's own field. */
function flFromRows(rows) {
  const row = (rows || []).find((r) => r.fastest_lap || r.fastestLap)
  if (!row) return null
  return driverIdForNumber(row.number ?? row.driver_number) ||
    (row.driver ? driverIdForName(row.driver) : null)
}

/** Categories whose real position is known (used for honest accuracy). */
function knownCategories(positions) {
  const out = []
  if ([...positions.values()].includes(1)) out.push('p1')
  if ([...positions.values()].includes(2)) out.push('p2')
  if ([...positions.values()].includes(3)) out.push('p3')
  if ([...positions.values()].some((v) => v > 3)) out.push('fl')
  return out
}

export function raceDate(year, round) {
  try {
    const cal = read('calendar.json')
    const r = (cal.races || []).find((x) => Number(x.round) === Number(round))
    return r?.date || null
  } catch {
    return null
  }
}

export function isRaceComplete(year, round) {
  const date = raceDate(year, round)
  if (!date) return true // no calendar entry: allow scoring if a result exists
  return new Date(`${date}T23:59:59Z`) < new Date()
}
