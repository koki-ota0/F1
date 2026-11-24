import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { useApi, getCalendar } from '../lib/api.js'
import { assetUrl } from '../lib/asset.js'
import { SectionHead, Loading, EmptyState, Badge } from '../components/common.jsx'
import { useFan } from '../components/FanProvider.jsx'
import { useAuth, authFetch } from '../lib/auth.jsx'
import { predictRace, predictionTable } from '../lib/model.js'

import { nextRace, fmtDate, teamById } from '../lib/utils.js'
import { load, save } from '../lib/store.js'

const EMPTY_TOTALS = { points: 0, races: 0, avgAccuracy: 0, hitRate: 0, pending: 0 }

/** Breakdown chips: one per scoring category, real points from the result. */
function Breakdown({ score }) {
  const rows = [
    ['P1', score?.breakdown?.p1],
    ['P2', score?.breakdown?.p2],
    ['P3', score?.breakdown?.p3],
    ['FL', score?.breakdown?.fl],
    ['+', score?.breakdown?.bonus]
  ]
  return (
    <div className="pill-row">
      {rows.map(([label, pts]) => (
        <span className={`tag ${pts ? 'hit' : ''}`} key={label}>
          {label} {pts ? `+${pts}` : '0'}
        </span>
      ))}
    </div>
  )
}

export default function Predict() {
  const { t, lang } = useLang()
  const { data: drivers, loading } = useApi('/api/drivers')
  const { user } = useAuth()
  const { preds: localPreds, teams, fan } = useFan()
  const [cal, setCal] = useState(null)
  const [raceRound, setRaceRound] = useState(null)
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [p3, setP3] = useState('')
  const [fl, setFl] = useState('')
  const [name, setName] = useState(() => load('pitwall.name', fan.name || ''))
  const [leaderboard, setLeaderboard] = useState([])
  const [mine, setMine] = useState(null)
  const [totals, setTotals] = useState(EMPTY_TOTALS)
  const [serverMode, setServerMode] = useState(true)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [ai, setAi] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)


  const races = cal?.races || []
  const race = useMemo(() => {
    const nr = nextRace(races)
    return races.find((r) => r.round === raceRound) || nr || null
  }, [races, raceRound])

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600) }

  const refresh = useCallback(async () => {
    try {
      const mineRes = await authFetch(assetUrl('/api/predictions/mine'))
      if (!mineRes.ok) throw new Error('mine failed')
      const mineData = await mineRes.json()
      setMine(mineData.predictions || [])
      setTotals(mineData.totals || EMPTY_TOTALS)
      const lbRes = await authFetch(assetUrl('/api/predictions'))
      const lbData = lbRes.ok ? await lbRes.json() : { leaderboard: [] }
      setLeaderboard(lbData.leaderboard || [])
      setServerMode(true)
    } catch {
      // no server (GitHub Pages) or offline: fall back to the local cache
      setMine(localPreds || [])
      setTotals({
        points: localPreds.reduce((s, p) => s + (p.score || 0), 0),
        races: localPreds.filter((p) => p.score != null).length,
        pending: localPreds.filter((p) => p.score == null).length,
        avgAccuracy: 0, hitRate: 0
      })
      setLeaderboard([])
      setServerMode(false)
    }
  }, [localPreds])

  useEffect(() => { getCalendar(new Date().getFullYear()).then(setCal) }, [])
  useEffect(() => { save('pitwall.name', name) }, [name])
  useEffect(() => { setAi(null) }, [raceRound])
  useEffect(() => { refresh() }, [refresh])

  const runAI = () => {
    if (!drivers || !race) return
    setAiLoading(true)
    setTimeout(() => {
      try { setAi(predictRace(drivers, teams, race)) }
      finally { setAiLoading(false) }
    }, 40)
  }

  const applyAI = () => {
    if (!ai?.recommended) return
    setP1(ai.recommended.p1); setP2(ai.recommended.p2); setP3(ai.recommended.p3); setFl(ai.recommended.fl)
    notify(t('ai.applied'))
  }

  const aiRows = ai ? predictionTable(ai, 8).map((r) => ({
    ...r,
    driver: drivers.find((d) => d.id === r.id),
    team: teamById(teams, drivers.find((d) => d.id === r.id)?.team)
  })) : []

  const dName = (id) => drivers?.find((d) => d.id === id)?.name || '—'
  const canSubmit = race && p1 && new Set([p1, p2, p3].filter(Boolean)).size === [p1, p2, p3].filter(Boolean).length

  const submit = async () => {
    if (!canSubmit || !race || busy) return
    setBusy(true)
    try {
      const res = await authFetch(assetUrl('/api/predictions'), {
        method: 'POST',
        body: JSON.stringify({ year: new Date().getFullYear(), round: race.round, p1, p2, p3, fl })
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        notify(t('predict.submitDone'))
        setP1(''); setP2(''); setP3(''); setFl('')
        setLeaderboard(d.leaderboard || [])
        await refresh()
      } else if (res.status === 409) {
        notify(t('predict.raceLocked'))
      } else {
        notify(t(`predict.error.${d.code || 'generic'}`))
      }
    } catch {
      notify(t('auth.error.server'))
    } finally {
      setBusy(false)
    }
  }

  /** Ask the server to apply any published result to pending predictions. */
  const scorePending = async () => {
    const pending = (mine || []).filter((p) => !p.score)
    if (!pending.length) { notify(t('predict.nothingToScore')); return }
    setBusy(true)
    let scored = 0
    try {
      for (const p of pending.slice(0, 8)) {
        const res = await authFetch(assetUrl('/api/predictions/score'), {
          method: 'POST',
          body: JSON.stringify({ year: p.year, round: p.round })
        })
        if (res.ok) {
          const d = await res.json()
          scored += d.scored || 0
        }
      }
      await refresh()
      notify(`${t('predict.scoreNow')}: ${scored}`)
    } catch {
      notify(t('auth.error.server'))
    } finally {
      setBusy(false)
    }
  }

  if (loading || !cal) return <div className="section container"><Loading /></div>

  const sorted = [...(mine || [])].sort((a, b) => b.year - a.year || b.round - a.round)

  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="PICK 'EM" title={t('predict.title')} sub={t('predict.sub')} />

        <div className="card" style={{ marginBottom: 22, borderColor: 'rgba(225,6,0,.35)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div className="eyebrow">PITWALL APEX</div>
              <h3 style={{ fontFamily: 'var(--font-display)', margin: '6px 0 4px', fontSize: 21 }}>{t('ai.title')}</h3>
              <p className="note" style={{ margin: 0 }}>{t('ai.sub')}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge kind={ai?.source === 'llm+apex' ? 'live' : 'offline'}>{ai?.source === 'llm+apex' ? t('ai.llmBadge') : 'APEX'}</Badge>
              <button className="btn primary" onClick={runAI} disabled={aiLoading || !race}>{aiLoading ? t('ai.running') : t('ai.run')}</button>
            </div>
          </div>

          {ai && (
            <>
              <hr className="divider" />
              <div className="grid grid-2" style={{ gap: 22, alignItems: 'start' }}>
                <div>
                  <div className="note" style={{ fontWeight: 700, marginBottom: 10 }}>{t('ai.winProb')}</div>
                  {aiRows.map((r) => (
                    <div key={r.id} style={{ marginBottom: 9 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                        <span style={{ fontWeight: 700 }}>#{r.driver?.number} {r.driver?.name}</span>
                        <span className="num" style={{ color: 'var(--accent-2)' }}>{(r.win * 100).toFixed(1)}%</span>
                      </div>
                      <div className="progress" style={{ height: 7 }}>
                        <i style={{ width: `${Math.max(2, r.win * 100)}%`, background: r.team?.color || 'var(--accent)' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="note" style={{ fontWeight: 700, marginBottom: 10 }}>{t('ai.recommended')} · {t('ai.confidence')}: {(ai.confidence * 100).toFixed(0)}%</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {[['P1', ai.recommended.p1], ['P2', ai.recommended.p2], ['P3', ai.recommended.p3], ['FL', ai.recommended.fl]].map(([pos, id]) => {
                      const d = drivers.find((x) => x.id === id)
                      return (
                        <div key={pos} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
                          <span className="tag">{pos}</span>
                          <b>#{d?.number} {d?.name}</b>
                        </div>
                      )
                    })}
                  </div>
                  <button className="btn sm" onClick={applyAI}>{t('ai.usePrediction')}</button>
                </div>
              </div>
            </>
          )}
          {!ai && !aiLoading && <p className="note" style={{ margin: '12px 0 0' }}>{t('ai.offlineNote')}</p>}
        </div>

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="field">
              <label>{t('predict.selectRace')}</label>
              <select className="input" value={race?.round ?? ''} onChange={(e) => setRaceRound(Number(e.target.value))}>
                {races.map((r) => <option key={r.round} value={r.round}>Rd.{r.round} {r.flag} {lang === 'ja' ? r.nameJa : r.name} · {fmtDate(r.date, lang)}</option>)}
              </select>
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              {[['P1', p1, setP1], ['P2', p2, setP2], ['P3', p3, setP3], [t('predict.fastestLap'), fl, setFl]].map(([label, val, set]) => (
                <div className="field" key={label}>
                  <label>{label}</label>
                  <select className="input" value={val} onChange={(e) => set(e.target.value)}>
                    <option value="">—</option>
                    {(drivers || []).map((d) => (
                      <option key={d.id} value={d.id} disabled={[p1, p2, p3].filter(Boolean).includes(d.id) && d.id !== val}>#{d.number} {d.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn primary" disabled={!canSubmit || busy} onClick={submit}>{t('predict.submit')}</button>
              {toast && <span className="badge ok">{toast}</span>}
            </div>
            <p className="note" style={{ marginTop: 14, marginBottom: 0 }}>
              <b>{t('predict.scoring')}</b>: {t('predict.scoringDesc')}
            </p>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 className="card-title" style={{ margin: 0 }}>{t('predict.myPicks')}</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn sm" onClick={scorePending} disabled={busy || !serverMode || !sorted.some((p) => !p.score)}>
                  {t('predict.scoreNow')}
                </button>
              </div>
            </div>
            <hr className="divider" />
            {totals && serverMode && (
              <div className="stat-row">
                <div><div className="num">{totals.points}</div><div className="note">{t('predict.totalPoints')}</div></div>
                <div><div className="num">{totals.races}</div><div className="note">{t('predict.racesScored')}</div></div>
                <div><div className="num">{(totals.avgAccuracy * 100).toFixed(0)}%</div><div className="note">{t('predict.avgAccuracy')}</div></div>
                <div><div className="num">{(totals.hitRate * 100).toFixed(0)}%</div><div className="note">{t('predict.hitRate')}</div></div>
              </div>
            )}
            {!serverMode && <p className="note" style={{ marginBottom: 10 }}>{t('predict.localOnly')}</p>}
            {sorted.length ? (
              <div className="pred-list">
                {sorted.map((p) => (
                  <div className="pred-card" key={p.id}>
                    <div className="pred-head">
                      <b>Rd.{p.round} {p.raceName || ''}</b>
                      {p.score ? (
                        <span className="num" style={{ color: 'var(--accent-2)' }}>{p.score.points} pts</span>
                      ) : <Badge kind="gold">{t('predict.pending')}</Badge>}
                    </div>
                    <div className="note">
                      P1 {dName(p.p1)} · P2 {dName(p.p2)} · P3 {dName(p.p3)} · FL {dName(p.fl)}
                    </div>
                    {p.score && (
                      <>
                        <Breakdown score={p.score} />
                        <div className="pred-meta">
                          <span>{t('predict.accuracy')}: {(p.score.accuracy * 100).toFixed(0)}%</span>
                          <span>{t('predict.hitRate')}: {p.score.hits}/{p.score.known}</span>
                          <span className="note">{p.score.provider}</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : <EmptyState icon="🎯" title={t('predict.noPicks')} />}
          </div>
        </div>

        <div style={{ marginTop: 34 }}>
          <SectionHead eyebrow="FAN LEAGUE" title={t('predict.leaderboard')} sub={`${t('predict.totalPoints')}: ${serverMode ? totals.points : localPreds.reduce((s, p) => s + (p.score || 0), 0)}`} />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('standings.position')}</th><th>{t('predict.name')}</th>
                  <th>{t('predict.racesScored')}</th><th>{t('standings.points')}</th>
                  <th>{t('predict.avgAccuracy')}</th><th>{t('predict.hitRate')}</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => (
                  <tr key={r.userId} className={r.username === user?.username ? 'me' : ''}>
                    <td className="num" style={{ color: i < 3 ? 'var(--accent-2)' : 'inherit' }}>{i + 1}</td>
                    <td style={{ fontWeight: 700 }}>{r.name}{r.username === user?.username ? ` · ${t('league.me')}` : ''}</td>
                    <td className="num">{r.races}{r.pending ? ` (+${r.pending})` : ''}</td>
                    <td className="num" style={{ fontSize: 16 }}>{r.points}</td>
                    <td className="num">{r.accRaces ? `${(r.avgAccuracy * 100).toFixed(0)}%` : '—'}</td>
                    <td className="num">{r.known ? `${(r.hitRate * 100).toFixed(0)}%` : '—'}</td>
                  </tr>
                ))}
                {!leaderboard.length && (
                  <tr><td colSpan={6} className="note" style={{ textAlign: 'center', padding: 18 }}>{t('predict.noLeaderboard')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
