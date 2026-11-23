import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useLang } from '../lib/i18n.jsx'
import { useFan } from './FanProvider.jsx'
import { useRefresh } from './RefreshProvider.jsx'

export default function Navbar() {
  const { t, lang, setLang } = useLang()
  const { level } = useFan()
  const { busy, status, message, refresh } = useRefresh()
  const [open, setOpen] = useState(false)

  const lastAt = status?.at ? new Date(status.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
  const badgeTone = message === 'live-all' || message === 'live-partial' ? 'ok' : message === 'offline' ? 'warn' : null

  const links = [
    ['/live', t('nav.live')],
    ['/standings', t('nav.standings')],
    ['/calendar', t('nav.calendar')],
    ['/drivers', t('nav.drivers')],
    ['/teams', t('nav.teams')]
  ]
  const games = [
    ['/predict', t('nav.predict')],
    ['/sim', t('nav.sim')],
    ['/quiz', t('nav.quiz')]
  ]

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="slash" /> PITWALL
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>{t('nav.home')}</NavLink>
          {links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
          <div className="dropdown">
            <a href="#games" onClick={(e) => e.preventDefault()}>{t('nav.games')} ▾</a>
            <div className="dropdown-menu">
              {games.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
            </div>
          </div>
          <NavLink to="/news">{t('nav.news')}</NavLink>
          <NavLink to="/social">{t('nav.social')}</NavLink>
          <NavLink to="/league">{t('nav.league')}</NavLink>
          <NavLink to="/fan">{t('nav.fan')}</NavLink>
        </nav>
        <div className="nav-right">
          <span className="tag" title={t('nav.fanLevel')}>Lv.{level}</span>
          <button
            className={`btn sm ${badgeTone === 'ok' ? 'primary' : ''}`}
            onClick={refresh}
            disabled={busy}
            title={lastAt ? t('nav.lastRefresh')(lastAt) : t('nav.refreshHint')}
          >
            {busy ? t('nav.refreshing') : '🔄 ' + t('nav.refresh')}
          </button>
          {message && (
            <span className={`tag ${badgeTone || ''}`}>
              {message === 'offline'
                ? t('nav.refreshOffline')
                : message === 'live-all'
                  ? `LIVE ✓ ${status.okCount}/${status.results.length}`
                  : `LIVE ${status.okCount}/${status.results.length}`}
              {lastAt ? ` · ${lastAt}` : ''}
            </span>
          )}
          <div className="lang-toggle">
            <button className={lang === 'ja' ? 'on' : ''} onClick={() => setLang('ja')}>日本語</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
          <button className="burger" aria-label="menu" onClick={() => setOpen((o) => !o)}>☰</button>
        </div>
      </div>
      {open && (
        <div className="mobile-menu">
          <NavLink to="/" end onClick={() => setOpen(false)}>{t('nav.home')}</NavLink>
          {links.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)}>{label}</NavLink>)}
          {games.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)}>{label}</NavLink>)}
          <NavLink to="/news" onClick={() => setOpen(false)}>{t('nav.news')}</NavLink>
          <NavLink to="/social" onClick={() => setOpen(false)}>{t('nav.social')}</NavLink>
          <NavLink to="/league" onClick={() => setOpen(false)}>{t('nav.league')}</NavLink>
          <NavLink to="/fan" onClick={() => setOpen(false)}>{t('nav.fan')}</NavLink>
        </div>
      )}
    </header>
  )
}
