import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { useApi } from '../lib/api.js'
import { SectionHead, Loading } from '../components/common.jsx'
import { useFan } from '../components/FanProvider.jsx'
import { fanLevel, fanLevelName } from '../lib/store.js'
import { useAuth } from '../lib/auth.jsx'

export default function Fan() {
  const { t, lang } = useLang()
  const { data: drivers, loading } = useApi('/api/drivers')
  const { fan, update, reset, quiz, preds, teams, myTeam } = useFan()
  const { user, updateProfile: saveAccount, logout } = useAuth()
  const [name, setName] = useState(fan.name)
  const [driver, setDriver] = useState(fan.driver)
  const [team, setTeam] = useState(fan.team)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setName(fan.name); setDriver(fan.driver); setTeam(fan.team) }, [fan.name, fan.driver, fan.team])

  // an account gives us a server-side profile; prefer it once it arrives
  useEffect(() => {
    if (!user) return
    setName((prev) => prev || user.name || user.username)
    setDriver((prev) => prev || user.profile?.driver || '')
    setTeam((prev) => prev || user.profile?.team || '')
  }, [user?.id])

  const save = async () => {
    update({ name, driver, team })
    try { await saveAccount({ name, driver, team, xp: quiz.xp, bestStreak: quiz.bestStreak }) } catch { /* offline */ }
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const myDriver = drivers?.find((d) => d.id === fan.driver) || null
  const myPreds = preds.reduce((s, p) => s + (p.score || 0), 0)
  const lv = fanLevel(quiz.xp)

  if (loading) return <div className="section container"><Loading /></div>

  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="FAN ZONE" title={t('fan.title')} sub={t('fan.sub')} />

        <div className="card" style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">{t('auth.loggedInAs')}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginTop: 4 }}>@{user?.username}</div>
            <div className="note" style={{ marginTop: 2 }}>
              {t('auth.memberSince')}: {user?.createdAt ? user.createdAt.slice(0, 10) : '—'}
            </div>
          </div>
          <button className="btn sm ghost" onClick={logout}>{t('auth.logout')}</button>
        </div>

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="field">
              <label>{t('fan.yourName')}</label>
              <input className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="field">
                <label>{t('fan.favDriver')}</label>
                <select className="input" value={driver} onChange={(e) => setDriver(e.target.value)}>
                  <option value="">—</option>
                  {(drivers || []).map((d) => <option key={d.id} value={d.id}>#{d.number} {d.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{t('fan.favTeam')}</label>
                <select className="input" value={team} onChange={(e) => setTeam(e.target.value)}>
                  <option value="">—</option>
                  {teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="btn primary" onClick={save}>{t('fan.save')}</button>
              <button className="btn ghost" onClick={() => { reset(); setName(''); setDriver(''); setTeam('') }}>{t('fan.reset')}</button>
              {saved && <span className="badge ok">{t('fan.saved')}</span>}
            </div>
            <p className="note" style={{ marginTop: 14 }}>{t('fan.accentApplied')}</p>
          </div>

          <div className="fan-card" style={{ '--team-color': myTeam?.color || 'var(--accent)' }}>
            <div className="fc-row">
              <div>
                <div className="note" style={{ color: 'rgba(255,255,255,.75)', letterSpacing: '.14em', textTransform: 'uppercase', fontSize: 11 }}>{t('fan.yourCard')}</div>
                <h3>{fan.name || 'F1 FAN'}</h3>
                <div className="note" style={{ color: 'rgba(255,255,255,.8)', marginTop: 4 }}>
                  {fan.since ? `${t('fan.memberSince')}: ${fan.since}` : ''}
                </div>
              </div>
              <div className="fc-no">{myDriver ? myDriver.number : '–'}</div>
            </div>
            <hr className="divider" style={{ background: 'rgba(255,255,255,.25)' }} />
            <div className="grid grid-3" style={{ gap: 12 }}>
              <div><div className="num" style={{ fontSize: 24 }}>{myDriver ? (lang === 'ja' ? myDriver.nameJa : myDriver.name) : t('fan.noFav')}</div><div className="note" style={{ color: 'rgba(255,255,255,.75)' }}>{t('fan.favDriver')}</div></div>
              <div><div className="num" style={{ fontSize: 24 }}>{myTeam ? myTeam.name : t('fan.noFav')}</div><div className="note" style={{ color: 'rgba(255,255,255,.75)' }}>{t('fan.favTeam')}</div></div>
              <div><div className="num" style={{ fontSize: 24 }}>Lv.{lv}</div><div className="note" style={{ color: 'rgba(255,255,255,.75)' }}>{fanLevelName(lv)}</div></div>
              <div><div className="num" style={{ fontSize: 24 }}>{quiz.xp}</div><div className="note" style={{ color: 'rgba(255,255,255,.75)' }}>{t('fan.xp')}</div></div>
              <div><div className="num" style={{ fontSize: 24 }}>{myPreds}</div><div className="note" style={{ color: 'rgba(255,255,255,.75)' }}>{t('fan.predictions')}</div></div>
              <div><div className="num" style={{ fontSize: 24 }}>{quiz.bestStreak}</div><div className="note" style={{ color: 'rgba(255,255,255,.75)' }}>{t('quiz.bestStreak')}</div></div>
            </div>
          </div>
        </div>

        {myDriver && (
          <div className="card" style={{ marginTop: 22, borderLeft: `5px solid ${myTeam?.color || 'var(--accent)'}` }}>
            <div className="eyebrow" style={{ fontFamily: 'var(--font-num)', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--accent-2)', fontSize: 12, fontWeight: 700 }}>{t('home.myDriver')}</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '8px 0 4px' }}>{lang === 'ja' ? myDriver.nameJa : myDriver.name}</h3>
            <p className="note" style={{ margin: 0 }}>{lang === 'ja' ? myDriver.bioJa : myDriver.bioEn}</p>
          </div>
        )}
      </div>
    </section>
  )
}
