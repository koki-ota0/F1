import { Link, useParams } from 'react-router-dom'
import { useLang } from '../lib/i18n.jsx'
import { useApi } from '../lib/api.js'
import { SectionHead, Loading, EmptyState } from '../components/common.jsx'
import { useFan } from '../components/FanProvider.jsx'

export default function TeamDetail() {
  const { id } = useParams()
  const { t, lang } = useLang()
  const { data: team, loading } = useApi(`/api/teams/${id}`)
  const { fan, update } = useFan()
  if (loading) return <div className="section container"><Loading /></div>
  if (!team) return <div className="section container"><EmptyState icon="🏁" /></div>

  const isFav = fan.team === team.id
  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow={team.short} title={lang === 'ja' ? team.nameJa : team.name} sub={team.base} />
        <div className="card" style={{ borderTop: `4px solid ${team.color}` }}>
          <div className="grid grid-4">
            <div><div className="note">{t('teams.founded')}</div><div className="num" style={{ fontSize: 24 }}>{team.founded}</div></div>
            <div><div className="note">{t('teams.championships')}</div><div className="num" style={{ fontSize: 24 }}>{team.titles}</div></div>
            <div><div className="note">{t('teams.powerUnit')}</div><div className="num" style={{ fontSize: 24 }}>{team.powerUnit}</div></div>
            <div><div className="note">{t('teams.base')}</div><div style={{ fontWeight: 700 }}>{team.base}</div></div>
          </div>
          <hr className="divider" />
          <p className="note" style={{ margin: 0 }}>{team.note}</p>
          <div style={{ marginTop: 18 }}>
            <button className={isFav ? 'btn sm primary' : 'btn sm'} onClick={() => update({ team: isFav ? '' : team.id })}>
              {isFav ? '★ 推しチーム登録済み' : '☆ 推しチームに登録'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 30 }}>
          <SectionHead eyebrow="LINE-UP" title={t('teams.lineup')} />
          <div className="grid grid-2">
            {(team.drivers || []).map((d) => (
              <Link key={d.id} to={`/drivers/${d.id}`} className="card hover" style={{ display: 'flex', gap: 16, alignItems: 'center', borderLeft: `5px solid ${team.color}` }}>
                <div className="num" style={{ fontSize: 46, color: 'rgba(255,255,255,.12)' }}>{d.number}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{lang === 'ja' ? d.nameJa : d.name}</div>
                  <div className="note">{d.flag} {lang === 'ja' ? d.countryJa : d.country} · {t('common.wins')} {d.wins}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
