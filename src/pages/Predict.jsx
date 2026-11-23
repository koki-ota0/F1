import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { useApi, getJSON, getCalendar } from '../lib/api.js'
import { SectionHead, Loading, EmptyState } from '../components/common.jsx'
import { useFan } from '../components/FanProvider.jsx'
import { simulateRace } from '../lib/sim.js'
import { computeScore, nextRace, fmtDate } from '../lib/utils.js'
import { load, save } from '../lib/store.js'

export default function Predict() {
  const { t, lang } = useLang()
  const { data: drivers, loading } = useApi('/api/drivers')
  const { preds, addPred, clearPreds, setPreds, teams, fan } = useFan()
  const [cal, setCal] = useState(null)
  const [raceRound, setRaceRound] = useState(null)
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [p3, setP3] = useState('')
  const [fl, setFl] = useState('')
  const [name, setName] = useState(() => load('pitwall.name', fan.name || ''))
  const [leaderboard, setLeaderboard] = useState([])
  const [toast, setToast] = useState('')
  const [scoring, setScoring] = useState(null)

  const races = cal?.races || []
  const race = useMemo(() => {
    const nr = nextRace(races)
    return races.find((r) => r.round === raceRound) || nr || null
  }, [races, raceRound])

  useEffect(() => { getCalendar(new Date().getFullYear()).then(setCal) }, [])
  useEffect(() => { getJSON('/api/predictions').then((d) => setLeaderboard(d.leaderboard || [])).catch(() => {}) }, [])
  useEffect(() => { save('pitwall.name', name) }, [name])

  const dName = (id) => drivers?.find((d) => d.id === id)?.name || '—'
  const canSubmit = race && p1 && p2 && p3 && fl && new Set([p1, p2, p3]).size === 3

  const submit = () => {
    if (!canSubmit) return
    addPred({ race: race.round, raceName: lang === 'ja' ? race.nameJa : race.name, name: name || 'YOU', p1, p2, p3, fl, score: null })
    setToast(t('predict.submitDone'))
    setTimeout(() => setToast(''), 2200)
  }

  const scoreAll = () => {
    if (!drivers || !race) return
    const { result } = simulateRace(drivers, teams, race.laps || 52)
    let total = 0
    const next = preds.map((p) => {
      const score = computeScore(p, result)
      total += score
      return { ...p, score }
    })
    // persist scores
    setPreds(next)
    setScoring({ result, total })
    getJSON('/api/predictions').then((d) => setLeaderboard(d.leaderboard || [])).catch(() => {})
    fetch('/api/predictions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || 'YOU', points: total, picks: preds.length })
    }).then((r) => r.json()).then((d) => setLeaderboard(d.leaderboard || [])).catch(() => {})
  }

  if (loading || !cal) return <div className="section container"><Loading /></div>

  const sorted = [...preds].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const myTotal = preds.reduce((s, p) => s + (p.score || 0), 0)

  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="PICK 'EM" title={t('predict.title')} sub={t('predict.sub')} />

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="field">
              <label>{t('predict.selectRace')}</label>
              <select className="input" value={race?.round ?? ''} onChange={(e) => setRaceRound(Number(e.target.value))}>
                {races.map((r) => <option key={r.round} value={r.round}>Rd.{r.round} {r.flag} {lang === 'ja' ? r.nameJa : r.name} · {fmtDate(r.date, lang)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('predict.yourName')}</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
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
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn primary" disabled={!canSubmit} onClick={submit}>{t('predict.submit')}</button>
              {toast && <span className="badge ok" style={{ alignSelf: 'center' }}>{toast}</span>}
            </div>
            <p className="note" style={{ marginTop: 14 }}><b>{t('predict.scoring')}</b>: {t('predict.scoringDesc')}</p>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <h3 className="card-title" style={{ margin: 0 }}>{t('predict.myPicks')}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn sm" onClick={scoreAll} disabled={!preds.length || !drivers}>{t('predict.pointsEarned')}</button>
                <button className="btn sm ghost" onClick={clearPreds} disabled={!preds.length}>{t('predict.clear')}</button>
              </div>
            </div>
            <hr className="divider" />
            {scoring && (
              <p style={{ margin: '0 0 12px' }}>
                <span className="badge gold">{t('predict.pointsEarned')}: {scoring.total} pts</span>
              </p>
            )}
            {sorted.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sorted.map((p) => (
                  <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <b>Rd.{p.race} {p.raceName}</b>
                      <span className="num" style={{ color: 'var(--accent-2)' }}>{p.score != null ? `${p.score} pts` : '—'}</span>
                    </div>
                    <div className="note" style={{ marginTop: 4 }}>
                      P1 {dName(p.p1)} · P2 {dName(p.p2)} · P3 {dName(p.p3)} · FL {dName(p.fl)}
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon="🎯" title={t('predict.noPicks')} />}
          </div>
        </div>

        <div style={{ marginTop: 34 }}>
          <SectionHead eyebrow="FAN LEAGUE" title={t('predict.leaderboard')} sub={`${t('predict.pointsEarned')}: ${myTotal} pts`} />
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('standings.position')}</th><th>{t('predict.name')}</th><th>GP</th><th>{t('standings.points')}</th></tr></thead>
              <tbody>
                {leaderboard.map((r, i) => (
                  <tr key={r.id} className={r.name === (name || 'YOU') ? 'me' : ''}>
                    <td className="num" style={{ color: i < 3 ? 'var(--accent-2)' : 'inherit' }}>{i + 1}</td>
                    <td style={{ fontWeight: 700 }}>{r.name}</td>
                    <td className="num">{r.picks}</td>
                    <td className="num" style={{ fontSize: 16 }}>{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
