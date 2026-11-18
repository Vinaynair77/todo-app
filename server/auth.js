import crypto from 'node:crypto'
import { db } from './db.js'

export const SESSION_COOKIE = 'todo_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/* ---- Passwords (scrypt with a per-user random salt) ---- */

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

/* ---- Sessions (opaque random tokens stored in SQLite) ---- */

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const now = Date.now()
  // Opportunistic cleanup of expired sessions.
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now)
  db.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    token,
    userId,
    now + SESSION_TTL_MS,
    now,
  )
  return token
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

function userForToken(token) {
  if (!token) return null
  const row = db
    .prepare(
      `SELECT u.id, u.identifier, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token)
  if (!row) return null
  if (row.expires_at < Date.now()) {
    destroySession(token)
    return null
  }
  return { id: row.id, identifier: row.identifier }
}

/** Resolves the session cookie into req.user (null when not signed in). */
export function attachUser(req, _res, next) {
  req.user = userForToken(req.cookies[SESSION_COOKIE])
  next()
}

/** Guards API routes that require a signed-in user. */
export function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: 'You must be signed in.' })
    return
  }
  next()
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
    path: '/',
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' })
}
