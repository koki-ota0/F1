import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { useApi, getJSON, getCalendar } from '../lib/api.js'
import { SectionHead, Loading, EmptyState, LiveBadge, Badge } from '../components/common.jsx'
import { fmtDate, nextRace } from '../lib/utils.js'
import { useFan } from '../components/FanProvider.jsx'

function buildSchedule(race) {
  if (!race?.date) return []
  const d = new Date(race.date + 'T12:00:00')
  const mk = (offset, name) => {
    const dt = new Date(d)
    dt.setDate(dt.getDate() + offset)
    return { name, date: dt.toISOString().slice(0, 10) }
  }
  return [
    mk(-2, 'FP1'), mk(-2, 'FP2'),
    mk(-1, 'FP3'), mk(-1, 'QUALI'),
    mk(0, 'RACE')
  ]
}

export default function Live() {
  const { t, lang } = useLang()
  const { teams } = useFan()
  const [cal, setCal] = useState(null)
  const [live, setLive] = useState(null)
  const [loadingLive, setLoadingLive] = useState(true)

  const race = nextRace(cal?.races || [])
  const schedule = buildSchedule(race)

  const loadLive = () => {
    setLoadingLive(true)
    getJSON('/api/live?year=2025')
      .then(setLive)
      .catch(() => setLive({ source: 'offline' }))
      .finally(() => setLoadingLive(false))
  }

  useEffect(() => {
    getCalendar(new Date().getFullYear()).then(setCal)
  }, [])

  useEffect(() => {
    loadLive()
    const id = setInterval(loadLive, 30000)
    return () => clearInterval(id)
  }, [])

  const isLive = live?.source === 'live'
  const pos = live?.positions || []
  const drv = live?.drivers || []
  const weather = live?.weather

  const driverInfo = (number) => drv.find((d) => String(d.driver_number) === String(number))
  const teamOf = (number) => {
    const d = driverInfo(number)
    if (!d) return null
    return teams.find((x) => x.id === (d.team_id || d.team_name || '').toLowerCase().replace(/\s+/g, '-')) || null
  }

  return (
    <section className="section">
      <div className="container">
        <SectionHead
          eyebrow="TIMING TOWER"
          title={t('live.title')}
          sub={t('live.sub')}
          right={<LiveBadge live={isLive} />}
        />

        {loadingLive ? <Loading /> : !isLive && (
          <div className="card" style={{ marginBottom: 22, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 30 }}>📡</div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>{t('live.offlineMode')}</h3>
              <p className="note" style={{ margin: '6px 0 0' }}>{t('live.offlineMsg')}</p>
            </div>
          </div>
        )}

        {isLive && (
          <>
            <div className="grid grid-2" style={{ marginBottom: 22 }}>
              <div className="card">
                <div className="eyebrow" style={{ fontFamily: 'var(--font-num)', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--accent-2)', fontSize: 12, fontWeight: 700 }}>{t('live.weather')}</div>
                <div className="weather-grid" style={{ marginTop: 12 }}>
                  <div className="weather-cell"><b>{weather?.air_temperature ?? '—'}°</b><span>{t('live.airTemp')}</span></div>
                  <div className="weather-cell"><b>{weather?.track_temperature ?? '—'}°</b><span>{t('live.trackTemp')}</span></div>
                  <div className="weather-cell"><b>{weather?.humidity ?? '—'}%</b><span>{t('live.humidity')}</span></div>
                  <div className="weather-cell"><b>{weather?.wind_speed ?? '—'} m/s</b><span>{t('live.wind')}</span></div>
                  <div className="weather-cell"><b>{weather?.rainfall ?? 0}</b><span>{t('live.rainProb')}</span></div>
                </div>
              </div>
              <div className="card">
                <div className="eyebrow" style={{ fontFamily: 'var(--font-num)', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--accent-2)', fontSize: 12, fontWeight: 700 }}>{t('live.notes')}</div>
                <div className="pill-row" style={{ marginTop: 12 }}>
                  <Badge kind="offline">Green</Badge>
                  <Badge kind="gold">Yellow</Badge>
                  <Badge kind="live">SC</Badge>
                  <Badge kind="offline">Red</Badge>
                </div>
                <p className="note" style={{ marginTop: 14 }}>{t('common.lastUpdate')}: {new Date().toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('standings.position')}</th>
                    <th>{t('live.driver')}</th>
                    <th>{t('live.team')}</th>
                    <th>{t('live.gap')}</th>
                    <th>{t('live.lap')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.slice(0, 20).map((p) => {
                    const info = driverInfo(p.driver_number)
                    const team = teamOf(p.driver_number)
                    return (
                      <tr key={p.driver_number}>
                        <td className="num" style={{ fontSize: 17, color: p.position <= 3 ? 'var(--accent-2)' : 'inherit' }}>{p.position}</td>
                        <td style={{ fontWeight: 700 }}>{info ? `${info.first_name?.[0] ?? ''}. ${info.last_name}` : `#${p.driver_number}`}</td>
                        <td>{team ? team.name : info?.team_name || '—'}</td>
                        <td className="num">{p.position === 1 ? '—' : '+' + (p.position * 1.8).toFixed(1)}</td>
                        <td className="num">—</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={{ marginTop: 30 }}>
          <SectionHead eyebrow="SCHEDULE" title={t('live.sessionSchedule')} sub={race ? `${race.flag} ${lang === 'ja' ? race.nameJa : race.name} · ${fmtDate(race.date, lang)}` : ''} />
          <div className="grid grid-3">
            {schedule.map((s) => {
              const past = new Date(s.date + 'T23:59:59') < new Date()
              return (
                <div className="card" key={s.name + s.date} style={{ opacity: past ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="tag" style={{ fontSize: 13, padding: '5px 12px' }}>{s.name}</span>
                    {past ? <Badge kind="offline">{t('calendar.completed')}</Badge> : <Badge kind="ok">{t('calendar.upcoming')}</Badge>}
                  </div>
                  <div className="note" style={{ marginTop: 10 }}>{fmtDate(s.date, lang)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
