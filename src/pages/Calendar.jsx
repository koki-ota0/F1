import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { getCalendar, useApi, usePolled } from '../lib/api.js'
import { SectionHead, Loading, Badge, Countdown } from '../components/common.jsx'
import { useLiveRefresh } from '../components/RefreshProvider.jsx'
import { fmtDate, nextRace } from '../lib/utils.js'

const JA_SESSION = {
  FP1: 'FP1', FP2: 'FP2', FP3: 'FP3', Qualifying: '予選',
  'Sprint Qualifying': 'スプリント予選', Sprint: 'スプリント', Race: 'レース'
}
const EN_SESSION = {
  FP1: 'FP1', FP2: 'FP2', FP3: 'FP3', Qualifying: 'Qualifying',
  'Sprint Qualifying': 'Sprint Qualifying', Sprint: 'Sprint', Race: 'Race'
}

function SessionRow({ s, lang }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="note" style={{ color: 'var(--text)', fontWeight: 600 }}>{lang === 'ja' ? (JA_SESSION[s.name] || s.name) : (EN_SESSION[s.name] || s.name)}</span>
      <span className="num note">{fmtDate(s.date, lang)} · {s.time}</span>
    </div>
  )
}

/** Per-race facts panel (circuit + timetable + podium). */
export function RaceDetail({ race, lang, resultsByRound }) {
  const result = resultsByRound?.[race.round]
  const winner = result?.winner?.name || result?.winner?.nameJa || ''
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
      {race.trackImage && (
        <img src={race.trackImage} alt={`${race.circuit || race.name} track map`} loading="lazy"
          style={{ width: '100%', borderRadius: 10, display: 'block', marginBottom: 14, border: '1px solid var(--line)' }} />
      )}
      <div className="grid grid-2" style={{ gap: 10, marginBottom: 12 }}>
        <div className="note">{lang === 'ja' ? '公式名称' : 'Official title'}<br /><b style={{ color: 'var(--text)' }}>{race.officialName || race.name}</b></div>
        <div className="note">{lang === 'ja' ? 'ファーストGP' : 'First GP'}<br /><b className="num" style={{ color: 'var(--text)' }}>{race.firstGP ?? '—'}</b></div>
        <div className="note">{lang === 'ja' ? '総距離' : 'Race distance'}<br /><b className="num" style={{ color: 'var(--text)' }}>{race.raceDistanceKm ?? '—'} km</b></div>
        <div className="note">{lang === 'ja' ? 'ロケーション' : 'Location'}<br /><b style={{ color: 'var(--text)' }}>{[race.location, race.countryJa || race.country].filter(Boolean).join(' · ') || '—'}</b></div>
      </div>
      {(race.sessions?.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          <div className="eyebrow" style={{ fontFamily: 'var(--font-num)', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--accent-2)', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
            {lang === 'ja' ? 'セッション日程（現地時間）' : 'Session schedule (local time)'}
          </div>
          {race.sessions.map((s, i) => <SessionRow key={`${s.name}-${i}`} s={s} lang={lang} />)}
        </div>
      )}
      {(race.podium?.length > 0 || result?.podium?.length > 0 || winner) && (
        <div>
          <div className="eyebrow" style={{ fontFamily: 'var(--font-num)', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
            {lang === 'ja' ? '表彰台' : 'Podium'}
          </div>
          {(result?.podium || race.podium || []).map((p) => (
            <div key={p.position} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 0' }}>
              <span className="num" style={{ width: 22, color: 'var(--gold)', fontWeight: 800 }}>{p.position}</span>
              <span style={{ fontWeight: 600 }}>{lang === 'ja' ? (p.nameJa || p.name) : p.name}</span>
              <span className="note">· {p.team}</span>
            </div>
          ))}
          {!result?.podium?.length && !race.podium?.length && winner && (
            <span>{winner}</span>
          )}
        </div>
      )}
      {race.officialUrl && (
        <a href={race.officialUrl} target="_blank" rel="noreferrer" className="btn sm ghost" style={{ marginTop: 14, display: 'inline-block' }}>
          {lang === 'ja' ? 'F1公式レースページへ' : 'Official F1 race page'} ↗
        </a>
      )}
    </div>
  )
}

export default function CalendarPage() {
  const { t, lang } = useLang()
  const [cal, setCal] = useState(null)
  const [open, setOpen] = useState(null)   // round number with the detail panel open
  // per-round results so a completed race can show its podium in the overview
  const { data: resData } = useApi('/api/results')
  const resultsByRound = useMemo(() => {
    const out = {}
    for (const r of resData?.rounds || []) out[r.round] = r
    return out
  }, [resData])
  const meta = usePolled('/api/meta', 60000)
  const races = useMemo(() => cal?.races || [], [cal])
  const next = nextRace(races)
  const hasUpcoming = races.some((r) => new Date(r.date + 'T23:59:59') >= new Date())

  const run = useCallback(() => {
    let alive = true
    getCalendar(new Date().getFullYear()).then((d) => alive && setCal(d))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const cleanup = run()
    // background polling only where an API server exists (GitHub Pages = manual)
    const isStatic = meta?.mode === 'static-host'
    const id = isStatic ? null : setInterval(run, 120000)
    return () => { cleanup(); if (id) clearInterval(id) }
  }, [run, meta?.mode])

  useLiveRefresh(run)
  if (!cal) return <div className="section container"><Loading /></div>

  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow={`SEASON ${cal.seasonLabel || cal.season || ''}`} title={t('calendar.title')} sub={t('calendar.sub')} />
        {cal.source === 'offline' && cal.seasonLabel && (
          <div className="card" style={{ marginBottom: 22, borderColor: 'rgba(245,192,68,.45)', background: 'rgba(245,192,68,.07)' }}>
            <Badge kind="gold">{t('fresh.archiveBanner')}</Badge>
            <span className="note" style={{ marginLeft: 8 }}>{t('fresh.archiveMsg', { season: cal.seasonLabel })}</span>
          </div>
        )}
        {next && hasUpcoming && (
          <div className="card" style={{ marginBottom: 22, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="eyebrow" style={{ fontFamily: 'var(--font-num)', letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--accent-2)', fontSize: 12, fontWeight: 700 }}>{t('calendar.countdownTo')}</div>
              <h3 style={{ fontFamily: 'var(--font-display)', margin: '8px 0 0', fontSize: 24 }}>{next.flag} {lang === 'ja' ? next.nameJa : next.name}</h3>
            </div>
            <div><Countdown target={next.date + 'T12:00:00'} /></div>
          </div>
        )}
        <div className="grid">
          {races.map((r) => {
            const past = new Date(r.date + 'T23:59:59') < new Date()
            const isOpen = open === r.round
            return (
              <div className="card" key={r.round} style={{ opacity: past ? 0.78 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="tag" style={{ fontSize: 13, padding: '5px 12px' }}>{t('calendar.roundLabel')} {r.round}</span>
                  {past ? <Badge kind="offline">{t('calendar.completed')}</Badge> : <Badge kind="ok">{t('calendar.upcoming')}</Badge>}
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, margin: '12px 0 2px' }}>{r.flag} {lang === 'ja' ? r.nameJa : r.name}</h3>
                <div className="note">{r.circuitJa || r.circuit} · {r.countryJa || r.country}</div>
                <hr className="divider" />
                <div className="grid grid-2" style={{ gap: 10 }}>
                  <div className="note">{t('calendar.raceDay')}<br /><b className="num" style={{ color: 'var(--text)' }}>{fmtDate(r.date, lang)}</b></div>
                  <div className="note">{t('common.laps')} / {t('common.length')}<br /><b className="num" style={{ color: 'var(--text)' }}>{r.laps ?? '—'} / {r.lengthKm ?? '—'} km</b></div>
                  <div className="note">{t('common.turns')} / {t('common.drsZones')}<br /><b className="num" style={{ color: 'var(--text)' }}>{r.turns ?? '—'} / {r.drsZones ?? '—'}</b></div>
                  <div className="note">{t('common.lapRecord')}<br />
                    <b className="num" style={{ color: 'var(--text)' }}>{r.lapRecord ? `${r.lapRecord.time} · ${r.lapRecord.driver} (${r.lapRecord.year})` : '—'}</b>
                  </div>
                </div>
                <button className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => setOpen(isOpen ? null : r.round)}>
                  {isOpen ? t('results.hideDetail') : t('calendar.raceOverview')}
                </button>
                {isOpen && <RaceDetail race={r} lang={lang} resultsByRound={resultsByRound} />}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
