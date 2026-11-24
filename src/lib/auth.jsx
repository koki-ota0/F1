import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { assetUrl } from './asset.js'
import { EmptyState } from '../components/common.jsx'
import { useLang } from './i18n.jsx'

/**
 * Account session.
 *
 * The server issues an opaque random token (30-day expiry). The SPA keeps it in
 * localStorage and sends it as `Authorization: Bearer …`; the server also sets
 * an httpOnly SameSite=Lax cookie so a plain browser reload stays logged in.
 * Passwords never leave the client except over the login/register POST.
 */
const STORE_KEY = 'pitwall.auth'

function storedSession() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function authFetch(path, opts = {}) {
  const sess = storedSession()
  const headers = { ...(opts.headers || {}) }
  if (opts.body != null && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  if (sess?.token) headers.Authorization = `Bearer ${sess.token}`
  const url = String(path).startsWith('/api/') ? assetUrl(path) : path
  const res = await fetch(url, { ...opts, headers })
  if (res.status === 401) {
    // token expired/revoked: drop the local session so guards react
    localStorage.removeItem(STORE_KEY)
    window.dispatchEvent(new Event('pitwall:unauthorized'))
  }
  return res
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const sess = storedSession()
    if (!sess?.token) { setLoading(false); return () => { alive = false } }
    authFetch(assetUrl('/api/auth/me'))
      .then(async (res) => {
        if (!alive) return
        if (res.ok) {
          const d = await res.json().catch(() => null)
          if (d?.user) {
            setUser(d.user)
            localStorage.setItem(STORE_KEY, JSON.stringify({ token: sess.token, user: d.user }))
          } else {
            localStorage.removeItem(STORE_KEY)
          }
        } else if (res.status === 401 || res.status === 404) {
          localStorage.removeItem(STORE_KEY)
        }
      })
      .catch(() => { /* offline: keep the cached identity until proven invalid */ })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await authFetch(assetUrl('/api/auth/login'), {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, code: d.code || 'invalid_credentials', status: res.status }
    localStorage.setItem(STORE_KEY, JSON.stringify({ token: d.token, user: d.user }))
    setUser(d.user)
    return { ok: true, user: d.user }
  }, [])

  const register = useCallback(async ({ username, password, name }) => {
    const res = await authFetch(assetUrl('/api/auth/register'), {
      method: 'POST',
      body: JSON.stringify({ username, password, name })
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, code: d.code || 'invalid_input', status: res.status }
    localStorage.setItem(STORE_KEY, JSON.stringify({ token: d.token, user: d.user }))
    setUser(d.user)
    return { ok: true, user: d.user }
  }, [])

  const logout = useCallback(async () => {
    try { await authFetch(assetUrl('/api/auth/logout'), { method: 'POST' }) } catch { /* ignore */ }
    localStorage.removeItem(STORE_KEY)
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (patch) => {
    const res = await authFetch(assetUrl('/api/me'), {
      method: 'PATCH',
      body: JSON.stringify(patch)
    })
    if (!res.ok) return { ok: false }
    const d = await res.json().catch(() => ({}))
    if (d?.user) {
      setUser(d.user)
      const sess = storedSession()
      if (sess?.token) localStorage.setItem(STORE_KEY, JSON.stringify({ token: sess.token, user: d.user }))
    }
    return { ok: !!res.ok, user: d.user }
  }, [])

  const value = useMemo(() => ({ user, loading, login, register, logout, updateProfile }), [user, loading, login, register, logout, updateProfile])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Gate: only signed-in fans may open personal/community pages. */
export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const { t } = useLang()
  if (loading) {
    return <div className="section container"><div className="state"><div className="skeleton" style={{ width: 200, height: 20 }} /></div></div>
  }
  if (user) return children
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 560 }}>
        <EmptyState
          icon="🔒"
          title={t('auth.loginRequired')}
          sub={t('auth.loginRequiredSub')}
          action={<Link className="btn primary" to="/login">{t('auth.login')}</Link>}
        />
      </div>
    </section>
  )
}
