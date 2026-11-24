import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../lib/i18n.jsx'
import { useApi, usePolled, getJSON, getCalendar } from '../lib/api.js'

import { useFan } from '../components/FanProvider.jsx'
import { useRefresh, useLiveRefresh } from '../components/RefreshProvider.jsx'
import { SectionHead, Countdown, Ticker, LiveBadge, Loading, Badge } from '../components/common.jsx'
import { DriverCard, TeamCard } from '../components/Cards.jsx'
import { nextRace, fmtDate, winnerLabel } from '../lib/utils.js'

export default function Home() {
  const { t, lang } = useLang()
  const { fan, teams } = useFan()
  const { data: drivers, loading: dLoading } = useApi('/api/drivers', [], { refreshMs: 120000 })
  const meta = usePolled('/api/meta', 60000)
  const { status } = useRefresh()
  const [cal, setCal] = useState(null)
  const [news, setNews] = useState([])
  const [records, setRecords] = useState([])
  const [champions, setChampions] = useState([])
  const { data: resultsData } = useApi('/api/results')

  const run = useCallback(() => {
    let alive = true
    getCalendar(new Date().getFullYear()).then((d) => alive && setCal(d))
    getJSON('/api/news').then((d) => alive && setNews(d.items || [])).catch(() => {})
    getJSON('/api/records').then((d) => alive && setRecords(d)).catch(() => {})
    getJSON('/api/champions').then((d) => alive && setChampions(d)).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const cleanup = run()
    const isStatic = meta?.mode === 'static-host'
    const id = isStatic ? null : setInterval(run, 300000)
    return () => { cleanup(); if (id) clearInterval(id) }
  }, [run, meta?.mode])

  useLiveRefresh(run)

  const races = cal?.races || []
  const next = nextRace(races)
  const now = new Date()
  const hasUpcoming = races.some((r) => new Date(r.date + 'T23:59:59') >= now)
  const liveNow = next && Math.abs(new Date(next.date + 'T12:00:00') - now) < 2 * 86400000
  const myDriver = drivers?.find((d) => d.id === fan.driver) || null
  const myTeam = teams.find((x) => x.id === fan.team) || null
  const recentWinners = (resultsData?.rounds || []).filter((r) => r.winner && r.winner.name).slice(0, 6)
  const upcoming = [...races].filter((r) => new Date(r.date + 'T23:59:59') >= now).slice(0, 3)

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-kicker">{t('home.heroKicker')}</div>
          <h1>{t('home.heroTitle1')}<br /><em>{t('home.heroTitle2')}</em></h1>
          <p className="lead">{t('home.heroLead')}</p>

          <div className="grid grid-2" style={{ marginTop: 26, alignItems: 'stretch' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div className="eyebrow">{t('home.nextRace')}</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '8px 0 4px' }}>
                    {next ? `${next.flag} ${lang === 'ja' ? next.nameJa : next.name}` : t('home.noUpcoming')}
                  </h3>
                  <div className="note">{next ? `${next.circuitJa || next.circuit} · ${fmtDate(next.date, lang)}` : ''}</div>
                </div>
                <LiveBadge live={!!liveNow} />
              </div>
              {next && hasUpcoming && (
                <div style={{ marginTop: 16 }}>
                  <div className="note" style={{ marginBottom: 8 }}>{t('home.countdown')}</div>
                  <Countdown target={next.date + 'T12:00:00'} />
                </div>
              )}
              {next && !hasUpcoming && (
                <div className="note" style={{ marginTop: 14 }}>{t('home.noUpcoming')}</div>
              )}
              <div className="pill-row" style={{ marginTop: 16 }}>
                {['FP1', 'FP2', 'FP3', 'Q', 'R'].map((s) => <span className="tag" key={s}>{s}</span>)}
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <div className="eyebrow">{t('home.fanCtaTitle')}</div>
                {myDriver || myTeam ? (
                  <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {myDriver && (
                      <Link to={`/drivers/${myDriver.id}`} className="tag" style={{ fontSize: 13, padding: '6px 12px' }}>★ {myDriver.name}</Link>
                    )}
                    {myTeam && (
                      <Link to={`/teams/${myTeam.id}`} className="tag" style={{ fontSize: 13, padding: '6px 12px', background: myTeam.color, color: '#fff' }}>{myTeam.name}</Link>
                    )}
                  </div>
                ) : (
                  <p className="note" style={{ marginTop: 10 }}>{t('home.fanCtaSub')}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link className="btn primary" to="/fan">{t('home.pickFavorites')}</Link>
                <Link className="btn" to="/standings">{t('home.viewStandings')}</Link>
                <Link className="btn ghost" to="/calendar">{t('home.viewCalendar')}</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="note" style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Badge kind="ok">{t('fresh.live')}</Badge>
          {t('fresh.updated')}: {(meta?.lastSyncAt || status?.at) ? new Date(meta?.lastSyncAt || status.at).toLocaleTimeString() : '—'} · {meta?.mode === 'static-host' ? t('fresh.manual') : t('fresh.auto')}
        </div>
      </section>

      {cal?.source === 'offline' && cal?.seasonLabel && (
        <div className="container" style={{ paddingTop: 16 }}>
          <div className="card" style={{ borderColor: 'rgba(245,192,68,.45)', background: 'rgba(245,192,68,.07)' }}>
            <Badge kind="gold">{t('fresh.archiveBanner')}</Badge>
            <span className="note" style={{ marginLeft: 8 }}>{t('fresh.archiveMsg', { season: cal.seasonLabel })}</span>
          </div>
        </div>
      )}

      {recentWinners.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <SectionHead eyebrow="RESULTS" title={t('results.title')} sub={t('results.sub')}
              right={<Link className="btn sm" to="/results">{t('common.viewAll')}</Link>} />
            <div className="winner-strip">
              {recentWinners.map((r) => {
                const w = winnerLabel(r, lang)
                return (
                  <Link to="/results" className="card hover winner-tile" key={r.round}>
                    <span className="round-chip">Rd {r.round}</span>
                    <span className="winner-label">{t('results.winner')}</span>
                    <span className="winner-name">{w.name}</span>
                    <span className="note">{lang === "ja" ? (r.nameJa || r.name) : r.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <Ticker items={news} />

      <section className="section">
        <div className="container">
          <SectionHead eyebrow="PLAY" title={t('home.gamesTitle')} sub={t('home.gamesSub')} />
          <div className="grid grid-3">
            <Link to="/predict" className="card hover">
              <div style={{ fontSize: 34 }}>🎯</div>
              <h3 className="card-title" style={{ margin: '10px 0 6px' }}>{t('nav.predict')}</h3>
              <p className="note">{t('home.predictCta')}</p>
            </Link>
            <Link to="/sim" className="card hover">
              <div style={{ fontSize: 34 }}>🏎️</div>
              <h3 className="card-title" style={{ margin: '10px 0 6px' }}>{t('nav.sim')}</h3>
              <p className="note">{t('home.simCta')}</p>
            </Link>
            <Link to="/quiz" className="card hover">
              <div style={{ fontSize: 34 }}>🧠</div>
              <h3 className="card-title" style={{ margin: '10px 0 6px' }}>{t('nav.quiz')}</h3>
              <p className="note">{t('home.quizCta')}</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <SectionHead eyebrow="RECORDS" title={t('home.topRecords')} right={<Link className="btn sm" to="/standings">{t('common.viewAll')}</Link>} />
          {records.length ? (
            <div className="grid grid-3">
              {records.slice(0, 6).map((r) => (
                <div className="card" key={r.id}>
                  <div className="note" style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{lang === 'ja' ? r.labelJa : r.label}</div>
                  <div className="num" style={{ fontSize: 34, margin: '6px 0' }}>{r.value}</div>
                  <div style={{ fontWeight: 700 }}>{lang === 'ja' ? r.holderJa : r.holder}</div>
                  <div className="note" style={{ marginTop: 4 }}>{r.asOf}</div>
                </div>
              ))}
            </div>
          ) : <Loading />}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <SectionHead eyebrow="CHAMPIONS" title={t('home.championsTitle')} />
          <div className="card" style={{ display: 'flex', gap: 26, overflowX: 'auto', padding: '18px 22px' }}>
            {champions.slice(0, 8).map((c) => (
              <div key={c.year} style={{ minWidth: 190 }}>
                <div className="num" style={{ fontSize: 26, color: 'var(--gold)' }}>{c.year}</div>
                <div style={{ fontWeight: 800 }}>{lang === 'ja' ? c.driverJa : c.driver}</div>
                <div className="note">{lang === 'ja' ? c.teamJa : c.team}</div>
                <div className="note" style={{ marginTop: 4 }}>{c.points} pts</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <SectionHead eyebrow="UPCOMING" title={t('home.upcomingTitle')} right={<Link className="btn sm" to="/calendar">{t('common.viewAll')}</Link>} />
          <div className="grid grid-3">
            {upcoming.map((r) => (
              <Link to="/calendar" className="card hover" key={r.round}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="tag">{t('calendar.roundLabel')} {r.round}</span>
                  <span className="note">{fmtDate(r.date, lang)}</span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', margin: '12px 0 4px', fontSize: 18 }}>{r.flag} {lang === 'ja' ? r.nameJa : r.name}</h3>
                <div className="note">{r.circuitJa || r.circuit}</div>
              </Link>
            ))}
            {!upcoming.length && <div className="empty-feed">{t('home.noUpcoming')}</div>}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <SectionHead eyebrow="NEW FANS" title={t('home.guideTitle')} sub={t('home.guideSub')} />
          <div className="card">
            <dl className="glossary" style={{ margin: 0 }}>
              {['drs', 'understeer', 'overtake', 'slipstream', 'safetycar', 'degradation'].map((k) => (
                <div key={k}>
                  <dt>{t(`glossary.${k}`)}</dt>
                  <dd>{t(`glossary.${k}.d`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </>
  )
}
