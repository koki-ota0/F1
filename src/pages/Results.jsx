import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { getResults, getRaceResult } from '../lib/api.js'
import { SectionHead, Loading, EmptyState, Badge } from '../components/common.jsx'
import { fmtDate } from '../lib/utils.js'

const ARCHIVE_SEASON = 2025

export default function Results() {
  const { t, lang } = useLang()
  const current = new Date().getFullYear()
  const [year, setYear] = useState(ARCHIVE_SEASON)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openRound, setOpenRound] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(() => {
    let alive = true
    setLoading(true)
    getResults(year).then((d) => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [year])

  useEffect(() => { const c = load(); return c }, [load])

  const openDetail = async (round) => {
    setOpenRound(round.round)
    setDetail(null)
    setDetailLoading(true)
    try {
      const d = await getRaceResult(year, round.round)
      setDetail({ ...d, round })
    } finally {
      setDetailLoading(false)
    }
  }

  const sourceBadge = useMemo(() => {
    if (!data) return null
    if (data.source === 'live') return <Badge kind="live">{t('results.live')}</Badge>
    if (data.source === 'archive') return <Badge kind="gold">{t('results.archive')}</Badge>
    return <Badge>{t('common.offline')}</Badge>
  }, [data, t])

  const rounds = data?.rounds || []

  return (
    <section className="section">
      <div className="container">
        <SectionHead
          eyebrow="RACE RESULTS"
          title={t('results.title')}
          sub={t('results.sub')}
          right={sourceBadge}
        />

        <div className="tabs" style={{ marginBottom: 20 }}>
          {[current, ARCHIVE_SEASON].map((y) => (
            <button key={y} className={year === y ? 'on' : ''} onClick={() => { setYear(y); setOpenRound(null); setDetail(null) }}>
              {y}{t('results.seasonSuffix')}
            </button>
          ))}
        </div>

        {data?.source === 'archive' && (
          <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(245,192,68,.45)', background: 'rgba(245,192,68,.07)' }}>
            <Badge kind="gold">{t('results.archiveBanner')}</Badge>
            <span className="note" style={{ marginLeft: 8 }}>{t('results.archiveMsg')}</span>
          </div>
        )}

        {loading ? <Loading /> : rounds.length === 0 ? (
          <EmptyState icon="🏁" title={t('results.empty')} />
        ) : (
          <div className="grid grid-3" style={{ gap: 16 }}>
            {rounds.map((r) => {
              const isOpen = openRound === r.round
              return (
                <div className="card" key={`${r.round}-${r.name}`} style={isOpen ? { borderColor: 'var(--accent-2)', boxShadow: '0 0 0 1px var(--accent-2) inset' } : undefined}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <span className="num" style={{ fontSize: 22, color: 'var(--gold)' }}>Rd.{r.round}</span>
                    <span className="note">{fmtDate(r.date)}</span>
                  </div>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 16, margin: '8px 0 2px' }}>
                    {lang === 'ja' ? (r.nameJa || r.name) : r.name}
                  </h4>
                  <div className="note" style={{ marginBottom: 10 }}>{r.circuit}</div>
                  {r.winner && (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                      <Row label={t('results.winner')} value={lang === 'ja' ? (r.winnerJa || r.winner) : r.winner} strong />
                      <Row label={t('results.pole')} value={lang === 'ja' ? (r.poleJa || r.pole) : r.pole} />
                      <Row label={t('results.fastestLap')} value={lang === 'ja' ? (r.flJa || r.fastestLap) : r.fastestLap} />
                    </div>
                  )}
                  <button className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => (isOpen ? setOpenRound(null) : openDetail(r))}>
                    {isOpen ? t('results.hideDetail') : t('results.detail')}
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                      {detailLoading ? <Loading /> : detail?.classification?.length ? (
                        <table className="table" style={{ fontSize: 13 }}>
                          <thead>
                            <tr><th>{t('standings.position')}</th><th>{t('standings.driver')}</th><th>{t('standings.points')}</th></tr>
                          </thead>
                          <tbody>
                            {detail.classification.slice(0, 20).map((c) => (
                              <tr key={`${c.position}-${c.driver}`}>
                                <td className="num">{c.position}</td>
                                <td>{c.driver}{c.team ? <span className="note"> · {c.team}</span> : null}</td>
                                <td className="num">{c.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="note" style={{ margin: 0 }}>
                          {t('results.noDetail')} {detail?.source === 'archive' ? t('results.archiveNoDetail') : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function Row({ label, value, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '2px 0' }}>
      <span className="note">{label}</span>
      <span style={strong ? { fontWeight: 800, color: 'var(--accent-2)' } : undefined}>{value || '—'}</span>
    </div>
  )
}
