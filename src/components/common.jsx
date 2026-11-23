import { useLang } from '../lib/i18n.jsx'
import { useNow, countdownParts, cx } from '../lib/utils.js'

export function Badge({ kind = 'offline', children }) {
  return (
    <span className={cx('badge', kind)}>
      <span className="dot" />
      {children}
    </span>
  )
}

export function LiveBadge({ live }) {
  const { t } = useLang()
  return <Badge kind={live ? 'live' : 'offline'}>{live ? t('common.live') : t('common.offline')}</Badge>
}

export function SectionHead({ eyebrow, title, sub, right }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right}
    </div>
  )
}

export function Loading({ label }) {
  const { t } = useLang()
  return (
    <div className="state">
      <div className="skeleton" style={{ width: 220, height: 22, margin: '0 auto 12px' }} />
      <div className="skeleton" style={{ width: 140, height: 14, margin: '0 auto' }} />
      <div className="note" style={{ marginTop: 12 }}>{label || t('common.loading')}</div>
    </div>
  )
}

export function EmptyState({ icon = '🏁', title, sub, action }) {
  return (
    <div className="state">
      <div className="ico">{icon}</div>
      {title && <h3>{title}</h3>}
      {sub && <p className="note">{sub}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

export function Countdown({ target }) {
  const { t, lang } = useLang()
  const now = useNow(1000)
  const { days, hours, minutes, seconds } = countdownParts(target, now)
  const cells = [
    [days, lang === 'ja' ? '日' : 'days'],
    [hours, lang === 'ja' ? '時間' : 'hrs'],
    [minutes, lang === 'ja' ? '分' : 'min'],
    [seconds, lang === 'ja' ? '秒' : 'sec']
  ]
  return (
    <div className="countdown" aria-label={t('home.countdown')}>
      {cells.map(([v, l]) => (
        <div className="cd-cell" key={l}>
          <b>{String(v).padStart(2, '0')}</b>
          <span>{l}</span>
        </div>
      ))}
    </div>
  )
}

export function Ticker({ items }) {
  const { t } = useLang()
  if (!items?.length) return null
  const doubled = [...items, ...items]
  return (
    <div className="ticker" aria-label={t('home.newsTicker')}>
      <div className="ticker-track">
        {doubled.map((n, i) => (
          <a className="ticker-item" href={n.url || '#'} target={n.url ? '_blank' : undefined} rel="noreferrer" key={i}>
            <b>●</b>{n.title}
          </a>
        ))}
      </div>
    </div>
  )
}

export function Stat({ label, value }) {
  return (
    <div>
      <div className="num" style={{ fontSize: 22 }}>{value}</div>
      <div className="note" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

export function SourceNote({ source }) {
  const { t } = useLang()
  const map = { live: t('common.live'), cached: t('common.cached'), offline: t('common.offline') }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <LiveBadge live={source === 'live'} />
      <span className="note">{t('common.source')}: {map[source] || source}</span>
    </span>
  )
}
