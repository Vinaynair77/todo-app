/**
 * Small JSON fetch wrapper for the backend API.
 * Requests go through the Vite dev proxy (/api → http://localhost:3001),
 * so the session cookie travels on the same origin.
 */
export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    // Empty or non-JSON body — fall through to status handling.
  }

  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed (${response.status})`)
  }
  return data
}
