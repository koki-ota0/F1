import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { getCalendar } from '../lib/api.js'
import { loadClientLive, refreshLive, readStatus } from '../lib/live.js'
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

const fmtGap = (seconds) => {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  return m > 0 ? `+${m}:${String(Math.round(s % 60)).padStart(2, '0')}` : `+${s.toFixed(1)}`
}
const fmtAge = (iso) => {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return mins < 1 ? '<1m' : `${mins}m`
}
const fmtTime = (seconds) => {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3).padStart(6, '0')
  return `${m}:${s}`
}

export default function Live() {
  const { t, lang } = useLang()
  const { teams } = useFan()
  const [cal, setCal] = useState(null)
  const [live, setLive] = useState(null)
  const [loadingLive, setLoadingLive] = useState(true)
  // Static hosts (GitHub Pages): on-demand only — no interval polling. The
  // Express host can auto-poll because the server caches the upstream APIs.
  const [staticHost] = useState(() => {
    if (typeof window === 'undefined') return true
    return !window.__PITWALL_API__
  })

  const race = nextRace(cal?.races || [])
  const schedule = buildSchedule(race)

  const loadLive = useCallback(async () => {
    setLoadingLive(true)
    try {
      const data = await loadClientLive(new Date().getFullYear())
      setLive(data)
    } catch {
      // no browser-direct access (blocked/offline): fall back to the navbar refresh
      try {
        await refreshLive(new Date().getFullYear())
        setLive({ source: 'offline', note: 'refresh-unavailable' })
      } catch {
        setLive({ source: 'offline' })
      }
    } finally {
      setLoadingLive(false)
    }
  }, [])

  useEffect(() => { getCalendar(new Date().getFullYear()).then(setCal) }, [])

  useEffect(() => {
    loadLive()
    if (staticHost) return undefined            // on-demand only (GitHub Pages)
    const id = setInterval(loadLive, 30000)
    return () => clearInterval(id)
  }, [loadLive, staticHost])

  useEffect(() => {
    const handler = () => loadLive()
    window.addEventListener('pitwall:live-refreshed', handler)
    return () => window.removeEventListener('pitwall:live-refreshed', handler)
  }, [loadLive])

  const mode = live?.source === 'live' ? 'live' : live?.source === 'result' ? 'result' : 'offline'
  const positions = live?.positions || []
  const classification = live?.classification || []
  const weather = live?.weather

  // normalise both shapes: OpenF1 raw rows and our server directory entries
  const infoByNumber = new Map((live?.drivers || []).map((d) => {
    const n = String(d.number ?? d.driver_number)
    return [n, {
      name: d.name || d.full_name || `#${n}`,
      team: d.team || d.team_name || '',
      colour: d.teamColour || d.team_colour || null
    }]
  }))
  const teamOf = (number) => {
    const info = infoByNumber.get(String(number))
    if (!info?.team) return null
    return teams.find((x) => x.name?.toLowerCase() === info.team.toLowerCase()) || null
  }

  const status = readStatus()

  return (
    <section className="section">
      <div className="container">
        <SectionHead
          eyebrow="TIMING TOWER"
          title={t('live.title')}
          sub={t('live.sub')}
          right={<LiveBadge live={mode === 'live'} />}
        />

        {loadingLive ? <Loading /> : mode === 'offline' && (
          <div className="card" style={{ marginBottom: 22, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 30 }}>📡</div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>{t('live.offlineMode')}</h3>
              <p className="note" style={{ margin: '6px 0 0' }}>
                {staticHost ? t('live.staticHint') : t('live.offlineMsg')}
              </p>
              {status.at && (
                <p className="note" style={{ margin: '6px 0 0' }}>
                  {t('fresh.updated')}: {new Date(status.at).toLocaleString()} · {status.okCount}/{status.results.length} {t('live.sourcesOk')}
                </p>
              )}
            </div>
          </div>
        )}

        {mode !== 'offline' && (
          <>
            <div className="grid grid-2" style={{ marginBottom: 22 }}>
              <div className="card">
                <div className="eyebrow" style={{ fontFamily: 'var(--font-num)', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--accent-2)', fontSize: 12, fontWeight: 700 }}>
                  {mode === 'live' ? t('live.weather') : t('results.winner')} · {live.meetingName}
                </div>
                <div className="weather-grid" style={{ marginTop: 12 }}>
                  <div className="weather-cell"><b>{weather?.air_temperature ?? '—'}°</b><span>{t('live.airTemp')}</span></div>
                  <div className="weather-cell"><b>{weather?.track_temperature ?? '—'}°</b><span>{t('live.trackTemp')}</span></div>
                  <div className="weather-cell"><b>{weather?.humidity ?? '—'}%</b><span>{t('live.humidity')}</span></div>
                  <div className="weather-cell"><b>{weather?.wind_speed ?? '—'} m/s</b><span>{t('live.wind')}</span></div>
                  <div className="weather-cell"><b>{weather?.rainfall ?? 0}</b><span>{t('live.rainProb')}</span></div>
                </div>
              </div>
              <div className="card">
                <div className="eyebrow" style={{ fontFamily: 'var(--font-num)', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--accent-2)', fontSize: 12, fontWeight: 700 }}>{t('live.sessionInfo')}</div>
                <p className="note" style={{ marginTop: 12 }}>
                  {live.circuit ? `${live.circuit} · ` : ''}{live.dateStart ? new Date(live.dateStart).toLocaleString() : '—'}
                </p>
                <p className="note">{t('live.provider')}: {live.provider}{RELAYS_SUFFIX()}</p>
                {mode === 'live'
                  ? <p className="note">{t('standings.position')}: {positions.length} · {t('live.dataAge')}: {fmtAge(live.window?.to)}</p>
                  : <p className="note">{t('live.finalLabel')} · {t('live.dataAge')}: {fmtAge(live.dateEnd)}</p>}
                <div className="pill-row" style={{ marginTop: 12 }}>
                  {mode === 'live'
                    ? <Badge kind="live">{t('common.live')}</Badge>
                    : <Badge kind="ok">{t('live.finalBadge')}</Badge>}
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('standings.position')}</th>
                    <th>{t('live.driver')}</th>
                    <th>{t('live.team')}</th>
                    {mode === 'live' ? <><th className="num">{t('live.gap')}</th><th className="num">{t('live.lap')}</th></>
                      : <><th className="num">{t('standings.points')}</th><th>{t('live.time')}</th><th>{t('common.status')}</th></>}
                  </tr>
                </thead>
                <tbody>
                  {(mode === 'live' ? positions : classification).slice(0, 25).map((row) => {
                    const n = row.driver_number ?? row.number
                    const info = infoByNumber.get(String(n))
                    const team = teamOf(n)
                    return (
                      <tr key={n}>
                        <td className="num" style={{ fontSize: 17, color: Number(row.position) <= 3 ? 'var(--accent-2)' : 'inherit' }}>{row.position ?? '—'}</td>
                        <td style={{ fontWeight: 700 }}>{info?.name || (row.driver ? `#${n} ${row.driver}` : `#${n}`)}</td>
                        <td>{team ? team.name : (info?.team || row.team || '—')}</td>
                        {mode === 'live'
                          ? <><td className="num">{Number(row.position) === 1 ? '—' : fmtGap(row.gap_to_leader)}</td><td className="num">{row.lap_number ?? '—'}</td></>
                          : <><td className="num">{row.points ?? 0}</td><td className="num">{fmtTime(row.time)}</td><td className="note">{row.status || (row.laps ? `${row.laps} ${t('live.lap').toLowerCase()}` : '')}</td></>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!isOffline(mode) && !loadingLive && cal && <EmptyState label={t('live.noLive')} />}

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

const isOffline = (mode) => mode === 'offline'

function RELAYS_SUFFIX() {
  try {
    const st = JSON.parse(localStorage.getItem('pitwall.live.status') || '{}')
    const n = st?.relays || 0
    return n ? ` (${n} relay${n > 1 ? 's' : ''})` : ''
  } catch { return '' }
}
