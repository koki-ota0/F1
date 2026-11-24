import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { getResults, getRaceResult, useApi } from '../lib/api.js'
import { SectionHead, Loading, EmptyState, Badge } from '../components/common.jsx'
import { fmtDate, fmtGap, driverName, winnerLabel } from '../lib/utils.js'

const ARCHIVE_SEASON = 2025

/**
 * RACE RESULTS.
 *
 * One card per round with a consistent hierarchy (round → race → facts), and a
 * full classification panel that scrolls inside its own frame instead of
 * stretching the card. Winner names are resolved through driverName() so a
 * live row that only carries a number still shows a person.
 */
export default function Results() {
  const { t, lang } = useLang()
  const current = new Date().getFullYear()
  const [year, setYear] = useState(current)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openRound, setOpenRound] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const panelRef = useRef(null)

  // Opening a full classification renders the panel under the card grid; bring
  // it into view so the click always lands on the table itself.
  useEffect(() => {
    if (openRound === null) return
    const id = setTimeout(() => {
      panelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    }, 60)
    return () => clearTimeout(id)
  }, [openRound])

  // driver directory lets us turn a bare number into a name on any data tier
  const { data: drivers } = useApi('/api/drivers')
  const byNumber = useMemo(() => {
    const map = new Map()
    for (const d of drivers || []) map.set(String(d.number), d)
    return map
  }, [drivers])

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

  const closeDetail = () => { setOpenRound(null); setDetail(null) }

  const sourceBadge = useMemo(() => {
    if (!data) return null
    if (data.source === 'live' || data.source === 'cache') return <Badge kind="live">{t('results.live')}</Badge>
    if (data.source === 'archive') return <Badge kind="gold">{t('results.archive')}</Badge>
    if (data.source === 'offline') return <Badge>{t('results.offlineBanner')}</Badge>
    return null
  }, [data, t])

  const rounds = data?.rounds || []

  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="RACE RESULTS" title={t('results.title')} sub={t('results.sub')} right={sourceBadge} />

        <div className="tabs" style={{ marginBottom: 20 }}>
          {[current, ARCHIVE_SEASON].map((y) => (
            <button key={y} className={year === y ? 'on' : ''} onClick={() => { setYear(y); closeDetail() }}>
              {y}{t('results.seasonSuffix')}
            </button>
          ))}
        </div>

        {data?.source === 'offline' && (
          <div className="notice-banner">
            <Badge>{t('results.offlineBanner')}</Badge>
            <span>{t('results.offlineMsg')}</span>
          </div>
        )}
        {data?.source === 'archive' && (
          <div className="notice-banner">
            <Badge kind="gold">{t('results.archiveBanner')}</Badge>
            <span>{t('results.archiveMsg')}</span>
          </div>
        )}

        {loading ? <Loading /> : rounds.length === 0 ? (
          <EmptyState icon="🏁" title={t('results.empty')} />
        ) : (
          <>
            <div className="grid grid-3 results-grid">
              {rounds.map((r) => {
                const isOpen = openRound === r.round
                const w = winnerLabel(r, lang, byNumber)
                return (
                  <article
                    className={`card round-card ${isOpen ? 'is-open' : ''}`}
                    key={`${r.round}-${r.name}`}
                    aria-expanded={isOpen}
                  >
                    <header className="round-head">
                      <span className="round-chip">Rd.{r.round}</span>
                      <span className="round-status">
                        {r.status === 'cancelled' && <Badge kind="offline">{t('results.cancelled')}</Badge>}
                        {r.status === 'upcoming' && <Badge kind="ok">{t('calendar.upcoming')}</Badge>}
                        {r.status === 'completed' && <span className="note">{fmtDate(r.date)}</span>}
                      </span>
                    </header>
                    <h3 className="round-name">{r.flag} {lang === 'ja' ? (r.nameJa || r.name) : r.name}</h3>
                    <p className="note round-circuit">{r.circuit}</p>

                    {(w.name || w.team) && (
                      <div className="winner-box">
                        <span className="winner-label">{t('results.winner')}</span>
                        <span className="winner-name">{w.name || '—'}</span>
                        {w.team && <span className="note">{w.team}</span>}
                      </div>
                    )}

                    <dl className="fact-list">
                      {r.pole && (
                        <div className="fact">
                          <dt>{t('results.pole')}</dt>
                          <dd>{driverName(r.poleJa || r.pole, lang, byNumber)}</dd>
                        </div>
                      )}
                      {r.fastestLap && (
                        <div className="fact">
                          <dt>{t('results.fastestLap')}</dt>
                          <dd>{driverName(r.flJa || r.fastestLap, lang, byNumber)}</dd>
                        </div>
                      )}
                    </dl>

                    <button
                      className={`btn sm ghost round-toggle ${isOpen ? 'is-open' : ''}`}
                      aria-expanded={isOpen}
                      onClick={() => (isOpen ? closeDetail() : openDetail(r))}
                    >
                      {isOpen ? t('results.hideDetail') : t('results.detail')}
                      <span className="chev" aria-hidden="true">▾</span>
                    </button>
                  </article>
                )
              })}
            </div>

            {openRound !== null && (
              <div ref={panelRef} id="classification">
                <ClassificationPanel
                  year={year}
                  round={openRound}
                  loading={detailLoading}
                  detail={detail}
                  lang={lang}
                  byNumber={byNumber}
                  onClose={closeDetail}
                />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

/** Full classification, drawn as its own framed panel under the card grid. */
function ClassificationPanel({ year, round, loading, detail, lang, byNumber, onClose }) {
  const { t } = useLang()
  const rows = detail?.classification || []
  const title = detail?.round?.name || `#${round}`
  return (
    <section className="classification" aria-label={t('results.classification')}>
      <header className="classification-head">
        <div>
          <div className="eyebrow">CLASSIFICATION</div>
          <h3>{t('results.classification')} · {title}</h3>
          <p className="note">
            {detail?.provider ? `${detail.provider} · ` : ''}
            {t('results.classificationNote', { year, provider: detail?.provider || 'OpenF1' })}
          </p>
        </div>
        <button className="btn sm ghost" onClick={onClose} aria-label={t('common.close')}>✕ {t('common.close')}</button>
      </header>

      {loading ? <Loading /> : rows.length ? (
        <div className="table-wrap classification-scroll">
          <table className="table classification-table">
            <thead>
              <tr>
                <th>{t('standings.position')}</th>
                <th>{t('standings.driver')}</th>
                <th>{t('standings.team')}</th>
                <th className="num-col">{t('standings.points')}</th>
                <th>{t('results.gap')}</th>
                <th>{t('results.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const status = c.status || ''
                return (
                  <tr key={`${c.position}-${c.driver}`} className={status ? `is-${status.toLowerCase()}` : ''}>
                    <td><span className={`pos-chip pos-${c.position}`}>{c.position}</span></td>
                    <td className="driver-cell">
                      {c.number != null && <span className="cell-number">{c.number}</span>}
                      <span className="cell-name">{driverName(c, lang, byNumber)}</span>
                    </td>
                    <td className="note">{c.team || '—'}</td>
                    <td className="num">{c.points ?? '—'}</td>
                    <td className="num note">{c.gap != null ? fmtGap(c.gap) : '—'}</td>
                    <td>{status ? <Badge kind={status === 'DNF' ? 'offline' : 'muted'}>{status}</Badge> : <span className="note">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-feed">
          <span className="empty-ico" aria-hidden="true">🏁</span>
          <strong>{t('results.noDetailTitle')}</strong>
          <p className="note">{t('results.noDetailBody')}</p>
        </div>
      )}
    </section>
  )
}
