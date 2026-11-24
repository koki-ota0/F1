import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useLang } from '../lib/i18n.jsx'
import { useFan } from './FanProvider.jsx'
import { useRefresh } from './RefreshProvider.jsx'

/**
 * PITWALL top bar.
 *
 * One navigation model at every width: brand + language switch + ☰ drawer.
 * A horizontal link row either wrapped to a second line on wide screens or
 * cramped on narrow ones, so the links live in a slide-in drawer instead and
 * the bar stays a single clean row.
 */
export default function Navbar() {
  const { t, lang, setLang } = useLang()
  const { level } = useFan()
  const { busy, status, message, refresh } = useRefresh()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const drawerRef = useRef(null)

  // close on navigation, Escape, or a tap on the backdrop
  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector('a')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const lastAt = status?.at ? new Date(status.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
  const badgeTone = message === 'live-all' || message === 'live-partial' ? 'ok' : message === 'offline' ? 'warn' : null

  const groups = [
    ['CONTENTS', [
      ['/live', t('nav.live'), '⏱'],
      ['/standings', t('nav.standings'), '🏆'],
      ['/results', t('nav.results'), '🏁'],
      ['/calendar', t('nav.calendar'), '📅'],
      ['/drivers', t('nav.drivers'), '🧑‍✈️'],
      ['/teams', t('nav.teams'), '🏭'],
    ]],
    ['GAMES', [
      ['/predict', t('nav.predict'), '🎯'],
      ['/sim', t('nav.sim'), '🏎️'],
      ['/quiz', t('nav.quiz'), '🧠'],
    ]],
    ['COMMUNITY', [
      ['/news', t('nav.news'), '📰'],
      ['/social', t('nav.social'), '💬'],
      ['/league', t('nav.league'), '🎖️'],
      ['/fan', t('nav.fan'), '⭐'],
    ]],
  ]

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          <span className="slash" /> PITWALL
        </Link>

        <div className="nav-right">
          <div className="lang-toggle" role="group" aria-label={t('common.language')}>
            <button className={lang === 'ja' ? 'on' : ''} onClick={() => setLang('ja')} aria-pressed={lang === 'ja'}>日本語</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
          </div>
          <button
            className={`burger ${open ? 'is-open' : ''}`}
            aria-label={open ? t('common.close') : t('common.menu')}
            aria-expanded={open}
            aria-controls="site-drawer"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="burger-bar" /><span className="burger-bar" /><span className="burger-bar" />
          </button>
        </div>
      </div>

      <div
        className={`drawer-backdrop ${open ? 'show' : ''}`}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <aside id="site-drawer" ref={drawerRef} className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">PITWALL</div>
            <div className="drawer-title">{t('nav.menuTitle')}</div>
          </div>
          <button className="btn sm ghost" onClick={() => setOpen(false)} aria-label={t('common.close')}>✕</button>
        </div>

        <div className="drawer-status">
          <span className="tag lv-tag" title={t('nav.fanLevel')}>Lv.{level}</span>
          {message && (
            <span className={`tag status-tag ${badgeTone || ''}`}>
              {message === 'offline'
                ? t('nav.refreshOffline')
                : `LIVE ${status.okCount}/${status.results.length}`}
              {lastAt ? ` · ${lastAt}` : ''}
            </span>
          )}
          <button
            className={`btn sm ${badgeTone === 'ok' ? 'primary' : ''}`}
            onClick={refresh}
            disabled={busy}
            title={lastAt ? t('nav.lastRefresh', lastAt) : t('nav.refreshHint')}
          >
            {busy ? t('nav.refreshing') : '🔄 ' + t('nav.refresh')}
          </button>
        </div>

        <nav className="drawer-nav">
          <NavLink to="/" end className="drawer-link" onClick={() => setOpen(false)}>
            <span className="drawer-ico">🏠</span>{t('nav.home')}
          </NavLink>
          {groups.map(([label, items]) => (
            <div className="drawer-group" key={label}>
              <div className="drawer-group-label">{label}</div>
              {items.map(([to, label2, ico]) => (
                <NavLink key={to} to={to} className="drawer-link" onClick={() => setOpen(false)}>
                  <span className="drawer-ico">{ico}</span>{label2}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="drawer-foot">
          <span>{t('common.tagline')}</span>
          <span className="note">© 2026 PITWALL</span>
        </div>
      </aside>
    </header>
  )
}
