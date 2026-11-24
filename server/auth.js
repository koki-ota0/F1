// ============================================================================
// PITWALL — account authentication (username + password only, no email)
// ----------------------------------------------------------------------------
// Design goals:
//   * zero external dependencies (Node crypto only)
//   * passwords are never stored: scrypt(N=16384) per-user random salt
//   * sessions are opaque random tokens; only their SHA-256 hash is persisted
//   * works over an httpOnly SameSite=Lax cookie AND an Authorization: Bearer
//     header (the SPA keeps the token in localStorage so it also works when
//     cookies are unavailable)
//   * constant-time comparison, basic rate limiting, atomic file writes
// ============================================================================

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json')

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 }
const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'passw0rd', '12345678', '123456789', 'qwertyui',
  'qwerty123', 'iloveyou1', 'admin123', 'letmein1', 'football1', 'baseball1',
  'welcome1', 'abc12345', 'p@ssw0rd', 'pitwall123', 'f1f1f1f1'
])

const rid = (prefix) => `${prefix}_${crypto.randomBytes(9).toString('hex')}`

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

/** Write JSON atomically so a crash cannot truncate the account store. */
function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2))
  fs.renameSync(tmp, file)
}

// ---------------------------------------------------------------------------
// password hashing
// ---------------------------------------------------------------------------

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p
  })
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${hash.toString('hex')}`
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, salt, hex] = String(stored || '').split('$')
    if (scheme !== 'scrypt' || !salt || !hex) return false
    const expected = Buffer.from(hex, 'hex')
    const actual = crypto.scryptSync(String(password), salt, expected.length, {
      N: Number(N), r: Number(r), p: Number(p)
    })
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

function loadUsers() {
  const d = readJson(USERS_FILE, { users: [] })
  return Array.isArray(d.users) ? d : { users: [] }
}

function saveUsers(db) { writeJson(USERS_FILE, db) }

export function publicUser(u) {
  if (!u) return null
  return {
    id: u.id,
    username: u.username,
    name: u.name || u.username,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || null,
    profile: {
      driver: u.profile?.driver || '',
      team: u.profile?.team || '',
      xp: Number(u.profile?.xp) || 0,
      bestStreak: Number(u.profile?.bestStreak) || 0
    }
  }
}

export const USERNAME_ERRORS = {
  type: 'username_type', format: 'username_format'
}
export function validateUsername(username) {
  if (typeof username !== 'string') return USERNAME_ERRORS.type
  const u = username.trim()
  if (!USERNAME_RE.test(u)) return USERNAME_ERRORS.format
  return null
}

export const PASSWORD_ERRORS = {
  type: 'password_type', length: 'password_length', strength: 'password_strength', common: 'password_common'
}
export function validatePassword(password) {
  if (typeof password !== 'string') return PASSWORD_ERRORS.type
  if (password.length < 8 || password.length > 128) return PASSWORD_ERRORS.length
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return PASSWORD_ERRORS.strength
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return PASSWORD_ERRORS.common
  return null
}

/**
 * @returns {{ok:true, user:object} | {ok:false, error:string}}
 */
export function createUser({ username, password, name }) {
  const unameError = validateUsername(username)
  if (unameError) return { ok: false, error: unameError }
  const pwError = validatePassword(password)
  if (pwError) return { ok: false, error: pwError }
  const db = loadUsers()
  const uname = String(username).trim()
  if (db.users.some((u) => u.username.toLowerCase() === uname.toLowerCase())) {
    return { ok: false, error: 'username already taken', code: 'username_taken' }
  }
  const user = {
    id: rid('u'),
    username: uname,
    name: (name || uname).toString().slice(0, 24) || uname,
    ph: hashPassword(password),
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    profile: { driver: '', team: '', xp: 0, bestStreak: 0 }
  }
  db.users.push(user)
  saveUsers(db)
  return { ok: true, user }
}

export function authenticate(username, password) {
  const db = loadUsers()
  const uname = String(username || '').trim().toLowerCase()
  const user = db.users.find((u) => u.username.toLowerCase() === uname)
  // always run a hash so a missing account costs about the same as a bad password
  const stored = user?.ph || hashPassword(String(password || ''), '0'.repeat(32))
  if (!verifyPassword(String(password || ''), stored)) return null
  user.lastLoginAt = new Date().toISOString()
  saveUsers(db)
  return user
}

export function findUserById(id) {
  return loadUsers().users.find((u) => u.id === id) || null
}

export function updateProfile(id, patch) {
  const db = loadUsers()
  const user = db.users.find((u) => u.id === id)
  if (!user) return null
  const next = { ...user.profile }
  for (const key of ['driver', 'team']) {
    if (typeof patch[key] === 'string') next[key] = patch[key].slice(0, 40)
  }
  for (const key of ['xp', 'bestStreak']) {
    if (patch[key] != null) {
      const n = Math.max(0, Math.min(1_000_000, Math.floor(Number(patch[key]) || 0)))
      next[key] = n
    }
  }
  if (typeof patch.name === 'string' && patch.name.trim()) {
    user.name = patch.name.trim().slice(0, 24)
  }
  user.profile = next
  saveUsers(db)
  return user
}

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

function loadSessions() {
  const d = readJson(SESSIONS_FILE, { sessions: [] })
  return Array.isArray(d.sessions) ? d : { sessions: [] }
}

function saveSessions(db) { writeJson(SESSIONS_FILE, db) }

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

export function issueSession(userId, req = {}) {
  const token = crypto.randomBytes(32).toString('base64url')
  const db = loadSessions()
  const now = Date.now()
  db.sessions = db.sessions.filter((s) => s.exp > now).slice(-500)
  db.sessions.push({
    th: hashToken(token),
    uid: userId,
    at: new Date(now).toISOString(),
    exp: now + SESSION_TTL_MS,
    ua: String(req.headers?.['user-agent'] || '').slice(0, 200)
  })
  saveSessions(db)
  return { token, expiresAt: new Date(now + SESSION_TTL_MS).toISOString() }
}

export function revokeSession(token) {
  const th = hashToken(token)
  const db = loadSessions()
  const before = db.sessions.length
  db.sessions = db.sessions.filter((s) => s.th !== th)
  saveSessions(db)
  return db.sessions.length !== before
}

/** Resolve a request (cookie and/or bearer header) to a live session. */
export function resolveSession(req) {
  const header = String(req.headers?.authorization || '')
  let token = ''
  if (/^Bearer\s+/i.test(header)) token = header.replace(/^Bearer\s+/i, '').trim()
  else {
    const cookie = String(req.headers?.cookie || '')
    const m = cookie.match(/(?:^|;\s*)pitwall_sid=([^;]+)/)
    if (m) token = decodeURIComponent(m[1])
  }
  if (!token) return null
  const th = hashToken(token)
  const db = loadSessions()
  const session = db.sessions.find((s) => s.th === th)
  if (!session || session.exp < Date.now()) return null
  const user = findUserById(session.uid)
  if (!user) return null
  return { token, session, user }
}

// ---------------------------------------------------------------------------
// express helpers
// ---------------------------------------------------------------------------

/** Parse the account cookie into a Set-Cookie header value. */
export function sessionCookie(token, expiresAt, req = {}) {
  const proto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim()
  const secure = proto === 'https'
  const parts = [
    `pitwall_sid=${encodeURIComponent(token)}`,
    'Path=/',
    `Expires=${new Date(expiresAt).toUTCString()}`,
    'Max-Age=2592000',
    'HttpOnly',
    'SameSite=Lax'
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

/** Attach req.authUser when a valid session exists (never rejects). */
export function attachUser(req, _res, next) {
  try {
    const resolved = resolveSession(req)
    if (resolved) req.authUser = resolved.user
  } catch { /* auth is optional unless a route requires it */ }
  next()
}

/** Reject with 401 JSON when no valid session is present. */
export function requireAuth(req, res, next) {
  if (!req.authUser) return res.status(401).json({ error: 'authentication required' })
  next()
}

/** Very small fixed-window limiter (per process, keyed by caller choice). */
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 12, key: keyFn } = {}) {
  const hits = new Map()
  return (req, res, next) => {
    const base = req.ip || req.socket?.remoteAddress || 'anon'
    const key = keyFn ? `${base}:${keyFn(req)}` : base
    const now = Date.now()
    const rec = hits.get(key)
    if (!rec || rec.reset < now) hits.set(key, { count: 1, reset: now + windowMs })
    else {
      rec.count += 1
      if (rec.count > max) {
        const retry = Math.ceil((rec.reset - now) / 1000)
        res.set('Retry-After', String(retry))
        return res.status(429).json({ error: 'too many attempts, try later', retry })
      }
    }
    next()
  }
}
