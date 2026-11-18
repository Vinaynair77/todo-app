import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import ThemeToggle from './ThemeToggle'

// The account identifier can be either a username or an email address.
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,30}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PASSWORD_MIN_LENGTH = 8

function isValidIdentifier(value) {
  const trimmed = value.trim()
  return trimmed.length > 0 && (USERNAME_PATTERN.test(trimmed) || EMAIL_PATTERN.test(trimmed))
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  )
}

function AuthPage() {
  const { login, signup } = useAuth()
  const [mode, setMode] = useState('login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(() => {
    // A failed Google redirect comes back as ?authError=...
    return new URLSearchParams(window.location.search).get('authError') ?? ''
  })
  const [busy, setBusy] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)

  useEffect(() => {
    // Drop the OAuth error from the URL so a refresh doesn't repeat it.
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    api('/api/auth/config')
      .then((config) => setGoogleEnabled(Boolean(config.googleEnabled)))
      .catch(() => setGoogleEnabled(false))
  }, [])

  const isSignup = mode === 'signup'

  const switchMode = () => {
    setMode(isSignup ? 'login' : 'signup')
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!isValidIdentifier(identifier)) {
      setError(
        'Enter a valid email address or a username (3-30 letters, numbers, dots, dashes, underscores).',
      )
      return
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
      return
    }

    setBusy(true)
    try {
      if (isSignup) {
        await signup(identifier.trim(), password)
      } else {
        await login(identifier.trim(), password)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <ThemeToggle className="theme-toggle-auth" />
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="auth-title">To-Do</h1>
        <p className="auth-subtitle">
          {isSignup ? 'Create an account to keep track of your tasks.' : 'Sign in to see your tasks.'}
        </p>

        {googleEnabled && (
          <>
            <a className="btn-google" href="/api/auth/google">
              <GoogleIcon />
              Continue with Google
            </a>
            <div className="auth-divider" role="separator">
              <span>or</span>
            </div>
          </>
        )}

        <label className="field">
          <span className="field-label">Email or username</span>
          <input
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="you@example.com or alice"
            autoComplete="username"
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
        </button>

        <p className="auth-switch">
          {isSignup ? 'Already have an account? ' : "Don't have an account? "}
          <button type="button" className="btn-link-dark" onClick={switchMode}>
            {isSignup ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </form>
    </div>
  )
}

export default AuthPage
