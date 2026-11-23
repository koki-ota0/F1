import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { getJSON } from '../lib/api.js'
import { SectionHead, Loading, EmptyState, Badge } from '../components/common.jsx'
import { useFan } from '../components/FanProvider.jsx'

const AVATAR_COLORS = ['#e10600', '#3671C6', '#FF8000', '#27F4D2', '#52E252', '#f5c044', '#E8002D', '#6692FF']

function colorFor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function relTime(iso, t) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('social.justNow')
  if (m < 60) return `${m}${t('social.minAgo')}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}${t('social.hourAgo')}`
  return new Date(iso).toLocaleDateString()
}

export default function Social() {
  const { t, lang } = useLang()
  const { fan } = useFan()
  const [posts, setPosts] = useState(null)
  const [filter, setFilter] = useState('all')
  const [text, setText] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => getJSON('/api/posts').then((d) => setPosts(d.items || [])).catch(() => {})
  useEffect(() => {
    load()
    const id = setInterval(load, 20000)
    return () => clearInterval(id)
  }, [])

  const tags = useMemo(() => {
    const count = {}
    for (const p of posts || []) for (const tg of p.tags || []) count[tg] = (count[tg] || 0) + 1
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tg]) => tg)
  }, [posts])

  const visible = useMemo(() => {
    let arr = posts || []
    if (filter === 'mine') arr = arr.filter((p) => p.name === (fan.name || 'YOU'))
    else if (filter !== 'all') arr = arr.filter((p) => (p.tags || []).includes(filter))
    return arr
  }, [posts, filter, fan.name])

  const post = async () => {
    if (!text.trim()) return
    setBusy(true)
    const tags = tagsInput.split(/\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fan.name || 'YOU', text, tags, color: fan.team ? undefined : '#e10600' })
      })
      setText(''); setTagsInput('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const like = async (id) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)))
    try {
      const r = await fetch(`/api/posts/${id}/like`, { method: 'POST' })
      const d = await r.json()
      if (d.ok) setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, likes: d.likes } : p)))
    } catch { /* ignore */ }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 860 }}>
        <SectionHead eyebrow="COMMUNITY" title={t('social.title')} sub={t('social.sub')} />

        <div className="card" style={{ marginBottom: 22 }}>
          <label className="note" style={{ fontWeight: 700 }}>{t('social.compose')}</label>
          <textarea
            className="input"
            rows={3}
            maxLength={280}
            placeholder={t('social.placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ marginTop: 8, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <input
              className="input"
              style={{ flex: 1, minWidth: 180 }}
              placeholder={t('social.tagsHint')}
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <span className="note num">{text.length}{t('social.charCount')}</span>
            <button className="btn primary" onClick={post} disabled={busy || !text.trim()}>{t('social.post')}</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
          <button className={filter === 'all' ? 'btn sm primary' : 'btn sm'} onClick={() => setFilter('all')}>{t('social.all')}</button>
          <button className={filter === 'mine' ? 'btn sm primary' : 'btn sm'} onClick={() => setFilter('mine')}>{t('social.myPosts')}</button>
          <span style={{ width: 8 }} />
          {tags.map((tg) => (
            <button key={tg} className={filter === tg ? 'btn sm primary' : 'btn sm ghost'} onClick={() => setFilter(tg)}>{tg}</button>
          ))}
        </div>

        {!posts ? <Loading /> : visible.length === 0 ? (
          <EmptyState icon="💬" title={t('social.noPosts')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visible.map((p) => (
              <div className="card" key={p.id}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800,
                    background: p.color || colorFor(p.name)
                  }}>
                    {(p.name || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <b>{p.name}{p.name === (fan.name || 'YOU') && <span className="note"> · {t('social.you')}</span>}</b>
                      <span className="note">{relTime(p.at, t)}</span>
                    </div>
                    <p style={{ margin: '6px 0', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{p.text}</p>
                    {p.tags?.length > 0 && (
                      <div className="pill-row">
                        {p.tags.map((tg) => <span className="tag" key={tg}>{tg}</span>)}
                      </div>
                    )}
                    <div style={{ marginTop: 10 }}>
                      <button className="btn sm ghost" onClick={() => like(p.id)}>♥ {p.likes} {t('social.likes')}</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 26 }}>
          <SectionHead eyebrow="TRENDING" title={t('social.trends')} />
          <div className="pill-row">
            {tags.length ? tags.map((tg) => <button className="tag" key={tg} onClick={() => setFilter(tg)} style={{ padding: '8px 14px', cursor: 'pointer' }}>{tg}</button>) : <span className="note">—</span>}
          </div>
        </div>
      </div>
    </section>
  )
}
