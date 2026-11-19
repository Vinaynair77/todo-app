import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'
import { resolveMembers } from '../members.js'

const router = Router()

// Every task route requires a signed-in user.
router.use(requireAuth)

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TASK_TYPES = new Set(['personal', 'team'])

const TASK_SELECT = `
  SELECT t.id, t.title, t.due_date, t.completed, t.created_at, t.completed_at,
         t.type, t.user_id, t.completed_by, t.team_id,
         creator.identifier AS owner,
         completer.identifier AS completed_by_identifier,
         team.name AS team_name
  FROM tasks t
  JOIN users creator ON creator.id = t.user_id
  LEFT JOIN users completer ON completer.id = t.completed_by
  LEFT JOIN teams team ON team.id = t.team_id
`

// A task is visible to its creator, to people it is directly shared with, and
// to members of the team it belongs to.
const VISIBLE_WHERE = `
  (t.user_id = ? OR EXISTS (
    SELECT 1 FROM task_members tm WHERE tm.task_id = t.id AND tm.user_id = ?
  ) OR (t.team_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM team_members tmem WHERE tmem.team_id = t.team_id AND tmem.user_id = ?
  )))
`

function taskToJson(row, members) {
  return {
    id: Number(row.id),
    title: row.title,
    dueDate: row.due_date,
    type: row.type,
    owner: row.owner,
    ownerId: Number(row.user_id),
    team: row.team_id == null ? null : { id: Number(row.team_id), name: row.team_name },
    members,
    completed: Boolean(row.completed),
    completedBy: row.completed_by_identifier ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  }
}

function identifiersByTaskId(taskIds) {
  const map = new Map()
  if (taskIds.length === 0) return map

  const placeholders = taskIds.map(() => '?').join(', ')
  const rows = db
    .prepare(
      `SELECT tm.task_id, u.identifier
       FROM task_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.task_id IN (${placeholders})
       ORDER BY u.identifier COLLATE NOCASE`,
    )
    .all(...taskIds)

  for (const row of rows) {
    const taskId = Number(row.task_id)
    if (!map.has(taskId)) map.set(taskId, [])
    map.get(taskId).push(row.identifier)
  }
  return map
}

function identifiersByTeamId(teamIds) {
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

/**
 * Attach the effective member list to each task: direct members plus, for
 * team tasks, the team's members (excluding the task owner).
 */
function serializeRows(rows) {
  if (rows.length === 0) return []

  const direct = identifiersByTaskId(rows.map((row) => row.id))
  const teamIds = [...new Set(rows.filter((row) => row.team_id != null).map((row) => Number(row.team_id)))]
  const teamMembers = identifiersByTeamId(teamIds)

  return rows.map((row) => {
    const members = new Map()
    for (const identifier of direct.get(Number(row.id)) ?? []) {
      members.set(identifier.toLowerCase(), identifier)
    }
    if (row.team_id != null) {
      const owner = String(row.owner).toLowerCase()
      for (const identifier of teamMembers.get(Number(row.team_id)) ?? []) {
        if (identifier.toLowerCase() !== owner) {
          members.set(identifier.toLowerCase(), identifier)
        }
      }
    }
    const list = [...members.values()].sort((a, b) => a.localeCompare(b))
    return taskToJson(row, list)
  })
}

function serializeTask(id) {
  const row = db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id)
  return serializeRows([row])[0]
}

function findVisibleTask(id, userId) {
  return db.prepare(`${TASK_SELECT} WHERE t.id = ? AND ${VISIBLE_WHERE}`).get(id, userId, userId, userId)
}

function findAccessibleTeam(teamId, userId) {
  if (!Number.isInteger(teamId) || teamId < 1) return null
  return db
    .prepare(
      `SELECT t.id, t.name FROM teams t
       WHERE t.id = ? AND (
         t.created_by = ? OR EXISTS (
           SELECT 1 FROM team_members mem WHERE mem.team_id = t.id AND mem.user_id = ?
         )
       )`,
    )
    .get(teamId, userId, userId)
}

function replaceMembers(taskId, members) {
  const now = Date.now()
  const insert = db.prepare(
    'INSERT OR IGNORE INTO task_members (task_id, user_id, added_at) VALUES (?, ?, ?)',
  )

  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM task_members WHERE task_id = ?').run(taskId)
    for (const member of members) insert.run(taskId, member.id, now)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/* GET /api/tasks — personal tasks plus team tasks visible to the user */
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `${TASK_SELECT} WHERE ${VISIBLE_WHERE} ORDER BY t.completed, t.due_date, t.created_at`,
    )
    .all(req.user.id, req.user.id, req.user.id)
  res.json(serializeRows(rows))
})

/* POST /api/tasks — create a personal task, a team task, or a directly shared task */
router.post('/', (req, res) => {
  const {
    title,
    dueDate,
    type = 'personal',
    members: memberInput = [],
    teamId: teamIdInput = null,
  } = req.body ?? {}

  if (typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
    res.status(400).json({ error: 'Task name is required (max 200 characters).' })
    return
  }
  if (
    typeof dueDate !== 'string' ||
    !DATE_PATTERN.test(dueDate) ||
    Number.isNaN(new Date(dueDate).getTime())
  ) {
    res.status(400).json({ error: 'A valid due date is required.' })
    return
  }
  if (!TASK_TYPES.has(type)) {
    res.status(400).json({ error: 'Task type must be "personal" or "team".' })
    return
  }

  let teamId = null
  let members = []

  if (type === 'team') {
    const wantsTeam = teamIdInput !== null && teamIdInput !== undefined
    const hasPeople =
      Array.isArray(memberInput) &&
      memberInput.some((value) => typeof value === 'string' && value.trim())

    if (wantsTeam && hasPeople) {
      res.status(400).json({ error: 'Share the task with a team or individual people, not both.' })
      return
    }

    if (wantsTeam) {
      const team = findAccessibleTeam(Number(teamIdInput), req.user.id)
      if (!team) {
        res.status(400).json({ error: 'Team not found or you are not a member of it.' })
        return
      }
      teamId = Number(team.id)
    } else {
      const resolved = resolveMembers(memberInput, [req.user.id])
      if (resolved.error) {
        res.status(400).json({ error: resolved.error })
        return
      }
      members = resolved.members
    }
  }

  let taskId
  db.exec('BEGIN')
  try {
    const result = db
      .prepare(
        `INSERT INTO tasks (user_id, title, due_date, completed, created_at, type, team_id)
         VALUES (?, ?, ?, 0, ?, ?, ?)`,
      )
      .run(req.user.id, title.trim(), dueDate, Date.now(), type, teamId)
    taskId = Number(result.lastInsertRowid)

    const insertMember = db.prepare(
      'INSERT OR IGNORE INTO task_members (task_id, user_id, added_at) VALUES (?, ?, ?)',
    )
    for (const member of members) insertMember.run(taskId, member.id, Date.now())
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  res.status(201).json(serializeTask(taskId))
})

/* PATCH /api/tasks/:id — complete a task, or change sharing (team or people) */
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid task id.' })
    return
  }

  const row = findVisibleTask(id, req.user.id)
  if (!row) {
    res.status(404).json({ error: 'Task not found.' })
    return
  }

  const body = req.body ?? {}
  const { completed } = body
  const hasMembers = Object.hasOwn(body, 'members')
  const hasTeamId = Object.hasOwn(body, 'teamId')

  if (completed === undefined && !hasMembers && !hasTeamId) {
    res.status(400).json({ error: 'Nothing to update.' })
    return
  }
  if (hasMembers && hasTeamId) {
    res.status(400).json({ error: 'Update either the team or the people, not both.' })
    return
  }

  if (completed !== undefined) {
    if (typeof completed !== 'boolean') {
      res.status(400).json({ error: '"completed" must be true or false.' })
      return
    }
    // Keep the original completion time when re-completing an already-completed task.
    const completedAt = completed ? (row.completed_at ?? Date.now()) : null
    const completedBy = completed ? (row.completed_by ?? req.user.id) : null
    db.prepare(
      'UPDATE tasks SET completed = ?, completed_at = ?, completed_by = ? WHERE id = ?',
    ).run(completed ? 1 : 0, completedAt, completedBy, id)
  }

  if (hasMembers) {
    if (row.type !== 'team') {
      res.status(400).json({ error: 'Only team tasks can be shared.' })
      return
    }
    const resolved = resolveMembers(body.members, [row.user_id])
    if (resolved.error) {
      res.status(400).json({ error: resolved.error })
      return
    }
    replaceMembers(id, resolved.members)
    // Direct sharing and team sharing are mutually exclusive.
    db.prepare('UPDATE tasks SET team_id = NULL WHERE id = ?').run(id)
  }

  if (hasTeamId) {
    if (row.type !== 'team') {
      res.status(400).json({ error: 'Only team tasks can be shared.' })
      return
    }
    if (body.teamId === null) {
      db.prepare('UPDATE tasks SET team_id = NULL WHERE id = ?').run(id)
    } else {
      const team = findAccessibleTeam(Number(body.teamId), req.user.id)
      if (!team) {
        res.status(400).json({ error: 'Team not found or you are not a member of it.' })
        return
      }
      db.prepare('UPDATE tasks SET team_id = ? WHERE id = ?').run(Number(team.id), id)
      db.prepare('DELETE FROM task_members WHERE task_id = ?').run(id)
    }
  }

  // Re-read without the visibility filter: a member may have just removed themselves.
  res.json(serializeTask(id))
})

/* DELETE /api/tasks/history — remove the user's own completed tasks */
router.delete('/history', (req, res) => {
  const result = db
    .prepare('DELETE FROM tasks WHERE user_id = ? AND completed = 1')
    .run(req.user.id)
  res.json({ deleted: Number(result.changes) })
})

/* DELETE /api/tasks/:id — any member of a task may delete it */
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid task id.' })
    return
  }

  const result = db
    .prepare(
      `DELETE FROM tasks WHERE id = ? AND (
         user_id = ? OR EXISTS (
           SELECT 1 FROM task_members tm WHERE tm.task_id = tasks.id AND tm.user_id = ?
         ) OR (team_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM team_members tmem WHERE tmem.team_id = tasks.team_id AND tmem.user_id = ?
         ))
       )`,
    )
    .run(id, req.user.id, req.user.id, req.user.id)
  if (result.changes === 0) {
    res.status(404).json({ error: 'Task not found.' })
    return
  }
  res.json({ ok: true })
})

export default router
