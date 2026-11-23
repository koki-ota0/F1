import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { useApi, getCalendar } from '../lib/api.js'
import { SectionHead, Loading, Badge } from '../components/common.jsx'
import { simulateRace, simulateSeason } from '../lib/sim.js'
import { nextRace, fmtDate, teamById } from '../lib/utils.js'
import { useFan } from '../components/FanProvider.jsx'

export default function Sim() {
  const { t, lang } = useLang()
  const { data: drivers, loading } = useApi('/api/drivers')
  const { teams } = useFan()
  const [cal, setCal] = useState(null)
  const [raceRound, setRaceRound] = useState(null)
  const [running, setRunning] = useState(false)
  const [lap, setLap] = useState(0)
  const [result, setResult] = useState(null)
  const [season, setSeason] = useState(null)
  const timer = useRef(null)

  const races = cal?.races || []
  const race = useMemo(() => races.find((r) => r.round === raceRound) || nextRace(races) || null, [races, raceRound])
  useEffect(() => { getCalendar(new Date().getFullYear()).then(setCal) }, [])

  useEffect(() => () => clearInterval(timer.current), [])

  if (loading || !cal) return <div className="section container"><Loading /></div>

  const run = () => {
    if (!drivers || !race) return
    clearInterval(timer.current)
    const sim = simulateRace(drivers, teams, race.laps || 52)
    setRunning(true)
    setResult(null)
    setLap(0)
    let current = 0
    timer.current = setInterval(() => {
      current += 1
      setLap(current)
      if (current >= sim.laps) {
        clearInterval(timer.current)
        setRunning(false)
        setResult(sim.result)
      }
    }, 240)
  }

  const runSeason = () => {
    if (!drivers) return
    setSeason(simulateSeason(drivers, teams, races))
  }

  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="SIMULATOR" title={t('sim.title')} sub={t('sim.sub')} />

        <div className="card" style={{ marginBottom: 22 }}>
          <div className="grid grid-2" style={{ gap: 12, alignItems: 'end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>{t('sim.chooseRace')}</label>
              <select className="input" value={race?.round ?? ''} onChange={(e) => setRaceRound(Number(e.target.value))} disabled={running}>
                {races.map((r) => <option key={r.round} value={r.round}>Rd.{r.round} {r.flag} {lang === 'ja' ? r.nameJa : r.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn primary" onClick={run} disabled={running || !drivers}>{running ? t('sim.running') : t('sim.run')}</button>
              <button className="btn" onClick={runSeason} disabled={!drivers || running}>{t('sim.seasonSim')}</button>
              <button className="btn ghost" onClick={() => { clearInterval(timer.current); setRunning(false); setResult(null); setLap(0); setSeason(null) }}>{t('sim.reset')}</button>
            </div>
          </div>
          {running && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="note">{t('sim.progress')}</span>
                <span className="num" style={{ color: 'var(--accent-2)' }}>LAP {lap}/{race.laps || 52}</span>
              </div>
              <div className="progress"><i style={{ width: `${(lap / (race.laps || 52)) * 100}%` }} /></div>
            </div>
          )}
        </div>

        {result && (
          <div className="card" style={{ marginBottom: 30 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="card-title" style={{ margin: 0 }}>{t('sim.results')} — Rd.{race.round} {lang === 'ja' ? race.nameJa : race.name}</h3>
              <Badge kind="gold">SIM</Badge>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('standings.position')}</th><th>{t('live.driver')}</th><th>{t('live.team')}</th><th>{t('sim.points')}</th><th>{t('live.gap')}</th><th>{t('live.lap')}</th></tr></thead>
                <tbody>
                  {result.map((r) => {
                    const d = drivers.find((x) => x.id === r.driverId)
                    const tm = teamById(teams, d?.team)
                    return (
                      <tr key={r.driverId}>
                        <td className="num" style={{ fontSize: 16, color: r.position <= 3 ? 'var(--accent-2)' : 'inherit' }}>{r.position}</td>
                        <td style={{ fontWeight: 700 }}>{d?.name}</td>
                        <td><span style={{ color: tm?.color, fontWeight: 700 }}>{tm?.name}</span></td>
                        <td className="num">{r.points}</td>
                        <td className="num">{r.status === 'DNF' ? 'DNF' : `+${r.gap?.toFixed(1)}`}</td>
                        <td className="num">{r.laps}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {season && (
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 12 }}>{t('sim.standings')} — {t('sim.seasonResults')}</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>{t('standings.position')}</th><th>{t('live.driver')}</th><th>{t('sim.points')}</th></tr></thead>
                  <tbody>
                    {season.drivers.slice(0, 21).map((x) => (
                      <tr key={x.driver.id}>
                        <td className="num" style={{ color: x.position <= 3 ? 'var(--accent-2)' : 'inherit' }}>{x.position}</td>
                        <td style={{ fontWeight: 700 }}>{x.driver.name}</td>
                        <td className="num">{x.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 12 }}>{t('sim.constructors')} — {t('sim.seasonResults')}</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>{t('standings.position')}</th><th>{t('standings.team')}</th><th>{t('sim.points')}</th></tr></thead>
                  <tbody>
                    {season.constructors.map((x) => {
                      const tm = teamById(teams, x.team)
                      return (
                        <tr key={x.team}>
                          <td className="num" style={{ color: x.position <= 3 ? 'var(--accent-2)' : 'inherit' }}>{x.position}</td>
                          <td style={{ fontWeight: 700 }}>{tm?.name || x.team}</td>
                          <td className="num">{x.points}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
