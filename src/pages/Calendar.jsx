import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { getCalendar } from '../lib/api.js'
import { SectionHead, Loading, Badge, Countdown } from '../components/common.jsx'
import { fmtDate, nextRace } from '../lib/utils.js'

export default function CalendarPage() {
  const { t, lang } = useLang()
  const [cal, setCal] = useState(null)
  const races = cal?.races || []
  const next = nextRace(races)
  const hasUpcoming = races.some((r) => new Date(r.date + 'T23:59:59') >= new Date())

  useEffect(() => { getCalendar(new Date().getFullYear()).then(setCal) }, [])
  if (!cal) return <div className="section container"><Loading /></div>

  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="2025 SEASON" title={t('calendar.title')} sub={t('calendar.sub')} />
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
            return (
              <div className="card" key={r.round} style={{ opacity: past ? 0.72 : 1 }}>
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
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
