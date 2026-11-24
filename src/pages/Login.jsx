import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../lib/i18n.jsx'
import { SectionHead } from '../components/common.jsx'
import { useAuth } from '../lib/auth.jsx'

/**
 * Sign in / create account.
 *
 * Username + password only (no email). The server hashes with scrypt and
 * returns an opaque session token; a static host without our API answers 404,
 * which we surface as an honest "accounts need the server" message.
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
  const [serverMissing, setServerMissing] = useState(false)

  const from = location.state?.from || '/fan'

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setServerMissing(false)
    try {
      const res = mode === 'login'
        ? await login(username.trim(), password)
        : await register({ username: username.trim(), password, name: name.trim() })
      if (res.ok) {
        navigate(from, { replace: true })
        return
      }
      if (res.status === 404) setServerMissing(true)
      else setError(t(`auth.error.${res.code}`))
    } catch {
      setError(t('auth.error.server'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 520 }}>
        <SectionHead eyebrow="PITWALL ACCOUNT" title={t('auth.title')} sub={t('auth.sub')} />

        <div className="card" style={{ padding: 22 }}>
          <div className="tabs" style={{ marginBottom: 16 }}>
            <button className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setError('') }}>
              {t('auth.login')}
            </button>
            <button className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setError('') }}>
              {t('auth.register')}
            </button>
          </div>

          <form onSubmit={submit} autoComplete={mode === 'login' ? 'on' : 'off'}>
            <div className="field">
              <label htmlFor="auth-username">{t('auth.username')}</label>
              <input
                id="auth-username"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                autoComplete="username"
                required
              />
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
              {mode === 'register' && (
                <div className="note" style={{ marginTop: 6 }}>
                  8〜128文字・英字と数字を含む
                </div>
              )}
            </div>

            {serverMissing && (
              <p className="badge gold" style={{ marginBottom: 12 }}>{t('auth.serverRequired')}</p>
            )}
            {error && (
              <p className="badge warn" style={{ marginBottom: 12 }} role="alert">{error}</p>
            )}

            <button className="btn primary" type="submit" disabled={busy || !username || !password}>
              {busy ? t('common.loading') : (mode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister'))}
            </button>
          </form>

          <hr className="divider" />
          <p className="note" style={{ margin: 0 }}>
            {mode === 'login' ? (
              <Link className="inline-link" to="/login" onClick={(e) => { e.preventDefault(); setMode('register') }}>
                {t('auth.noAccount')}
              </Link>
            ) : (
              <Link className="inline-link" to="/login" onClick={(e) => { e.preventDefault(); setMode('login') }}>
                {t('auth.haveAccount')}
              </Link>
            )}
          </p>
        </div>
      </div>
    </section>
  )
}
