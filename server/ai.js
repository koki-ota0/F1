// ============================================================================
// PITWALL AI — prediction providers
// ----------------------------------------------------------------------------
// Provider interface: predictRace({ drivers, teams, race, form }) -> result
//   1) apex  : bundled Monte Carlo model (src/lib/model.js) — always available,
//              offline-safe, explainable.
//   2) llm   : optional external LLM (OpenAI-compatible endpoint). Activated by
//              setting PITWALL_LLM_URL and PITWALL_LLM_KEY. The model receives a
//              compact JSON context and must answer with a strict JSON schema;
//              invalid answers fall back to APEX automatically.
// ============================================================================

import { predictRace as apexPredict } from '../src/lib/model.js'

export const aiStatus = () => ({
  apex: { enabled: true, model: 'pitwall-apex-v1' },
  llm: {
    enabled: Boolean(process.env.PITWALL_LLM_URL && process.env.PITWALL_LLM_KEY),
    url: process.env.PITWALL_LLM_URL || null,
    model: process.env.PITWALL_LLM_MODEL || 'gpt-4o-mini'
  }
})

const LLM_SYSTEM = `You are PITWALL APEX, an expert Formula 1 race predictor.
Given driver ratings, team strength and circuit info, output ONLY valid JSON:
{
  "recommended": {"p1":"<driverId>","p2":"<driverId>","p3":"<driverId>","fl":"<driverId>"},
  "confidence": 0.0-1.0,
  "comment": "short bilingual insight (ja/en separated by ' || ')",
  "upsetPick": "<driverId or null>"
}
No markdown, no extra keys.`

async function llmPredict(ctx) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(process.env.PITWALL_LLM_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PITWALL_LLM_KEY}` },
      body: JSON.stringify({
        model: process.env.PITWALL_LLM_MODEL || 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: LLM_SYSTEM },
          { role: 'user', content: JSON.stringify(ctx) }
        ]
      })
    })
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content
    const parsed = JSON.parse(content)
    // schema validation
    const ids = new Set(ctx.drivers.map((d) => d.id))
    const rec = parsed.recommended
    if (!rec || !ids.has(rec.p1) || !ids.has(rec.p2) || !ids.has(rec.p3) || !ids.has(rec.fl)) {
      throw new Error('invalid LLM schema')
    }
    return {
      source: 'llm',
      model: process.env.PITWALL_LLM_MODEL || 'llm',
      recommended: { p1: rec.p1, p2: rec.p2, p3: rec.p3, fl: rec.fl },
      confidence: Math.min(0.98, Math.max(0.05, Number(parsed.confidence) || 0.5)),
      comment: parsed.comment || '',
      upsetPick: ids.has(parsed.upsetPick) ? parsed.upsetPick : null
    }
  } catch (e) {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Predict a race with the best available provider.
 * Strategy: if LLM configured, ask it AND run APEX, then blend recommendations
 * (APEX as tie-breaker). If LLM fails, transparently fall back to APEX only.
 */
export async function predictRaceWithAI({ drivers, teams, race, form = {} }) {
  const apex = apexPredict(drivers, teams, race, { form })
  const ctx = {
    race: { round: race.round, name: race.name, circuit: race.circuit, date: race.date },
    drivers: drivers.map((d) => ({ id: d.id, name: d.name, rating: d.rating, team: d.team, number: d.number, titles: d.titles })),
    teamStrength: Object.fromEntries(teams.map((t) => [t.id, t.short]))
  }
  let llm = null
  if (aiStatus().llm.enabled) llm = await llmPredict(ctx)

  if (llm) {
    // blend: keep APEX distribution table, adopt LLM recommendation when confident
    const agree = llm.recommended.p1 === apex.recommended.p1
    return {
      ...apex,
      source: 'llm+apex',
      llm: { recommended: llm.recommended, confidence: llm.confidence, comment: llm.comment, upsetPick: llm.upsetPick, agreesOnWinner: agree },
      recommended: llm.confidence >= 0.6 ? llm.recommended : apex.recommended,
      confidence: agree ? Math.max(llm.confidence, apex.confidence) : apex.confidence
    }
  }
  return { ...apex, source: 'apex', llm: null }
}
