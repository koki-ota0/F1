import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../lib/i18n.jsx'
import { useFan } from './FanProvider.jsx'
import { badgePalette } from '../lib/color.js'
import { assetUrl } from '../lib/asset.js'

/**
 * Single portrait source: the bundled official-art crop
 * `public/images/drivers/<id>.jpg` (see README "Driver portraits"). Pass an
 * explicit `src` to override (e.g. a live headshot when a directory row exists).
 */
/**
 * Ink (near-black or white) that keeps >= 4.5:1 contrast on a team colour, so
 * light liveries stay readable instead of rendering white-on-white.
 */
export function onColor(hex) {
  return badgePalette(hex).ink
}

/** Fill + ink for the team badge, both guaranteed readable together. */
export function badgeColors(hex) {
  return badgePalette(hex)
}

export function DriverPhoto({ id, name, size = 72, src, fallbackId }) {
  const [failed, setFailed] = useState(false)
  const bundled = assetUrl(`images/drivers/${fallbackId || id}.jpg`)
  const resolved = failed ? null : (src || bundled)
  if (failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'grid', placeItems: 'center', fontWeight: 800, color: '#fff',
        background: 'linear-gradient(140deg, var(--accent), #3671C6)', fontSize: size * 0.36
      }}>{(name || '?').slice(0, 1).toUpperCase()}</div>
    )
  }
  return (
    <img
      className="dphoto"
      src={resolved}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--line)' }}
    />
  )
}

export function DriverCard({ driver, team, compact = false }) {
  const { t, lang } = useLang()
  const { fan, update } = useFan()
  const isFav = fan.driver === driver.id
  const color = team?.color || 'var(--accent)'
  return (
    <Link to={`/drivers/${driver.id}`} className="card hover dcard" style={{ '--team-color': color, display: 'block' }}>
      <span className="stripe" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', gap: compact ? 8 : 12, alignItems: 'center' }}>
          <DriverPhoto id={driver.id} name={driver.name} size={compact ? 40 : 56} src={driver.photo} />
          <div>
            {/* decorative watermark; the number is already in the card link text */}
            <div className="dnum" aria-hidden="true">{driver.number}</div>
            <div className="dname">{driver.name}</div>
            <div className="dteam">{lang === 'ja' ? (team?.nameJa || team?.name) : team?.name} · {driver.flag} {lang === 'ja' ? driver.countryJa : driver.country}</div>
          </div>
        </div>
        <button
          className={isFav ? 'btn sm primary' : 'btn sm ghost'}
          style={{ minWidth: 34 }}
          aria-label={`${driver.number} ${driver.name}: ${isFav ? t('drivers.removeFav') : t('drivers.addFav')}`}
          aria-pressed={isFav}
          title={isFav ? t('drivers.removeFav') : t('drivers.addFav')}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); update({ driver: isFav ? '' : driver.id }) }}
        >
          {isFav ? '★' : '☆'}
        </button>
      </div>
      <div className="dmeta">
        <div><b>{driver.wins}</b>{t('common.wins')}</div>
        <div><b>{driver.podiums}</b>{t('common.podiums')}</div>
        <div><b>{driver.titles}</b>{t('drivers.titles')}</div>
      </div>
    </Link>
  )
}

export function TeamCard({ team }) {
  const { t, lang } = useLang()
  return (
    <Link
      to={`/teams/${team.id}`}
      className="card hover tcard"
      style={{
        '--team-color': team.color,
        '--team-fill': badgeColors(team.color).bg,
        '--on-team': badgeColors(team.color).ink,
      }}
    >
      <div className="thead">
        <div className="tbadge">{(team.short || team.name).slice(0, 2).toUpperCase()}</div>
        <div>
          <div className="tname">{lang === 'ja' ? team.nameJa : team.name}</div>
          <div className="tbase">{team.base}</div>
        </div>
      </div>
      <div className="dmeta" style={{ display: 'flex', gap: 16, color: 'var(--muted)', fontSize: 12 }}>
        <div><b>{team.titles}</b>{t('teams.championships')}</div>
        <div><b>{team.powerUnit}</b>{t('teams.powerUnit')}</div>
      </div>
      <div className="pill-row" style={{ marginTop: 12 }}>
        {team.drivers?.map((d) => (
          <span className="tag" key={d.id}>#{d.number} {d.name}</span>
        ))}
      </div>
    </Link>
  )
}
