import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../lib/i18n.jsx'
import { SectionHead } from '../components/common.jsx'
import { useAuth } from '../lib/auth.jsx'

/**
 * Sign in / create account.
 *
 * Username + password only (no email). The server hashes with scrypt and
 * returns an opaque session token.
 *
 * Failure handling matters here: a static host (GitHub Pages) has no API, so
 * `POST /api/auth/*` comes back 405 with an HTML error page. That is a missing
 * backend, not a malformed form — the page says so up front instead of sending
 * the user back to "check your input" with nothing to fix.
 */
export default function Login() {
  const { t } = useLang()
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errorField, setErrorField] = useState('')
  const [serverMissing, setServerMissing] = useState(false)

  const from = location.state?.from || '/fan'
  // Baked static build = no Express API behind the page. We know this before
  // the user types anything, so the limitation is stated immediately.
  const staticHost = typeof window !== 'undefined' && window.__PITWALL_API__ === false
  const serverOffline = serverMissing || staticHost

  const usernameHints = t('auth.userHint') || ''
  const passwordHints = t('auth.passHint') || ''

  const fieldForCode = (code) => {
    if (code.startsWith('username')) return 'username'
    if (code.startsWith('password')) return 'password'
    return ''
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setErrorField(''); setServerMissing(false)
    try {
      const res = mode === 'login'
        ? await login(username.trim(), password)
        : await register({ username: username.trim(), password, name: name.trim() })
      if (res.ok) {
        navigate(from, { replace: true })
        return
      }
      // A missing API is a deployment fact, not an input problem.
      if (res.code === 'server_unavailable' || res.status === 404 || res.status === 405 || res.status === 501) {
        setServerMissing(true)
        return
      }
      setError(t(`auth.error.${res.code}`))
      const field = fieldForCode(String(res.code))
      setErrorField(field)
      if (field) {
        const el = document.getElementById(`auth-${field}`)
        el?.focus?.()
      }
    } catch {
      setError(t('auth.error.server'))
      setServerMissing(true)
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (next) => {
    setMode(next)
    setError(''); setErrorField(''); setServerMissing(false)
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 520 }}>
        <SectionHead eyebrow="PITWALL ACCOUNT" title={t('auth.title')} sub={t('auth.sub')} />

        <div className="card" style={{ padding: 22 }}>
          <div className="tabs" style={{ marginBottom: 16 }}>
            <button className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>
              {t('auth.login')}
            </button>
            <button className={mode === 'register' ? 'on' : ''} onClick={() => switchMode('register')}>
              {t('auth.register')}
            </button>
          </div>

          {serverOffline && (
            <p className="form-alert info" role="status">
              {t('auth.serverRequired')}
            </p>
          )}

          <form onSubmit={submit} autoComplete={mode === 'login' ? 'on' : 'off'} noValidate>
            <div className="field">
              <label htmlFor="auth-username">{t('auth.username')}</label>
              <input
                id="auth-username"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                autoComplete="username"
                aria-invalid={errorField === 'username' ? 'true' : undefined}
                required
              />
              {mode === 'register' && <div className="hint">{usernameHints}</div>}
            </div>

            {mode === 'register' && (
              <div className="field">
                <label htmlFor="auth-name">{t('auth.displayName')}</label>
                <input
                  id="auth-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  autoComplete="nickname"
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="auth-password">{t('auth.password')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="auth-password"
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={128}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  aria-invalid={errorField === 'password' ? 'true' : undefined}
                  required
                />
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? '🙈' : '👁️'}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
              {mode === 'register' && <div className="hint">{passwordHints}</div>}
            </div>

            {error && (
              <p className="form-alert" role="alert">{error}</p>
            )}

            <button className="btn primary" type="submit" disabled={busy || !username || !password}>
              {busy ? t('common.loading') : (mode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister'))}
            </button>
          </form>

          <hr className="divider" />
          <p className="note" style={{ margin: 0 }}>
            {mode === 'login' ? (
              <Link className="inline-link" to="/login" onClick={(e) => { e.preventDefault(); switchMode('register') }}>
                {t('auth.noAccount')}
              </Link>
            ) : (
              <Link className="inline-link" to="/login" onClick={(e) => { e.preventDefault(); switchMode('login') }}>
                {t('auth.haveAccount')}
              </Link>
            )}
          </p>
        </div>
      </div>
    </section>
  )
}
