import crypto from 'node:crypto'
import { Router } from 'express'
import { db } from '../db.js'
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  destroySession,
  hashPassword,
  requireAuth,
  setSessionCookie,
  verifyPassword,
} from '../auth.js'
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_TTL_MS,
  appUrl,
  buildAuthUrl,
  exchangeCode,
  fetchGoogleUserInfo,
  findOrCreateGoogleUser,
  isGoogleConfigured,
} from '../googleAuth.js'

const router = Router()

// An account identifier may be a username or an email address.
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,30}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PASSWORD_MIN_LENGTH = 8
const MAX_IDENTIFIER_LENGTH = 254

export function isValidIdentifier(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return (
    trimmed.length > 0 &&
    trimmed.length <= MAX_IDENTIFIER_LENGTH &&
    (USERNAME_PATTERN.test(trimmed) || EMAIL_PATTERN.test(trimmed))
  )
}

function publicUser(user) {
  return { id: user.id, identifier: user.identifier }
}

function findUserByIdentifier(identifier) {
  return db
    .prepare('SELECT id, identifier, password_hash FROM users WHERE identifier = ? COLLATE NOCASE')
    .get(identifier)
}

/* POST /api/auth/signup — create an account (email or username) and start a session */
router.post('/signup', (req, res) => {
  const { identifier, password } = req.body ?? {}
  const account = typeof identifier === 'string' ? identifier.trim() : ''

  if (!isValidIdentifier(account)) {
    res.status(400).json({
      error:
        'Enter a valid email address or a username (3-30 letters, numbers, dots, dashes, underscores).',
    })
    return
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` })
    return
  }

  if (findUserByIdentifier(account)) {
    res.status(409).json({ error: 'That email or username is already taken.' })
    return
  }

  let userId
  try {
    const result = db
      .prepare('INSERT INTO users (identifier, password_hash, created_at) VALUES (?, ?, ?)')
      .run(account, hashPassword(password), Date.now())
    userId = Number(result.lastInsertRowid)
  } catch {
    // UNIQUE constraint (e.g. concurrent signup with the same identifier, different case).
    res.status(409).json({ error: 'That email or username is already taken.' })
    return
  }

  setSessionCookie(res, createSession(userId))
  res.status(201).json(publicUser({ id: userId, identifier: account }))
})

/* POST /api/auth/login — sign in with an email address or username */
router.post('/login', (req, res) => {
  const { identifier, password } = req.body ?? {}
  const account = typeof identifier === 'string' ? identifier.trim() : ''

  if (!account || typeof password !== 'string') {
    res.status(400).json({ error: 'Email or username and password are required.' })
    return
  }

  const row = findUserByIdentifier(account)
  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email, username, or password.' })
    return
  }

  setSessionCookie(res, createSession(row.id))
  res.json(publicUser(row))
})

/* POST /api/auth/logout — end the session */
router.post('/logout', (req, res) => {
  destroySession(req.cookies[SESSION_COOKIE])
  clearSessionCookie(res)
  res.json({ ok: true })
})

/* GET /api/auth/me — the signed-in user (401 otherwise) */
router.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user))
})

/* GET /api/auth/config — which sign-in options are available */
router.get('/config', (_req, res) => {
  res.json({ googleEnabled: isGoogleConfigured() })
})

/* GET /api/auth/google — start the Google OAuth flow */
router.get('/google', (_req, res) => {
  if (!isGoogleConfigured()) {
    res.redirect(`${appUrl()}/?authError=${encodeURIComponent('Google sign-in is not configured.')}`)
    return
  }

  const state = crypto.randomBytes(16).toString('hex')
  res.cookie(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: GOOGLE_STATE_TTL_MS,
    path: '/',
  })
  res.redirect(buildAuthUrl(state))
})

/* GET /api/auth/google/callback — Google redirects back here */
router.get('/google/callback', async (req, res) => {
  const fail = (message) => {
    res.redirect(`${appUrl()}/?authError=${encodeURIComponent(message)}`)
  }

  const expectedState = req.cookies[GOOGLE_STATE_COOKIE]
  res.clearCookie(GOOGLE_STATE_COOKIE, { path: '/' })

  try {
    const { code, state } = req.query

    if (!isGoogleConfigured()) {
      fail('Google sign-in is not configured.')
      return
    }
    if (typeof code !== 'string' || typeof state !== 'string' || !expectedState || state !== expectedState) {
      fail('Google sign-in could not be verified. Please try again.')
      return
    }

    const tokens = await exchangeCode(code)
    const profile = await fetchGoogleUserInfo(tokens.access_token)
    const user = findOrCreateGoogleUser({
      sub: profile.sub,
      email: profile.email,
      emailVerified: profile.email_verified === true,
    })

    setSessionCookie(res, createSession(user.id))
    res.redirect(appUrl())
  } catch (err) {
    console.error('Google sign-in error:', err.message)
    fail('Google sign-in failed. Please try again.')
  }
})

export default router
