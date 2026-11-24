import { useEffect, useMemo, useState } from 'react'
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
  // compact two-up cards on phones (25 drivers would otherwise be a marathon)
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const sync = () => setCompact(mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])

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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
          <label className="field" style={{ margin: 0, flex: '1 1 200px' }}>
            <span className="sr-only">{t('common.search')}</span>
            <input className="input" style={{ maxWidth: 260, width: '100%' }} placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="field" style={{ margin: 0, flex: '1 1 180px' }}>
            <span className="sr-only">{t('drivers.filterTeam')}</span>
            <select className="input" style={{ maxWidth: 260, width: '100%' }} value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="all">{t('drivers.filterTeam')}: {t('common.all')}</option>
            {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
            </select>
          </label>
        </div>
        {loading ? <Loading /> : list.length ? (
          <div className="grid grid-4 drivers-grid">
            {list.map((d) => <DriverCard key={d.id} driver={d} team={teams.find((x) => x.id === d.team)} compact={compact} />)}
          </div>
        ) : <EmptyState icon="🏁" title={t('drivers.noResults')} />}
      </div>
    </section>
  )
}
