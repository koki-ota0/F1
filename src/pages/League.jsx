import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { SectionHead, Loading, EmptyState, Badge } from '../components/common.jsx'
import { useApi, getCalendar } from '../lib/api.js'
import { assetUrl } from '../lib/asset.js'
import { useAuth, authFetch } from '../lib/auth.jsx'
import {
  loadLeagues as loadLocalLeagues, saveLeagues as saveLocalLeagues,
  joinLeague as joinLocalLeague, setMyPicks as setLocalMyPicks,
  scoreRaceForLeagues as scoreLocalLeagues, standings as localStandings, leagueProfile
} from '../lib/league.js'

/**
 * Prediction leagues.
 *
 * Authoritative mode is the server store (accounts + deterministic house
 * rivals, scored only against published results). On a static host without our
 * API we fall back to the local league data and say so.
 */
export default function League() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const { data: drivers, loading } = useApi('/api/drivers')
  const [cal, setCal] = useState(null)
  const [leagues, setLeagues] = useState(null)
  const [local, setLocal] = useState(null)
  const [serverMode, setServerMode] = useState(true)
  const [round, setRound] = useState(null)
  const [picks, setPicks] = useState({ p1: '', p2: '', p3: '', fl: '' })
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  const races = cal?.races || []
  const activeRound = round || races.find((r) => new Date(r.date + 'T23:59:59') >= new Date())?.round || races[0]?.round

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600) }

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch(assetUrl('/api/leagues'))
      if (!res.ok) throw new Error('leagues failed')
      const d = await res.json()
      setLeagues(d.leagues || [])
      setServerMode(true)
    } catch {
      setLeagues(null)
      setLocal(loadLocalLeagues())
      setServerMode(false)
    }
  }, [])

  useEffect(() => { getCalendar(new Date().getFullYear()).then(setCal) }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (!serverMode && local) saveLocalLeagues(local)
  }, [local, serverMode])

  const join = async (leagueId) => {
    if (serverMode) {
      const res = await authFetch(assetUrl(`/api/leagues/${leagueId}/join`), { method: 'POST' })
      if (res.ok) { await refresh(); notify(t('league.joined')) }
      return
    }
    setLocal(joinLocalLeague(local, leagueId, user?.name || leagueProfile().name))
  }

  const submitPicks = async () => {
    if ((!picks.p1 && !picks.fl) || busy) return
    setBusy(true)
    try {
      if (serverMode) {
        const joined = leagues.filter((l) => l.entries.some((e) => e.kind === 'user' && e.userId === user.id))
        for (const l of joined) {
          await authFetch(assetUrl(`/api/leagues/${l.id}/picks`), {
            method: 'POST',
            body: JSON.stringify({ year: new Date().getFullYear(), round: activeRound, ...picks })
          })
        }
        await refresh()
      } else {
        const joined = local.filter((l) => l.entries.some((e) => e.me))
        let next = local
        for (const l of joined) next = setLocalMyPicks(next, l.id, { ...picks, __drivers: drivers || [] })
        setLocal(next)
      }
      setPicks({ p1: '', p2: '', p3: '', fl: '' })
      notify(t('predict.submitDone'))
    } catch {
      notify(t('auth.error.server'))
    } finally {
      setBusy(false)
    }
  }

  const score = async (leagueId) => {
    if (busy) return
    setBusy(true)
    try {
      if (serverMode) {
        const res = await authFetch(assetUrl(`/api/leagues/${leagueId}/score`), {
          method: 'POST',
          body: JSON.stringify({ year: new Date().getFullYear(), round: activeRound })
        })
        const d = await res.json().catch(() => ({}))
        if (res.status === 404) notify(t('league.noResultYet'))
        else { await refresh(); notify(`${t('league.scoreRound')}: ${activeRound}`) }
        void d
      } else {
        // local fallback: score with the latest real classification if reachable
        let result = null
        try {
          const r = await fetch(assetUrl('/api/results') + `?year=${new Date().getFullYear()}&round=${activeRound}`)
          if (r.ok) {
            const d = await r.json()
            result = (d.classification || []).map((c) => ({ driverId: c.driver, position: c.position }))
          }
        } catch { /* no server */ }
        if (!result) { notify(t('league.noResultYet')); return }
        const sim = result.map((r2) => ({ driverId: r2.driverId, position: r2.position }))
        setLocal(scoreLocalLeagues(local, `Rd.${activeRound}`, sim))
      }
    } finally {
      setBusy(false)
    }
  }

  const rows = useMemo(() => {
    if (serverMode) return leagues || []
    return local || []
  }, [serverMode, leagues, local])

  const joinedRows = rows.filter((l) =>
    serverMode ? l.entries.some((e) => e.kind === 'user' && e.userId === user?.id)
      : l.entries.some((e) => e.me))

  if (loading || !rows) return <div className="section container"><Loading /></div>

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 1040 }}>
        <SectionHead eyebrow="MULTI-LEAGUE" title={t('league.title')} sub={t('league.sub')} />

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ margin: 0, minWidth: 240 }}>
              <label>{t('league.pickRound')}</label>
              <select className="input" value={activeRound ?? ''} onChange={(e) => setRound(Number(e.target.value))}>
                {races.map((r) => (
                  <option key={r.round} value={r.round}>Rd.{r.round} {r.flag} {lang === 'ja' ? r.nameJa : r.name}</option>
                ))}
              </select>
            </div>
            {toast && <span className="badge ok" style={{ alignSelf: 'center' }}>{toast}</span>}
          </div>
          {!serverMode && <p className="note" style={{ margin: '10px 0 0' }}>{t('league.localOnly')}</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            {rows.map((l) => {
              const isIn = joinedRows.some((x) => x.id === l.id)
              return (
                <button key={l.id} className={isIn ? 'btn sm primary' : 'btn sm ghost'} onClick={() => !isIn && join(l.id)}>
                  {lang === 'ja' ? l.name : l.nameEn} · {isIn ? t('league.joined') : t('league.join')}
                </button>
              )
            })}
          </div>
        </div>

        {joinedRows.length === 0 ? (
          <EmptyState icon="🏆" title={t('league.noLeagues')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card">
              <div className="note" style={{ fontWeight: 700, marginBottom: 10 }}>
                {t('league.pickForRound').replace('{round}', `Rd.${activeRound}`)}
              </div>
              <div className="grid grid-4" style={{ gap: 12 }}>
                {[['p1', t('predict.pickP1')], ['p2', t('predict.pickP2')], ['p3', t('predict.pickP3')], ['fl', t('predict.pickFL')]].map(([key, label]) => (
                  <div className="field" key={key}>
                    <label>{label}</label>
                    <select className="input" value={picks[key]} onChange={(e) => setPicks((p) => ({ ...p, [key]: e.target.value }))}>
                      <option value="">—</option>
                      {(drivers || []).map((d) => (
                        <option key={d.id} value={d.id}>#{d.number} {lang === 'ja' ? d.nameJa : d.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn sm primary" disabled={busy || (!picks.p1 && !picks.fl)} onClick={submitPicks}>
                  {t('predict.submit')}
                </button>
                {joinedRows.map((l) => (
                  <button key={l.id} className="btn sm ghost" disabled={busy} onClick={() => score(l.id)}>
                    {t('league.scoreRound')} · {lang === 'ja' ? l.name : l.nameEn}
                  </button>
                ))}
              </div>
            </div>

            {joinedRows.map((l) => {
              const st = serverMode ? [...l.entries].sort((a, b) => (b.points || 0) - (a.points || 0)) : localStandings(l)
              const me = st.find((e) => (serverMode ? e.kind === 'user' && e.userId === user?.id : e.me))
              const myRank = me ? st.indexOf(me) + 1 : 0
              return (
                <div className="card" key={l.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 17, margin: 0 }}>{lang === 'ja' ? l.name : l.nameEn}</h4>
                      <p className="note" style={{ margin: '4px 0 0' }}>
                        {lang === 'ja' ? l.descJa : l.descEn} · {t(`league.metric.${l.metric}`)}
                      </p>
                      {l.lastScored && <p className="note" style={{ margin: '4px 0 0' }}>{t('league.autoScored')} Rd.{l.lastScored.round}</p>}
                    </div>
                    <Badge tone={myRank === 1 ? 'ok' : 'muted'}>
                      {t('league.me')} #{myRank} · {me?.points || 0}{t('league.totalPts')}
                    </Badge>
                  </div>

                  <hr className="divider" />
                  <table className="table" style={{ fontSize: 13 }}>
                    <thead>
                      <tr><th>#</th><th>{t('predict.name')}</th><th style={{ textAlign: 'right' }}>{t('league.points')}</th><th style={{ textAlign: 'right' }}>{t('predict.racesScored')}</th><th style={{ textAlign: 'right' }}>{t('predict.avgAccuracy')}</th></tr>
                    </thead>
                    <tbody>
                      {st.map((e, i) => {
                        const rounds = serverMode ? Object.keys(e.byRound || {}).length : Object.keys(e.picks || {}).length
                        const lastKey = serverMode ? Object.keys(e.byRound || {}).slice(-1)[0] : null
                        const last = lastKey ? e.byRound[lastKey] : null
                        return (
                          <tr key={e.id} className={(serverMode ? e.userId === user?.id : e.me) ? 'highlight-row' : ''}>
                            <td className="num">{i + 1}</td>
                            <td>{e.name}{(serverMode ? e.userId === user?.id : e.me) ? ` · ${t('league.me')}` : ''}</td>
                            <td className="num" style={{ textAlign: 'right' }}>{e.points || 0}</td>
                            <td className="num" style={{ textAlign: 'right' }}>{rounds}</td>
                            <td className="num" style={{ textAlign: 'right' }}>
                              {last && last.known ? `${(last.accuracy * 100).toFixed(0)}%` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
