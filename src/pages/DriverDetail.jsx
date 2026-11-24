import { assetUrl } from '../lib/asset.js'
import { Link, useParams } from 'react-router-dom'
import { useLang } from '../lib/i18n.jsx'
import { useApi } from '../lib/api.js'
import { SectionHead, Loading, EmptyState, Badge } from '../components/common.jsx'
import { useFan } from '../components/FanProvider.jsx'
import { Stat } from '../components/common.jsx'
import { DriverPhoto } from '../components/Cards.jsx'
import { fmtDate } from '../lib/utils.js'

export default function DriverDetail() {
  const { id } = useParams()
  const { t, lang } = useLang()
  const { data: driver, loading } = useApi(`/api/drivers/${id}`)
  const { data: all, loading: allLoading } = useApi('/api/drivers')
  const { fan, update } = useFan()

  if (loading || allLoading) return <div className="section container"><Loading /></div>
  if (!driver) return <div className="section container"><EmptyState icon="🏁" title={t('drivers.noResults')} /></div>

  const team = driver.teamInfo
  const teammates = (all || []).filter((d) => d.team === driver.team && d.id !== driver.id)
  const isFav = fan.driver === driver.id
  const color = team?.color || 'var(--accent)'

  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow={`#${driver.number} · ${lang === 'ja' ? driver.countryJa : driver.country}`} title={lang === 'ja' ? driver.nameJa : driver.name} sub={team ? (lang === 'ja' ? team.nameJa : team.name) : ''} />
        <div className="card" style={{ '--team-color': color, position: 'relative', overflow: 'hidden' }}>
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: color }} />
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <DriverPhoto id={driver.id} name={driver.name} size={120} src={driver.photo || assetUrl(`images/drivers/${driver.id}.jpg`)} />
            <div className="num" style={{ fontSize: 90, color: 'rgba(255,255,255,.12)', lineHeight: 1 }}>{driver.number}</div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 6px', fontSize: 30 }}>{lang === 'ja' ? driver.nameJa : driver.name}</h2>
              <div className="note">{driver.flag} {lang === 'ja' ? driver.countryJa : driver.country} · {t('drivers.debut')}: {driver.debut}</div>
              <div className="pill-row" style={{ marginTop: 12 }}>
                {driver.titles > 0 && <Badge kind="gold">{driver.titles}× {t('drivers.titles')}</Badge>}
                <button className={isFav ? 'btn sm primary' : 'btn sm'} onClick={() => update({ driver: isFav ? '' : driver.id })}>
                  {isFav ? `★ ${t('drivers.removeFav')}` : `☆ ${t('drivers.addFav')}`}
                </button>
              </div>
            </div>
          </div>
          <hr className="divider" />
          <p style={{ color: 'var(--muted)', maxWidth: 760, margin: 0 }}>{lang === 'ja' ? driver.bioJa : driver.bioEn}</p>
        </div>

        <div className="grid grid-4" style={{ marginTop: 22 }}>
          <div className="card"><Stat label={t('common.wins')} value={driver.wins} /></div>
          <div className="card"><Stat label={t('common.podiums')} value={driver.podiums} /></div>
          <div className="card"><Stat label={t('common.poles')} value={driver.poles} /></div>
          <div className="card"><Stat label={t('drivers.rating')} value={driver.rating} /></div>
        </div>
        <p className="note" style={{ marginTop: 10 }}>{t('drivers.career')}</p>

        {teammates.length > 0 && (
          <div style={{ marginTop: 30 }}>
            <SectionHead eyebrow="TEAM MATE" title={t('drivers.teammate')} />
            <div className="grid grid-2">
              {teammates.map((m) => (
                <Link key={m.id} to={`/drivers/${m.id}`} className="card hover" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div className="num" style={{ fontSize: 40, color: 'rgba(255,255,255,.12)' }}>{m.number}</div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{lang === 'ja' ? m.nameJa : m.name}</div>
                    <div className="note">{m.flag} {lang === 'ja' ? m.countryJa : m.country}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
