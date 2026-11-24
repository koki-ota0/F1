import { useLang } from '../lib/i18n.jsx'
import { useApi } from '../lib/api.js'
import { SectionHead, Loading, EmptyState, LiveBadge, Badge } from '../components/common.jsx'
import { fmtDate } from '../lib/utils.js'

export default function News() {
  const { t, lang } = useLang()
  const { data, loading, reload } = useApi('/api/news')
  const items = data?.items || []
  const isLive = data?.source === 'live'

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 900 }}>
        <SectionHead eyebrow="PADDOCK PASS" title={t('news.title')} sub={t('news.sub')} right={<LiveBadge live={isLive} />} />
        {loading ? <Loading /> : !items.length ? (
          <EmptyState icon="📰" title={t('news.noItems')} action={<button className="btn" onClick={reload}>{t('common.retry')}</button>} />
        ) : (
          <>
            {!isLive && <div className="note" style={{ marginBottom: 14 }}>{t('news.offlineFeed')}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {items.map((n, i) => (
                <a className="card hover" key={n.id || i}
                  href={n.url || n.link || '#'}
                  target={n.url || n.link ? '_blank' : undefined}
                  rel={n.url || n.link ? 'noreferrer' : undefined}
                  aria-label={`${lang === 'ja' ? (n.title || n.titleEn) : (n.titleEn || n.title)} — ${t('news.readMore')}`}
                  style={{ display: 'block' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="tag">{n.tag || n.source}</span>
                    <span className="note">{n.date ? fmtDate(n.date, lang) : ''}</span>
                    {n.source && <span className="note">· {n.source}</span>}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: '10px 0 6px', lineHeight: 1.4 }}>
                    {lang === 'ja' ? (n.title || n.titleEn) : (n.titleEn || n.title)}
                  </h3>
                  {(n.summary || n.summaryEn) && (
                    <p className="note" style={{ margin: 0 }}>{lang === 'ja' ? (n.summary || n.summaryEn) : (n.summaryEn || n.summary)}</p>
                  )}
                  {(n.url || n.link) && (
                    <span className="tag" style={{ marginTop: 12 }}>{t('news.readMore')} ↗</span>
                  )}
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
