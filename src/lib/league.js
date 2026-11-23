// ============================================================================
// PITWALL — prediction leagues (マルチ予測リーグ)
// ----------------------------------------------------------------------------
// Up to N parallel "leagues" (different rule-sets), each with its own entries
// and standings. Persisted in localStorage so it works on static hosts.
// Scoring: exact P1 = 3 pts, any top-3/top-10 hit = 2 pts, FL in top10 = 1 pt.
// ============================================================================

import { load, save } from './store.js'

export const LEAGUE_KEY = 'leagues'
const DEFAULTS = {
  'front-runners': { name: 'フロントランナー賞', nameEn: 'Front Runners', descJa: 'P1予想の精度を競う', descEn: 'Exact P1 accuracy', metric: 'p1' },
  'top3-challenge': { name: 'TOP3チャレンジ', nameEn: 'Top 3 Challenge', descJa: '表彰台の3人を当てる', descEn: 'Hit the podium', metric: 'top3' },
  'fastest-lap': { name: 'ファステストラップ', nameEn: 'Fastest Lap', descJa: 'FLを的中させる', descEn: 'Pick the fastest lap', metric: 'fl' }
}

function mk(name, opts) {
  return { id: opts.id, name, nameEn: opts.nameEn || name, descJa: opts.descJa || '', descEn: opts.descEn || '', metric: opts.metric || 'p1', created: new Date().toISOString(), entries: [] }
}

export function loadLeagues() {
  const stored = load(LEAGUE_KEY, null)
  if (!stored?.length) {
    const out = Object.entries(DEFAULTS).map(([id, o]) => mk(o.name, { ...o, id }))
    for (const l of out) l.entries = seedBots(l)
    save(LEAGUE_KEY, out)
    return out
  }
  return stored.map((l) => ({ ...mk(l.name, { ...DEFAULTS[l.id], id: l.id }), ...l }))
}

function seedBots() {
  return [
    { id: 'bot-suzuki', name: 'Suzuki@Saitama', team: 'red-bull', points: 0, picks: {} },
    { id: 'bot-tanaka', name: 'Tanaka@Osaka', team: 'ferrari', points: 0, picks: {} },
    { id: 'bot-kobayashi', name: 'Kobayashi@Tokyo', team: 'mclaren', points: 0, picks: {} },
    { id: 'bot-watanabe', name: 'Watanabe@Nagoya', team: 'mercedes', points: 0, picks: {} }
  ]
}

export function saveLeagues(list) { save(LEAGUE_KEY, list); return list }

/** fan profile persisted across leagues */
export function leagueProfile() {
  return load('leagueProfile', { name: 'YOU', joined: {}, rounds: {} })
}
export function saveLeagueProfile(p) { save('leagueProfile', p); return p }

/** join a league as the fan */
export function joinLeague(list, leagueId, name) {
  const prof = leagueProfile()
  const joined = { ...prof.joined, [leagueId]: true }
  const me = { id: 'me', me: true, name: name || prof.name || 'YOU', team: prof.team, points: 0, picks: {} }
  const next = list.map((l) => (l.id === leagueId ? { ...l, entries: [...l.entries.filter((e) => !e.me), me] } : l))
  saveLeagueProfile({ ...prof, joined, name: name || prof.name })
  return next
}

/** set the fan's picks for one league; missing bot picks are generated */
export function setMyPicks(list, leagueId, picks) {
  const roundKey = `${leagueId}:${new Date().toISOString().slice(0, 10)}`
  const driversForBots = picks.__drivers || []
  const clean = { p1: picks.p1, p2: picks.p2, p3: picks.p3, fl: picks.fl }
  const next = list.map((l) => {
    if (l.id !== leagueId) return l
    const entries = l.entries.map((e) => {
      if (e.me) return { ...e, picks: { ...e.picks, [roundKey]: clean } }
      const existing = e.picks?.[roundKey]
      if (existing?.p1) return e
      return { ...e, picks: { ...e.picks, [roundKey]: botPicks(driversForBots) } }
    })
    return { ...l, entries }
  })
  const prof = leagueProfile()
  saveLeagueProfile({ ...prof, rounds: { ...prof.rounds, [roundKey]: true } })
  return next
}

function botPicks(drivers) {
  const pool = (drivers || []).filter((d) => d?.id)
  const byRating = [...pool].sort((a, b) => (b.rating || 80) - (a.rating || 80))
  const p1 = byRating[Math.floor(Math.random() * Math.min(3, byRating.length))]?.id
  const fl = byRating[Math.floor(Math.random() * Math.min(5, byRating.length))]?.id
  return { p1, p2: null, p3: null, fl }
}

/** points a single result row earns against picks, per metric */
export function pointsFor(driverId, position, picks, metric) {
  if (!picks) return 0
  if (metric === 'p1') return driverId === picks.p1 ? 3 : 0
  if (metric === 'fl') return driverId === picks.fl && position <= 10 ? 3 : 0
  // top3
  let pts = 0
  if ([picks.p1, picks.p2, picks.p3].includes(driverId) && position <= 3) pts += 2
  if (driverId === picks.fl && position <= 10) pts += 1
  return pts
}

/**
 * Score one race across every league.
 * @param raceName string, result [{driverId, position}]
 */
export function scoreRaceForLeagues(list, raceName, result) {
  const prof = leagueProfile()
  const updated = list.map((l) => {
    const roundKey = Object.keys(prof.rounds || {}).find((k) => k.startsWith(`${l.id}:`)) ||
      [...l.entries.flatMap((e) => Object.keys(e.picks || {}))].find((k) => k.startsWith(`${l.id}:`))
    if (!roundKey) return l
    const entries = l.entries.map((e) => {
      const picks = e.picks?.[roundKey]
      if (!picks?.p1 && !picks?.fl) return e
      let gained = 0
      for (const r of result || []) gained += pointsFor(r.driverId, r.position, picks, l.metric)
      return { ...e, points: (e.points || 0) + gained }
    })
    return { ...l, entries, lastScored: { raceName, at: new Date().toISOString() } }
  })
  return updated
}

/** sorted standings for a league */
export function standings(l) {
  return [...(l.entries || [])].sort((a, b) => (b.points || 0) - (a.points || 0))
}
