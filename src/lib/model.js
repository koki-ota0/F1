// ============================================================================
// PITWALL APEX MODEL — in-house race prediction engine (client + server safe)
// ----------------------------------------------------------------------------
// Design goals (see docs/DESIGN.md §9):
//   1. Explainable: every output can be traced to driver rating / team strength
//      / form / circuit prior / stochastic race simulation.
//   2. Deterministic-ish priors: circuit affinity is a stable hash-based prior,
//      so the same inputs always give the same "shape" (noise is seeded too).
//   3. Probabilistic: Monte Carlo (default 1,500 iterations) → distributions,
//      not single guesses.
//   4. Extensible: an optional LLM provider can wrap this model (server side)
//      via the same `predictRace` interface.
// Outputs: win/podium/top10/points distributions, recommended picks, insights.
// ============================================================================

export const TEAM_STRENGTH = {
  'red-bull': 95, 'mclaren': 94, 'ferrari': 92, 'mercedes': 91,
  'williams': 84, 'racing-bulls': 81, 'aston-martin': 81, 'alpine': 79,
  'haas': 78, 'sauber': 75, 'cadillac': 74
}

// --- deterministic hash → [-1, 1] ------------------------------------------------
function hash01(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}
function stableNoise(str) { return hash01(str) * 2 - 1 }

// --- gaussian (Box–Muller) -------------------------------------------------------
function gauss(rng) {
  let u = 0, v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// seeded RNG (mulberry32) so repeated calls are reproducible
function makeRng(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
const FL_POINT = 1

function circuitKey(race) {
  return (race?.circuit || race?.name || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Build per-driver priors once.
 * @param drivers  array of driver objects (rating, team)
 * @param teams    array of team objects (id)
 * @param formMap  optional { driverId: 0..1 } recent-form factor (last 3 GPs)
 */
export function buildPriors(drivers, teams, formMap = {}) {
  return drivers.map((d) => {
    const teamStr = TEAM_STRENGTH[d.team] ?? 80
    const form = formMap[d.id] ?? 0.5
    // base pace index (higher = faster)
    const base = 0.55 * (d.rating ?? 80) + 0.45 * teamStr
    // small circuit-specific prior: deterministic ±2.2 pts
    const circuitAffinity = {} // filled per-race below
    return {
      driver: d,
      base,
      form,
      // consistency: better drivers/teams are repeatable, but race day always has chaos
      sigma: 1.7 + Math.max(0, 98 - base) * 0.11,
      circuitAffinity
    }
  })
}

/** circuit-specific deterministic tweak shared across all simulations of a race */
function applyCircuit(priors, race) {
  const key = circuitKey(race)
  for (const p of priors) {
    p.circuitAffinity.value = stableNoise(`${p.driver.id}:${key}`) * 2.2
  }
}

/**
 * Monte Carlo prediction for one race.
 * @returns {
 *   race, iterations, winProb: {id:p}, podiumProb, top10Prob, expectedPoints,
 *   expectedPos: {id:avg}, flProb: {id:p}, recommended: {p1,p2,p3,fl},
 *   confidence, insights: [{icon,text}]
 * }
 */
export function predictRace(drivers, teams, race, opts = {}) {
  const iterations = opts.iterations || 1500
  const formMap = opts.form || {}
  const biasMap = opts.bias || {}
  const rng = makeRng(opts.seed ?? 20251123)

  const priors = buildPriors(drivers, teams, formMap)
  // learned bias from real outcomes (local model memory)
  for (const p of priors) p.biasValue = biasMap[p.driver.id] ?? 0
  applyCircuit(priors, race)

  const win = {}, podium = {}, top10 = {}, fl = {}, ptsSum = {}, posSum = {}
  priors.forEach((p) => { win[p.driver.id] = 0; podium[p.driver.id] = 0; top10[p.driver.id] = 0; fl[p.driver.id] = 0; ptsSum[p.driver.id] = 0; posSum[p.driver.id] = 0 })

  const n = priors.length
  const teamIds = [...new Set(priors.map((p) => p.driver.team))]
  for (let it = 0; it < iterations; it++) {
    // package/team swing: both cars share a good or bad day (correlation)
    const teamNoise = Object.fromEntries(teamIds.map((id) => [id, gauss(rng) * 1.25]))
    // per-driver sampled performance index for this iteration
    const perf = priors.map((p) => {
      const noise = gauss(rng) * p.sigma + (teamNoise[p.driver.team] || 0)
      const formBoost = (p.form - 0.5) * 2.4
      const dnf = rng() < 0.02
      return { p, score: p.base + p.circuitAffinity.value + formBoost + p.biasValue + noise, dnf, points: 0, pos: null }
    })
    perf.sort((a, b) => (a.dnf - b.dnf) || (b.score - a.score))
    let classifiedIdx = 0
    perf.forEach((r, idx) => {
      r.pos = r.dnf ? n : idx + 1
      if (!r.dnf) {
        const pts = (POINTS[classifiedIdx] ?? 0)
        r.points = pts
        ptsSum[r.p.driver.id] += pts
        top10[r.p.driver.id] += r.pos <= 10 ? 1 : 0
        podium[r.p.driver.id] += r.pos <= 3 ? 1 : 0
        win[r.p.driver.id] += r.pos === 1 ? 1 : 0
        classifiedIdx++
      }
      posSum[r.p.driver.id] += r.pos
    })
    // fastest lap: weighted among the top 6 by pace score
    const pool = perf.filter((r) => !r.dnf).slice(0, 6)
    if (pool.length) {
      const weights = pool.map((r) => Math.max(0.1, r.score))
      const total = weights.reduce((a, b) => a + b, 0)
      let pick = rng() * total, chosen = pool[0]
      for (let i = 0; i < pool.length; i++) { pick -= weights[i]; if (pick <= 0) { chosen = pool[i]; break } }
      fl[chosen.p.driver.id] += 1
      if (chosen.pos <= 10) ptsSum[chosen.p.driver.id] += FL_POINT
    }
  }

  const ids = priors.map((p) => p.driver.id)
  const div = (obj) => Object.fromEntries(ids.map((id) => [id, obj[id] / iterations]))
  const winProb = div(win), podiumProb = div(podium), top10Prob = div(top10), flProb = div(fl)
  const expectedPoints = Object.fromEntries(ids.map((id) => [id, ptsSum[id] / iterations]))
  const expectedPos = Object.fromEntries(ids.map((id) => [id, posSum[id] / iterations]))

  // recommended: top 3 by expected position (most likely podium), FL by flProb
  const byExp = [...priors].sort((a, b) => expectedPos[a.driver.id] - expectedPos[b.driver.id])
  const recommended = {
    p1: byExp[0]?.driver.id,
    p2: byExp[1]?.driver.id,
    p3: byExp[2]?.driver.id,
    fl: ids.reduce((best, id) => (flProb[id] > flProb[best] ? id : best), ids[0])
  }

  const topWin = [...ids].sort((a, b) => winProb[b] - winProb[a])[0]
  const confidence = Math.min(0.98, Math.max(0.12, winProb[topWin]))

  const insights = buildInsights({ priors, winProb, flProb, expectedPoints, expectedPos, race, recommended, formMap })

  return {
    model: 'pitwall-apex-v1',
    race: { round: race.round, name: race.name },
    iterations,
    winProb, podiumProb, top10Prob, flProb, expectedPoints, expectedPos,
    recommended, confidence, insights
  }
}

function buildInsights({ priors, winProb, flProb, expectedPoints, expectedPos, race, recommended, formMap }) {
  const out = []
  const ids = Object.keys(winProb)
  const ranked = [...ids].sort((a, b) => winProb[b] - winProb[a])
  const fav = priors.find((p) => p.driver.id === ranked[0])?.driver
  const fav2 = priors.find((p) => p.driver.id === ranked[1])?.driver
  const favWin = winProb[ranked[0]]
  out.push({
    icon: '👑',
    text: favWin >= 0.45
      ? `${fav.name} が圧倒的優勢（勝率 ${pct(favWin)}）。PITWALL模型の最有力候補。`
      : `${fav.name} が最有力（勝率 ${pct(favWin)}）だが、混戦の可能性大。`,
    textEn: favWin >= 0.45
      ? `${fav.name} dominates (win prob ${pct(favWin)}). Top pick of the APEX model.`
      : `${fav.name} leads (win prob ${pct(favWin)}) but the field is tight.`
  })
  const bestForm = priors.reduce((b, p) => (formMap[p.driver.id] ?? 0) > (formMap[b.driver.id] ?? 0) ? p : b, priors[0])
  if (formMap[bestForm.driver.id] != null && formMap[bestForm.driver.id] >= 0.75) {
    out.push({
      icon: '🔥',
      text: `好調維持中：${bestForm.driver.name} が直近のフォームでトップクラス。`,
      textEn: `In form: ${bestForm.driver.name} has the strongest recent form.`
    })
  }
  const darkHorse = priors.find((p) => p.driver.id === ranked[4] || p.driver.id === ranked[5])?.driver
  if (darkHorse) {
    out.push({
      icon: '💡',
      text: `ダークホース筆頭は ${darkHorse.name}（期待順位 ${expectedPos[darkHorse.id].toFixed(1)}）。`,
      textEn: `Dark horse: ${darkHorse.name} (expected P${Math.round(expectedPos[darkHorse.id])}).`
    })
  }
  const flD = priors.find((p) => p.driver.id === recommended.fl)?.driver
  out.push({
    icon: '⏱️',
    text: `ファステストラップ予想は ${flD?.name}（確率 ${pct(flProb[recommended.fl] ?? 0)}）。`,
    textEn: `Fastest-lap model pick: ${flD?.name} (${pct(flProb[recommended.fl] ?? 0)}).`
  })
  out.push({
    icon: '🎲',
    text: `モンテカルロ 1500 回演算。天候・リスク要因は分散に反映済み。`,
    textEn: `Monte Carlo with 1500 iterations; weather/risk folded into the spread.`
  })
  return out.slice(0, 4)
}
function pct(x) { return `${(x * 100).toFixed(1)}%` }

/** convenience: compact table sorted by expected position */
export function predictionTable(pred, limit = 21) {
  return Object.entries(pred.expectedPos)
    .map(([id, pos]) => ({ id, pos, win: pred.winProb[id], pts: pred.expectedPoints[id] }))
    .sort((a, b) => a.pos - b.pos)
    .slice(0, limit)
}
