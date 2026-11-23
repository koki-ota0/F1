import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { SectionHead, Loading, EmptyState, Badge } from '../components/common.jsx'
import { useApi } from '../lib/api.js'
import { simulateRace } from '../lib/sim.js'
import { useFan } from '../components/FanProvider.jsx'
import {
  loadLeagues, saveLeagues, joinLeague, setMyPicks, scoreRaceForLeagues,
  standings, leagueProfile
} from '../lib/league.js'

export default function League() {
  const { t, lang } = useLang()
  const { fan } = useFan()
  const { data: drivers, loading } = useApi('/api/drivers')
  const { data: teams } = useApi('/api/teams')

  const [leagues, setLeagues] = useState(() => loadLeagues())
  const [nameInput, setNameInput] = useState('')
  const [picks, setPicks] = useState({ p1: '', p2: '', p3: '', fl: '' })
  const [active, setActive] = useState(null)   // league id being picked

  const teamById = useMemo(() => Object.fromEntries((teams || []).map((x) => [x.id, x])), [teams])
  const driverById = useMemo(() => Object.fromEntries((drivers || []).map((x) => [x.id, x])), [drivers])

  useEffect(() => { saveLeagues(leagues) }, [leagues])

  const joined = leagues.filter((l) => l.entries.some((e) => e.me))
  const activeL = leagues.find((l) => l.id === active)

  const submitPick = () => {
    if (!active || (!picks.p1 && !picks.fl)) return
    setLeagues(setMyPicks(leagues, active, { ...picks, __drivers: drivers || [] }))
    setPicks({ p1: '', p2: '', p3: '', fl: '' })
  }

  const score = () => {
    // Score every league with a race result. Today this uses the built-in
    // simulator (deterministic engine shared with /sim); when a verified live
    // results source is reachable the same scorer will consume it.
    const sim = simulateRace(drivers || [], teams || [], 52)
    const result = sim.result.map((r) => ({ driverId: r.driverId, position: r.position }))
    setLeagues(scoreRaceForLeagues(leagues, lang === 'ja' ? 'シミュレーション' : 'Simulation', result))
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 1000 }}>
        <SectionHead eyebrow="MULTI-LEAGUE" title={t('league.title')} sub={t('league.sub')} />

        {loading || !drivers ? <Loading /> : (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <label className="note" style={{ fontWeight: 700 }}>{t('league.entryName')}</label>
              <input
                className="input"
                style={{ marginTop: 6 }}
                value={nameInput}
                placeholder={(fan.name || 'YOU')}
                onChange={(e) => setNameInput(e.target.value)}
              />
              <div style={{ height: 10 }} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {leagues.map((l) => {
                  const isIn = l.entries.some((e) => e.me)
                  return (
                    <button key={l.id} className={isIn ? 'btn sm primary' : 'btn sm ghost'} onClick={() => {
                      if (!isIn) setLeagues(joinLeague(leagues, l.id, nameInput || fan.name))
                      else setActive(l.id)
                    }}>
                      {lang === 'ja' ? l.name : l.nameEn} · {isIn ? t('league.joined') : t('league.join')}
                    </button>
                  )
                })}
              </div>
            </div>

            {joined.length === 0 ? (
              <EmptyState icon="🏆" title={t('league.noLeagues')} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {joined.map((l) => {
                  const me = l.entries.find((e) => e.me)
                  const st = standings(l)
                  const myRank = st.findIndex((e) => e.me) + 1
                  return (
                    <div className="card" key={l.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                        <div>
                          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 17, margin: 0 }}>{lang === 'ja' ? l.name : l.nameEn}</h4>
                          <p className="note" style={{ margin: '4px 0 0' }}>
                            {lang === 'ja' ? l.descJa : l.descEn} · {t(`league.metric.${l.metric}`)}
                          </p>
                        </div>
                        <Badge tone={myRank === 1 ? 'ok' : 'muted'}>{t('league.me')} #{myRank} · {me.points || 0}{t('league.totalPts')}</Badge>
                      </div>

                      <hr className="divider" />
                      <div className="note" style={{ fontWeight: 700 }}>{t('league.roundPicks')}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 8 }}>
                        {[['p1', t('predict.pickP1')], ['fl', t('predict.pickFL')]].map(([key, label]) => (
                          <div key={key}>
                            <div className="note" style={{ marginBottom: 4 }}>{label}</div>
                            <select className="input" value={active === l.id ? picks[key] : ''}
                              onChange={(e) => { setActive(l.id); setPicks((p) => ({ ...p, [key]: e.target.value })) }}>
                              <option value="">—</option>
                              {(drivers || []).map((d) => (
                                <option key={d.id} value={d.id}>#{d.number} {lang === 'ja' ? d.nameJa : d.name}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <button className="btn sm primary" disabled={!picks.p1 && !picks.fl} onClick={() => { setActive(l.id); submitPick() }}>
                          {t('predict.submit')}
                        </button>
                      </div>

                      <hr className="divider" />
                      <div className="note" style={{ fontWeight: 700, marginBottom: 8 }}>{t('league.standings')}</div>
                      <table className="table" style={{ fontSize: 13 }}>
                        <thead><tr><th>#</th><th>{t('predictions.nickname')}</th><th style={{ textAlign: 'right' }}>{t('league.points')}</th></tr></thead>
                        <tbody>
                          {st.map((e, i) => (
                            <tr key={e.id} className={e.me ? 'highlight-row' : ''}>
                              <td className="num">{i + 1}</td>
                              <td>{e.name}{e.me ? ` · ${t('league.me')}` : ''}</td>
                              <td className="num" style={{ textAlign: 'right' }}>{e.points || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}

                <div className="card">
                  <div className="note" style={{ fontWeight: 700 }}>{t('league.scoreRound')}</div>
                  <p className="note" style={{ margin: '6px 0 12px' }}>{t('league.simulatedResult')}</p>
                  <button className="btn sm primary" onClick={score}>{t('league.scoreRound')}</button>
                  <p className="note" style={{ marginTop: 12, marginBottom: 0 }}>{t('league.scoreNote')}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
