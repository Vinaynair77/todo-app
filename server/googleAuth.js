import { db } from './db.js'

/**
 * Google OAuth 2.0 / OpenID Connect helper.
 *
 * Endpoints are fixed Google URLs by default; they can be overridden with
 * environment variables (handy for tests or compatible identity providers).
 */

const AUTH_URL = process.env.GOOGLE_AUTH_URL ?? 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL ?? 'https://oauth2.googleapis.com/token'
const USERINFO_URL =
  process.env.GOOGLE_USERINFO_URL ?? 'https://openidconnect.googleapis.com/v1/userinfo'

export const GOOGLE_STATE_COOKIE = 'google_oauth_state'
export const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

/** The app URL the browser returns to after sign-in (no trailing slash). */
export function appUrl() {
  return (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '')
}

export function googleRedirectUri() {
  return `${appUrl()}/api/auth/google/callback`
}

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return `${AUTH_URL}?${params}`
}

/** Exchange the authorization code for tokens. */
export async function exchangeCode(code) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status})`)
  }
  return response.json()
}

/** Fetch the signed-in Google profile. */
export async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Google userinfo request failed (${response.status})`)
  }
  return response.json()
}

/**
 * Find, link, or create the local account for a Google profile.
 * - Existing Google account (by "sub") -> return it.
 * - Existing email/username account with the same email -> link Google to it.
 * - Otherwise create a new passwordless account keyed by the Google email.
 */
export function findOrCreateGoogleUser({ sub, email, emailVerified }) {
  if (!sub || typeof sub !== 'string') {
    throw new Error('Google did not return an account id.')
  }
  if (!emailVerified || typeof email !== 'string' || !email.trim()) {
    throw new Error('Your Google account email is not verified.')
  }
  const identifier = email.trim()

  const byGoogleId = db.prepare('SELECT id, identifier FROM users WHERE google_id = ?').get(sub)
  if (byGoogleId) {
    return { id: byGoogleId.id, identifier: byGoogleId.identifier }
  }

  const byEmail = db
    .prepare('SELECT id, identifier FROM users WHERE identifier = ? COLLATE NOCASE')
    .get(identifier)
  if (byEmail) {
    db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(sub, byEmail.id)
    return { id: byEmail.id, identifier: byEmail.identifier }
  }

  const result = db
    .prepare(
      "INSERT INTO users (identifier, password_hash, google_id, created_at) VALUES (?, '', ?, ?)",
    )
    .run(identifier, sub, Date.now())
  return { id: Number(result.lastInsertRowid), identifier }
}
