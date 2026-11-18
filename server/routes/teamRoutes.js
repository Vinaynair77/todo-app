import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'
import { resolveMembers } from '../members.js'

const router = Router()

// Every team route requires a signed-in user.
router.use(requireAuth)

const NAME_MAX = 80

const TEAM_SELECT = `
  SELECT t.id, t.name, t.created_by, t.created_at, creator.identifier AS creator
  FROM teams t
  JOIN users creator ON creator.id = t.created_by
`

// A team is visible to its creator and to any of its members.
const VISIBLE_WHERE = `
  (t.created_by = ? OR EXISTS (
    SELECT 1 FROM team_members mem WHERE mem.team_id = t.id AND mem.user_id = ?
  ))
`

function membersByTeamId(teamIds) {
  const map = new Map()
  if (teamIds.length === 0) return map

  const placeholders = teamIds.map(() => '?').join(', ')
  const rows = db
    .prepare(
      `SELECT tm.team_id, u.identifier
       FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id IN (${placeholders})
       ORDER BY u.identifier COLLATE NOCASE`,
    )
    .all(...teamIds)

  for (const row of rows) {
    const teamId = Number(row.team_id)
    if (!map.has(teamId)) map.set(teamId, [])
    map.get(teamId).push(row.identifier)
  }
  return map
}

function teamToJson(row, members) {
  return {
    id: Number(row.id),
    name: row.name,
    createdBy: row.creator,
    members,
    createdAt: row.created_at,
  }
}

function findVisibleTeam(id, userId) {
  return db
    .prepare(`${TEAM_SELECT} WHERE t.id = ? AND ${VISIBLE_WHERE}`)
    .get(id, userId, userId)
}

function serializeTeam(id) {
  const row = db.prepare(`${TEAM_SELECT} WHERE t.id = ?`).get(id)
  return teamToJson(row, membersByTeamId([id]).get(Number(id)) ?? [])
}

function nameTaken(name, exceptId = null) {
  const row = db
    .prepare('SELECT id FROM teams WHERE name = ? COLLATE NOCASE AND id != ?')
    .get(name, exceptId ?? -1)
  return Boolean(row)
}

function validateName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return 'Team name is required.'
  }
  if (name.trim().length > NAME_MAX) {
    return `Team name must be at most ${NAME_MAX} characters.`
  }
  return null
}

/* GET /api/teams — teams the signed-in user created or belongs to */
router.get('/', (req, res) => {
  const rows = db
    .prepare(`${TEAM_SELECT} WHERE ${VISIBLE_WHERE} ORDER BY t.name COLLATE NOCASE`)
    .all(req.user.id, req.user.id)
  const members = membersByTeamId(rows.map((row) => row.id))

  res.json(rows.map((row) => teamToJson(row, members.get(Number(row.id)) ?? [])))
})

/* POST /api/teams — create a named team with optional members */
router.post('/', (req, res) => {
  const { name, members: memberInput = [] } = req.body ?? {}

  const nameError = validateName(name)
  if (nameError) {
    res.status(400).json({ error: nameError })
    return
  }
  const teamName = name.trim()
  if (nameTaken(teamName)) {
    res.status(400).json({ error: `A team named “${teamName}” already exists.` })
    return
  }

  const resolved = resolveMembers(memberInput, [req.user.id])
  if (resolved.error) {
    res.status(400).json({ error: resolved.error })
    return
  }

  let teamId
  db.exec('BEGIN')
  try {
    const result = db
      .prepare('INSERT INTO teams (name, created_by, created_at) VALUES (?, ?, ?)')
      .run(teamName, req.user.id, Date.now())
    teamId = Number(result.lastInsertRowid)

    const insertMember = db.prepare(
      'INSERT OR IGNORE INTO team_members (team_id, user_id, added_at) VALUES (?, ?, ?)',
    )
    for (const member of resolved.members) insertMember.run(teamId, member.id, Date.now())
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    if (String(err.message).includes('UNIQUE')) {
      res.status(400).json({ error: `A team named “${teamName}” already exists.` })
      return
    }
    throw err
  }

  res.status(201).json(serializeTeam(teamId))
})

/* PATCH /api/teams/:id — any member can rename the team or change its members */
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid team id.' })
    return
  }

  const row = findVisibleTeam(id, req.user.id)
  if (!row) {
    res.status(404).json({ error: 'Team not found.' })
    return
  }

  const body = req.body ?? {}
  const hasName = Object.hasOwn(body, 'name')
  const hasMembers = Object.hasOwn(body, 'members')
  if (!hasName && !hasMembers) {
    res.status(400).json({ error: 'Nothing to update.' })
    return
  }

  const teamName = hasName ? body.name.trim() : row.name
  if (hasName) {
    const nameError = validateName(body.name)
    if (nameError) {
      res.status(400).json({ error: nameError })
      return
    }
    if (nameTaken(teamName, id)) {
      res.status(400).json({ error: `A team named “${teamName}” already exists.` })
      return
    }
  }

  let members
  if (hasMembers) {
    const resolved = resolveMembers(body.members, [row.created_by])
    if (resolved.error) {
      res.status(400).json({ error: resolved.error })
      return
    }
    members = resolved.members
  }

  db.exec('BEGIN')
  try {
    if (hasName) {
      db.prepare('UPDATE teams SET name = ? WHERE id = ?').run(teamName, id)
    }
    if (hasMembers) {
      const now = Date.now()
      const insert = db.prepare(
        'INSERT OR IGNORE INTO team_members (team_id, user_id, added_at) VALUES (?, ?, ?)',
      )
      db.prepare('DELETE FROM team_members WHERE team_id = ?').run(id)
      for (const member of members) insert.run(id, member.id, now)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    if (String(err.message).includes('UNIQUE')) {
      res.status(400).json({ error: `A team named “${teamName}” already exists.` })
      return
    }
    throw err
  }

  res.json(serializeTeam(id))
})

/* DELETE /api/teams/:id — remove a team; its tasks become directly shared */
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid team id.' })
    return
  }

  if (!findVisibleTeam(id, req.user.id)) {
    res.status(404).json({ error: 'Team not found.' })
    return
  }

  const memberIds = db
    .prepare('SELECT user_id FROM team_members WHERE team_id = ?')
    .all(id)
    .map((row) => Number(row.user_id))
  const tasks = db.prepare('SELECT id, user_id FROM tasks WHERE team_id = ?').all(id)

  db.exec('BEGIN')
  try {
    // Keep access stable: every current team member becomes a direct member of
    // each task that was shared through this team, and the tasks stay team tasks.
    const insert = db.prepare(
      'INSERT OR IGNORE INTO task_members (task_id, user_id, added_at) VALUES (?, ?, ?)',
    )
    const now = Date.now()
    for (const task of tasks) {
      for (const userId of memberIds) {
        if (userId !== Number(task.user_id)) insert.run(task.id, userId, now)
      }
    }
    db.prepare('UPDATE tasks SET team_id = NULL WHERE team_id = ?').run(id)
    db.prepare('DELETE FROM teams WHERE id = ?').run(id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  res.json({ ok: true, tasksConverted: tasks.length })
})

export default router
