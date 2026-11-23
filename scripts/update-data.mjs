#!/usr/bin/env node
// ============================================================================
// PITWALL data updater — run this on any machine WITH internet access
// (cron / CI / local) to refresh the bundled snapshot used by the site.
//
//   node scripts/update-data.mjs            # current season
//   node scripts/update-data.mjs 2026       # specific season
//
// Output: server/data/snapshot.json  (used by /api when live APIs are
// unreachable; also warmed automatically by the server every 5 minutes
// when it *is* reachable).
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'server', 'data')
const JOLPICA = 'https://api.jolpica.org/f1'
const OPENF1 = 'https://api.openf1.org/v1'

const year = Number(process.argv[2]) || new Date().getFullYear()

async function getJSON(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'pitwall-updater/0.1' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const rows = (d) => (Array.isArray(d) ? d : d?.results ?? [])

console.log(`PITWALL updater → season ${year}`)

let races = []
try {
  const d = await getJSON(`${JOLPICA}/${year}/races/?limit=100`)
  races = rows(d).map((r) => ({
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
  console.log(`  races: ${races.length}`)
} catch (e) {
  console.warn(`  races: FAILED (${e.message})`)
}

let drivers = []
try {
  const d = await getJSON(`${JOLPICA}/${year}/drivers/?limit=100`)
  drivers = rows(d).map((r) => ({
    position: r.position,
    name: r.driver_name ?? r.name,
    team: r.team_name ?? r.constructor_name ?? '',
    points: r.points ?? 0,
    wins: r.wins ?? 0
  }))
  console.log(`  drivers standings: ${drivers.length}`)
} catch (e) {
  console.warn(`  drivers: FAILED (${e.message})`)
}

let constructors = []
try {
  const d = await getJSON(`${JOLPICA}/${year}/constructors/?limit=100`)
  constructors = rows(d).map((r) => ({
    position: r.position,
    name: r.team_name ?? r.constructor_name ?? r.name,
    points: r.points ?? 0,
    wins: r.wins ?? 0
  }))
  console.log(`  constructors standings: ${constructors.length}`)
} catch (e) {
  console.warn(`  constructors: FAILED (${e.message})`)
}

let sessions = []
try {
  const d = await getJSON(`${OPENF1}/meetings?year=${year}`)
  sessions = rows(d).map((m) => ({ key: m.meeting_key, name: m.meeting_name, country: m.country_name, start: m.date_start, end: m.date_end }))
  console.log(`  openf1 meetings: ${sessions.length}`)
} catch (e) {
  console.warn(`  openf1: FAILED (${e.message})`)
}

if (!races.length && !drivers.length && !constructors.length) {
  console.error('\nNo live data could be fetched (no internet or API down). Snapshot NOT updated.')
  process.exit(1)
}

const snapshot = {
  year,
  updatedAt: new Date().toISOString(),
  source: 'jolpica/openf1',
  races, drivers, constructors, sessions
}
fs.writeFileSync(path.join(DATA_DIR, 'snapshot.json'), JSON.stringify(snapshot, null, 2))
console.log(`\n✔ snapshot written: server/data/snapshot.json (${new Date().toLocaleString()})`)
console.log('  The site will now serve this data when live APIs are unreachable.')
