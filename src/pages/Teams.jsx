import { useLang } from '../lib/i18n.jsx'
import { useApi } from '../lib/api.js'
import { SectionHead, Loading, EmptyState } from '../components/common.jsx'
import { TeamCard } from '../components/Cards.jsx'

export default function Teams() {
  const { t } = useLang()
  const { data: teams, loading } = useApi('/api/teams')
  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="PADDOCK" title={t('teams.title')} sub={t('teams.sub')} />
        {loading ? <Loading /> : teams?.length ? (
          <div className="grid grid-3">
            {teams.map((tm) => <TeamCard key={tm.id} team={tm} />)}
          </div>
        ) : <EmptyState icon="🏁" />}
      </div>
    </section>
  )
}
