import { useState } from 'react'
import MemberPicker from './MemberPicker'

const EMPTY_FORM = { title: '', dueDate: '' }

function TaskForm({ onAdd, owner, type, teams = [], onManageTeams }) {
  const isTeam = type === 'team'
  const [form, setForm] = useState(EMPTY_FORM)
  const [mode, setMode] = useState(null)
  const [teamId, setTeamId] = useState(null)
  const [members, setMembers] = useState([])
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  // `null` means "auto": use a team when the user is in one.
  const activeMode = mode ?? (teams.length > 0 ? 'team' : 'people')
  const defaultTeamId = teams[0] ? String(teams[0].id) : ''
  const activeTeamId = teamId ?? defaultTeamId

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nextErrors = {}
    if (!form.title.trim()) nextErrors.title = 'Task name is required.'
    if (!form.dueDate) nextErrors.dueDate = 'Due date is required.'
    if (isTeam && activeMode === 'team' && !activeTeamId) {
      nextErrors.share = 'Choose a team, or share with individuals.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setBusy(true)
    try {
      await onAdd({
        ...form,
        type,
        teamId: isTeam && activeMode === 'team' ? Number(activeTeamId) : null,
        members: isTeam && activeMode === 'people' ? members : [],
      })
      setForm(EMPTY_FORM)
      setMembers([])
      setErrors({})
    } catch {
      // The error banner above the form shows what went wrong.
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>
      <p className="form-note">
        {isTeam
          ? 'Team task — visible to you and the people you share it with.'
          : 'Personal task — only you can see it.'}
      </p>

      <label className="field">
        <span className="field-label">Task</span>
        <input
          type="text"
          className={errors.title ? 'invalid' : undefined}
          value={form.title}
          onChange={handleChange('title')}
          placeholder="What needs to be done?"
        />
        {errors.title && <span className="field-error">{errors.title}</span>}
      </label>

      <div className="form-row-split">
        <label className="field">
          <span className="field-label">Due date</span>
          <input
            type="date"
            className={errors.dueDate ? 'invalid' : undefined}
            value={form.dueDate}
            onChange={handleChange('dueDate')}
          />
          {errors.dueDate && <span className="field-error">{errors.dueDate}</span>}
        </label>

        <div className="field">
          <span className="field-label">Owner</span>
          <p className="field-static" title={owner}>
            {owner}
          </p>
        </div>
      </div>

      {isTeam && (
        <div className="field">
          <div className="field-label-row">
            <span className="field-label">Share with</span>
            {onManageTeams && (
              <button type="button" className="btn-link" onClick={onManageTeams}>
                Manage teams
              </button>
            )}
          </div>

          <div className="segmented" role="group" aria-label="Share with">
            <button
              type="button"
              className={activeMode === 'team' ? 'active' : ''}
              onClick={() => setMode('team')}
            >
              A team
            </button>
            <button
              type="button"
              className={activeMode === 'people' ? 'active' : ''}
              onClick={() => setMode('people')}
            >
              Individuals
            </button>
          </div>

          {activeMode === 'team' ? (
            teams.length > 0 ? (
              <select
                aria-label="Team"
                value={activeTeamId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                {teams.map((team) => {
                  const count = (team.members ?? []).length
                  return (
                    <option key={team.id} value={team.id}>
                      {team.name} · {count} member{count === 1 ? '' : 's'}
                    </option>
                  )
                })}
              </select>
            ) : (
              <span className="field-hint">
                You are not in any teams yet. Use{' '}
                <button type="button" className="btn-link" onClick={onManageTeams}>
                  Manage teams
                </button>{' '}
                to create one.
              </span>
            )
          ) : (
            <MemberPicker
              value={members}
              onChange={setMembers}
              exclude={[owner]}
              placeholder="Add teammates by email or username"
            />
          )}

          {errors.share && <span className="field-error">{errors.share}</span>}
          {activeMode === 'people' && members.length === 0 && (
            <span className="field-hint">
              Add teammates now, or create the task and share it later.
            </span>
          )}
        </div>
      )}

      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? 'Adding…' : 'Add task'}
      </button>
    </form>
  )
}

export default TaskForm
