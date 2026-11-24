// ============================================================================
// PITWALL — persistent prediction + league store (real-result scoring)
// ----------------------------------------------------------------------------
// Files live next to the bundled data but are runtime state (git-ignored):
//   server/data/predictions-v2.json   one row per account per round
//   server/data/leagues-v2.json       shared leagues (accounts + house bots)
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const PREDS_FILE = path.join(DATA_DIR, 'predictions-v2.json')
const LEAGUES_FILE = path.join(DATA_DIR, 'leagues-v2.json')

import { scorePicks as scorePicksImported } from './scoring.js'

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}
const writeJson = (file, value) => {
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2))
  fs.renameSync(tmp, file)
}

export function loadPreds() {
  const d = readJson(PREDS_FILE, { preds: [] })
  return Array.isArray(d.preds) ? d : { preds: [] }
}
export function savePreds(db) { writeJson(PREDS_FILE, db) }

// ---------------------------------------------------------------------------
// leagues
// ---------------------------------------------------------------------------

export const DEFAULT_LEAGUES = [
  { id: 'front-runners', name: 'フロントランナー賞', nameEn: 'Front Runners', descJa: 'P1予想の精度を競う', descEn: 'Exact P1 accuracy', metric: 'p1' },
  { id: 'top3-challenge', name: 'TOP3チャレンジ', nameEn: 'Top 3 Challenge', descJa: '表彰台の3人を当てる', descEn: 'Hit the podium', metric: 'top3' },
  { id: 'fastest-lap', name: 'ファステストラップ賞', nameEn: 'Fastest Lap', descJa: 'FLを的中させる', descEn: 'Pick the fastest lap', metric: 'fl' }
]

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** House rivals: their picks are deterministic so standings stay reproducible. */
const BOTS = [
  { id: 'bot-suzuki', name: 'Suzuki@Saitama', team: 'red-bull' },
  { id: 'bot-tanaka', name: 'Tanaka@Osaka', team: 'ferrari' },
  { id: 'bot-kobayashi', name: 'Kobayashi@Tokyo', team: 'mclaren' },
  { id: 'bot-watanabe', name: 'Watanabe@Nagoya', team: 'mercedes' }
]

/** Deterministic pseudo-picks: stable rivals, no Math.random in scores. */
export function botPicksFor(seedKey, drivers) {
  const pool = [...drivers].sort((a, b) => (b.rating || 80) - (a.rating || 80))
  const h = hash(seedKey)
  const order = [...pool].sort((a, b) => (hash(seedKey + a.id) % 997) - (hash(seedKey + b.id) % 997))
  const three = order.slice(0, 3)
  const flPool = order.slice(0, 10)
  return {
    p1: three[0]?.id || null,
    p2: three[1]?.id || null,
    p3: three[2]?.id || null,
    fl: flPool[h % Math.max(1, flPool.length)]?.id || null
  }
}

export function loadLeagues(drivers = []) {
  const d = readJson(LEAGUES_FILE, { leagues: [] })
  if (Array.isArray(d.leagues) && d.leagues.length) return d
  const leagues = DEFAULT_LEAGUES.map((l) => ({
    ...l, created: new Date().toISOString(),
    entries: BOTS.map((b) => ({ ...b, kind: 'bot', points: 0, byRound: {}, picks: {} }))
  }))
  writeJson(LEAGUES_FILE, { leagues })
  return { leagues }
}

export function saveLeagues(db) { writeJson(LEAGUES_FILE, db) }

export function findLeague(db, id) {
  return db.leagues.find((l) => l.id === id) || null
}

export function joinLeague(db, leagueId, user) {
  const league = findLeague(db, leagueId)
  if (!league) return null
  league.entries = league.entries.filter((e) => !(e.kind === 'user' && e.userId === user.id))
  league.entries.push({
    id: `u-${user.id}`, kind: 'user', userId: user.id, name: user.name || user.username,
    team: user.profile?.team || '', points: 0, byRound: {}, picks: {}
  })
  saveLeagues(db)
  return league
}

export function setEntryPicks(db, leagueId, entryId, roundKey, picks) {
  const league = findLeague(db, leagueId)
  if (!league) return null
  const entry = league.entries.find((e) => e.id === entryId)
  if (!entry) return null
  entry.picks = { ...(entry.picks || {}), [roundKey]: picks }
  saveLeagues(db)
  return entry
}

/**
 * Apply a real result to every entry of a league for one round.
 * Bots without explicit picks receive deterministic ones, so rival leagues
 * always have a comparable score.
 */
export function scoreLeague(db, league, year, round, index, drivers) {
  const roundKey = `${year}:${round}`
  for (const entry of league.entries) {
    let picks = entry.picks?.[roundKey]
    if (!picks || (!picks.p1 && !picks.fl)) {
      picks = botPicksFor(`${league.id}:${entry.id}:${roundKey}`, drivers)
      entry.picks = { ...(entry.picks || {}), [roundKey]: picks }
    }
    const scored = index
      ? scoreForMetric(index, picks, league.metric)
      : { points: 0, breakdown: {}, known: 0, exact: 0, hits: 0, hitRate: 0, accuracy: 0 }
    entry.byRound = { ...(entry.byRound || {}), [roundKey]: scored }
    entry.points = Object.values(entry.byRound).reduce((sum, s) => sum + (s?.points || 0), 0)
  }
  league.lastScored = { year, round, at: new Date().toISOString() }
  return league
}

function scoreForMetric(index, picks, metric) {
  // reuse the same engine as predictions, then filter to the league's category
  const full = scorePicksImported(index.positions, picks, index.flDriverId)
  if (metric === 'p1') {
    const pts = full.breakdown.p1
    return { ...full, points: pts, breakdown: { p1: pts }, metric }
  }
  if (metric === 'fl') {
    const pts = full.breakdown.fl
    return { ...full, points: pts, breakdown: { fl: pts }, metric }
  }
  const pts = full.breakdown.p1 + full.breakdown.p2 + full.breakdown.p3 + full.breakdown.bonus
  return { ...full, points: pts, breakdown: { p1: full.breakdown.p1, p2: full.breakdown.p2, p3: full.breakdown.p3, bonus: full.breakdown.bonus }, metric }
}


export function standings(league) {
  return [...league.entries].sort((a, b) => (b.points || 0) - (a.points || 0))
}
