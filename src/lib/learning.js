// ============================================================================
// PITWALL APEX — local model learning ("AIフォーム学習")
// ----------------------------------------------------------------------------
// Every time a prediction is scored against a result, we measure how far each
// driver's ACTUAL position was from the model's EXPECTED position and fold an
// EMA of that "surprise" back into a per-driver bias used by `predictRace`.
// All data stays in localStorage (honest local learning, no server dependency).
// ============================================================================

import { load, save } from './store.js'

export const LEARNING_KEY = 'learning'
const DEFAULT = { bias: {}, samples: 0, hits: 0, errorSum: 0 }

export function loadLearning() {
  const l = load(LEARNING_KEY, DEFAULT)
  return { bias: {}, samples: 0, hits: 0, errorSum: 0, ...l }
}

export function resetLearning() {
  save(LEARNING_KEY, DEFAULT)
  return { ...DEFAULT }
}

/**
 * Update biases from scored predictions.
 * @param preds  [{p1,p2,p3,fl}]
 * @param result [{driverId, position}]
 */
export function learnFromResults(preds, result) {
  const L = loadLearning()
  const posById = Object.fromEntries((result || []).map((r) => [r.driverId, r.position]))
  let errors = []

  for (const p of preds || []) {
    for (const [key, expected] of [['p1', 1], ['p2', 2], ['p3', 3]]) {
      const id = p[key]
      if (!id || !posById[id]) continue
      const surprise = expected - posById[id]        // >0: drove better than expected
      const next = (L.bias[id] || 0) * 0.85 + surprise * 0.15
      L.bias[id] = Math.max(-5, Math.min(5, Number(next.toFixed(3))))
      errors.push(Math.abs(expected - posById[id]))
    }
    if (p.fl && posById[p.fl]) {
      const surprise = posById[p.fl] <= 10 ? (10 - posById[p.fl]) * 0.08 : -0.4
      L.bias[p.fl] = Math.max(-5, Math.min(5, Number(((L.bias[p.fl] || 0) * 0.9 + surprise * 0.1).toFixed(3))))
      errors.push(Math.abs(posById[p.fl] - 1))
    }
  }

  if (errors.length) {
    L.samples += errors.length
    L.errorSum += errors.reduce((a, b) => a + b, 0)
    L.hits += errors.filter((e) => e === 0).length
    save(LEARNING_KEY, L)
  }
  return {
    ...L,
    accuracy: L.samples ? L.hits / L.samples : null,
    mae: L.samples ? L.errorSum / L.samples : null,
    updatedBias: Object.keys(L.bias).length
  }
}

/** top movers for the learning panel */
export function biasMovers(L, limit = 5) {
  return Object.entries(L?.bias || {})
    .map(([id, b]) => ({ id, b }))
    .sort((a, b) => Math.abs(b.b) - Math.abs(a.b))
    .slice(0, limit)
}
