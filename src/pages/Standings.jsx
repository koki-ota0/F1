import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { getStandings, getJSON } from '../lib/api.js'
import { SectionHead, Loading, EmptyState, LiveBadge } from '../components/common.jsx'
import { useFan } from '../components/FanProvider.jsx'

export default function Standings() {
  const { t, lang } = useLang()
  const { fan } = useFan()
  const [tab, setTab] = useState('drivers')
  const [data, setData] = useState(null)
  const [champions, setChampions] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const year = new Date().getFullYear()

  useEffect(() => {
    getJSON('/api/champions').then(setChampions).catch(() => {})
    getJSON('/api/records').then(setRecords).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    getStandings(year, tab).then((d) => { setData(d); setLoading(false) })
  }, [tab, year])

  const rows = data?.standings || []
  const isLive = data?.source === 'live' && rows.length > 0

  return (
    <section className="section">
      <div className="container">
        <SectionHead
          eyebrow="CHAMPIONSHIP"
          title={t('standings.title')}
          sub={t('standings.sub')}
          right={<LiveBadge live={isLive} />}
        />

        <div className="tabs" style={{ marginBottom: 20 }}>
          <button className={tab === 'drivers' ? 'on' : ''} onClick={() => setTab('drivers')}>{t('standings.drivers')}</button>
          <button className={tab === 'constructors' ? 'on' : ''} onClick={() => setTab('constructors')}>{t('standings.constructors')}</button>
        </div>

        {loading ? <Loading /> : isLive ? (
          <div className="table-wrap" style={{ marginBottom: 34 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('standings.position')}</th>
                  <th>{tab === 'drivers' ? t('standings.driver') : t('standings.team')}</th>
                  {tab === 'drivers' && <th>{t('standings.team')}</th>}
                  <th>{t('standings.wins')}</th>
                  <th>{t('standings.points')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.position} className={tab === 'drivers' && r.name && fan.driver === r.name ? 'me' : ''}>
                    <td className="num" style={{ fontSize: 16, color: r.position <= 3 ? 'var(--accent-2)' : 'inherit' }}>{r.position}</td>
                    <td style={{ fontWeight: 700 }}>{r.name}</td>
                    {tab === 'drivers' && <td className="note">{r.team || '—'}</td>}
                    <td className="num">{r.wins}</td>
                    <td className="num" style={{ fontSize: 16 }}>{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 34 }}>
            <EmptyState icon="📶" title={t('live.offlineMode')} sub={t('standings.offlineNote')} />
          </div>
        )}

        <SectionHead eyebrow="HISTORY" title={t('standings.champions')} />
        <div className="table-wrap" style={{ marginBottom: 34 }}>
          <table className="table">
            <thead>
              <tr><th>{t('standings.year')}</th><th>{t('standings.driver')}</th><th>{t('standings.team')}</th><th>{t('standings.points')}</th></tr>
            </thead>
            <tbody>
              {champions.map((c) => (
                <tr key={c.year}>
                  <td className="num" style={{ color: 'var(--gold)' }}>{c.year}</td>
                  <td style={{ fontWeight: 700 }}>{lang === 'ja' ? c.driverJa : c.driver}</td>
                  <td>{lang === 'ja' ? c.teamJa : c.team}</td>
                  <td className="num">{c.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SectionHead eyebrow="ALL TIME" title={t('standings.records')} />
        <div className="grid grid-3">
          {records.map((r) => (
            <div className="card" key={r.id}>
              <div className="note" style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{lang === 'ja' ? r.labelJa : r.label}</div>
              <div className="num" style={{ fontSize: 30, margin: '6px 0' }}>{r.value}</div>
              <div style={{ fontWeight: 700 }}>{lang === 'ja' ? r.holderJa : r.holder}</div>
              <div className="note" style={{ marginTop: 4 }}>{r.asOf}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
