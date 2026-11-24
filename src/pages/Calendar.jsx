import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { getCalendar, useApi, usePolled } from '../lib/api.js'
import { SectionHead, Loading, Badge, Countdown } from '../components/common.jsx'
import { useLiveRefresh } from '../components/RefreshProvider.jsx'
import { fmtDate, nextRace, driverName, winnerLabel } from '../lib/utils.js'

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
    <div className="session-row">
      <span className="session-name">{lang === 'ja' ? (JA_SESSION[s.name] || s.name) : (EN_SESSION[s.name] || s.name)}</span>
      <span className="num note">{fmtDate(s.date, lang)} · {s.time}</span>
    </div>
  )
}

/** Per-race facts panel: circuit map, timetable, podium, official link. */
export function RaceDetail({ race, lang, result }) {
  const w = winnerLabel(result || {}, lang)
  const podium = result?.podium?.length ? result.podium : race.podium || []
  return (
    <div className="race-detail">
      {race.trackImage && (
        <img src={race.trackImage} alt={`${race.circuit || race.name} track map`} loading="lazy"
          className="track-map" />
      )}

      <dl className="fact-grid">
        <div><dt>{lang === 'ja' ? '公式名称' : 'Official title'}</dt><dd>{race.officialName || race.name}</dd></div>
        <div><dt>{lang === 'ja' ? 'ファーストGP' : 'First GP'}</dt><dd className="num">{race.firstGP ?? '—'}</dd></div>
        <div><dt>{lang === 'ja' ? '総距離' : 'Race distance'}</dt><dd className="num">{race.raceDistanceKm ?? '—'} km</dd></div>
        <div><dt>{lang === 'ja' ? 'ロケーション' : 'Location'}</dt><dd>{[race.location, race.countryJa || race.country].filter(Boolean).join(' · ') || '—'}</dd></div>
      </dl>

      {race.sessions?.length > 0 && (
        <section className="race-block">
          <h4 className="block-label">{lang === 'ja' ? 'セッション日程（現地時間）' : 'Session schedule (local time)'}</h4>
          {race.sessions.map((s, i) => <SessionRow key={`${s.name}-${i}`} s={s} lang={lang} />)}
        </section>
      )}

      {(podium.length > 0 || w.name) && (
        <section className="race-block">
          <h4 className="block-label gold">{lang === 'ja' ? '表彰台' : 'Podium'}</h4>
          {podium.length > 0 ? (
            <ol className="podium">
              {podium.map((p) => (
                <li key={p.position}>
                  <span className={`pos-chip pos-${p.position}`}>{p.position}</span>
                  <span className="podium-name">{driverName(p, lang)}</span>
                  {p.team && <span className="note">{p.team}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="note">{w.name}</p>
          )}
        </section>
      )}

      {race.officialUrl && (
        <a href={race.officialUrl} target="_blank" rel="noreferrer" className="btn sm ghost official-link">
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
          <div className="notice-banner">
            <Badge kind="gold">{t('fresh.archiveBanner')}</Badge>
            <span>{t('fresh.archiveMsg', { season: cal.seasonLabel })}</span>
          </div>
        )}
        {next && hasUpcoming && (
          <div className="card next-race">
            <div>
              <div className="eyebrow">{t('calendar.countdownTo')}</div>
              <h3 className="next-race-name">{next.flag} {lang === 'ja' ? next.nameJa : next.name}</h3>
            </div>
            <div><Countdown target={next.date + 'T12:00:00'} /></div>
          </div>
        )}

        <div className="grid calendar-grid">
          {races.map((r) => {
            const past = new Date(r.date + 'T23:59:59') < new Date()
            const isOpen = open === r.round
            const w = winnerLabel(resultsByRound[r.round] || {}, lang)
            return (
              <article className={`card race-card ${isOpen ? 'is-open' : ''} ${past ? 'is-past' : ''}`} key={r.round}>
                <header className="round-head">
                  <span className="round-chip">{t('calendar.roundLabel')} {r.round}</span>
                  {past ? <Badge kind="offline">{t('calendar.completed')}</Badge> : <Badge kind="ok">{t('calendar.upcoming')}</Badge>}
                </header>
                <h3 className="round-name">{r.flag} {lang === 'ja' ? r.nameJa : r.name}</h3>
                <p className="note round-circuit">{r.circuitJa || r.circuit} · {r.countryJa || r.country}</p>

                {w.name && (
                  <div className="winner-box">
                    <span className="winner-label">{t('results.winner')}</span>
                    <span className="winner-name">{w.name}</span>
                    {w.team && <span className="note">{w.team}</span>}
                  </div>
                )}

                <hr className="divider" />
                <dl className="fact-grid compact">
                  <div><dt>{t('calendar.raceDay')}</dt><dd className="num">{fmtDate(r.date, lang)}</dd></div>
                  <div><dt>{t('common.laps')} / {t('common.length')}</dt><dd className="num">{r.laps ?? '—'} / {r.lengthKm ?? '—'} km</dd></div>
                  <div><dt>{t('common.turns')} / {t('common.drsZones')}</dt><dd className="num">{r.turns ?? '—'} / {r.drsZones ?? '—'}</dd></div>
                  <div>
                    <dt>{t('common.lapRecord')}</dt>
                    <dd className="num">{r.lapRecord ? `${r.lapRecord.time} · ${r.lapRecord.driver} (${r.lapRecord.year})` : '—'}</dd>
                  </div>
                </dl>

                <button className="btn sm ghost round-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.round)}>
                  {isOpen ? t('results.hideDetail') : t('calendar.raceOverview')}
                  <span className="chev" aria-hidden="true">▾</span>
                </button>
                {isOpen && <RaceDetail race={r} lang={lang} result={resultsByRound[r.round]} />}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
