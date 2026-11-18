import { db } from './db.js'

export const MAX_MEMBERS = 50

/**
 * Turn identifiers (email/username) into accounts that can be added to a task
 * or team. Any account in `excludeIds` (the owner/creator) is never returned.
 */
export function resolveMembers(identifiers, excludeIds = []) {
  if (!Array.isArray(identifiers)) {
    return { error: 'Members must be a list of email addresses or usernames.' }
  }
  if (identifiers.length > MAX_MEMBERS) {
    return { error: `Can share with at most ${MAX_MEMBERS} people.` }
  }

  const excluded = new Set(excludeIds.map(Number))
  const findUser = db.prepare(
    'SELECT id, identifier FROM users WHERE identifier = ? COLLATE NOCASE',
  )
  const seen = new Set()
  const members = []
  const unknown = []

  for (const value of identifiers) {
    if (typeof value !== 'string') continue
    const identifier = value.trim()
    if (!identifier) continue

    const key = identifier.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const user = findUser.get(identifier)
    if (!user) {
      unknown.push(identifier)
      continue
    }
    if (!excluded.has(Number(user.id))) {
      members.push({ id: Number(user.id), identifier: user.identifier })
    }
  }

  if (unknown.length > 0) {
    return {
      error: `No account found for: ${unknown.join(', ')}. They need to sign up first.`,
    }
  }
  return { members }
}
