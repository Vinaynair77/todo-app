import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

/**
 * GET /api/users/search?q=...
 * Finds accounts by email/username so a task can be shared with them.
 * Only signed-in users can search, and the requester is never returned.
 */
router.get('/search', (req, res) => {
  const raw = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (raw.length < 1) {
    res.json([])
    return
  }

  // Escape LIKE wildcards so a literal % or _ doesn't match everything.
  const term = raw.slice(0, 100).replace(/[\\%_]/g, (char) => `\\${char}`)
  const rows = db
    .prepare(
      `SELECT id, identifier FROM users
       WHERE id != ? AND identifier LIKE ? ESCAPE '\\'
       ORDER BY identifier COLLATE NOCASE
       LIMIT 8`,
    )
    .all(req.user.id, `%${term}%`)

  res.json(rows.map((row) => ({ id: Number(row.id), identifier: row.identifier })))
})

export default router
