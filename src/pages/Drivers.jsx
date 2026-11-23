import { useMemo, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { useApi } from '../lib/api.js'
import { SectionHead, Loading, EmptyState } from '../components/common.jsx'
import { DriverCard } from '../components/Cards.jsx'
import { useFan } from '../components/FanProvider.jsx'

export default function Drivers() {
  const { t } = useLang()
  const { data: drivers, loading } = useApi('/api/drivers')
  const { teams } = useFan()
  const [team, setTeam] = useState('all')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    let arr = drivers || []
    if (team !== 'all') arr = arr.filter((d) => d.team === team)
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      arr = arr.filter((d) => d.name.toLowerCase().includes(s) || d.nameJa.includes(s) || String(d.number) === s)
    }
    return arr
  }, [drivers, team, q])

  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="GRID" title={t('drivers.title')} sub={t('drivers.sub')} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
          <input className="input" style={{ maxWidth: 260 }} placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" style={{ maxWidth: 260 }} value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="all">{t('drivers.filterTeam')}: {t('common.all')}</option>
            {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
          </select>
        </div>
        {loading ? <Loading /> : list.length ? (
          <div className="grid grid-4">
            {list.map((d) => <DriverCard key={d.id} driver={d} team={teams.find((x) => x.id === d.team)} />)}
          </div>
        ) : <EmptyState icon="🏁" title={t('drivers.noResults')} />}
      </div>
    </section>
  )
}
