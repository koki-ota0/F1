import { Link } from 'react-router-dom'
import { useLang } from '../lib/i18n.jsx'
import { useFan } from './FanProvider.jsx'

export function DriverCard({ driver, team }) {
  const { t, lang } = useLang()
  const { fan, update } = useFan()
  const isFav = fan.driver === driver.id
  const color = team?.color || 'var(--accent)'
  return (
    <Link to={`/drivers/${driver.id}`} className="card hover dcard" style={{ '--team-color': color, display: 'block' }}>
      <span className="stripe" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <div className="dnum">{driver.number}</div>
          <div className="dname">{driver.name}</div>
          <div className="dteam">{lang === 'ja' ? (team?.nameJa || team?.name) : team?.name} · {driver.flag} {lang === 'ja' ? driver.countryJa : driver.country}</div>
        </div>
        <button
          className={isFav ? 'btn sm primary' : 'btn sm ghost'}
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
    <Link to={`/teams/${team.id}`} className="card hover tcard" style={{ '--team-color': team.color }}>
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
