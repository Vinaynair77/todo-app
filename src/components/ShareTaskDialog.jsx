import { useEffect, useState } from 'react'
import MemberPicker from './MemberPicker'

function ShareTaskDialog({ task, currentUser, teams = [], onClose, onSave, onManageTeams }) {
  const [mode, setMode] = useState(task.team ? 'team' : 'people')
  const [teamId, setTeamId] = useState(
    task.team ? String(task.team.id) : teams[0] ? String(teams[0].id) : '',
  )
  const [members, setMembers] = useState(
    (task.members ?? []).filter(
      (identifier) => identifier.toLowerCase() !== task.owner.toLowerCase(),
    ),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const selectedTeam = teams.find((team) => String(team.id) === teamId) ?? null

  const handleSave = async () => {
    if (mode === 'team' && !teamId) {
      setError('Choose a team, or share with individual people.')
      return
    }

    setBusy(true)
    setError('')
    try {
      await onSave(task.id, mode === 'team' ? { teamId: Number(teamId) } : { members })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="share-dialog-title" className="modal-title">
          Share “{task.title}”
        </h2>
        <p className="modal-subtitle">
          {mode === 'team'
            ? 'Everyone in the team can see, complete, and delete this task.'
            : 'Everyone listed here can see, complete, and delete this task.'}
        </p>

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
              className={mode === 'team' ? 'active' : ''}
              onClick={() => setMode('team')}
            >
              A team
            </button>
            <button
              type="button"
              className={mode === 'people' ? 'active' : ''}
              onClick={() => setMode('people')}
            >
              Individuals
            </button>
          </div>

          {mode === 'team' ? (
            teams.length > 0 ? (
              <>
                <select
                  aria-label="Team"
                  value={teamId}
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
                {selectedTeam && (
                  <span className="field-hint">
                    Changing a team&apos;s members updates every task shared with it.
                  </span>
                )}
              </>
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
              exclude={[task.owner, currentUser.identifier]}
              placeholder="Add a teammate by email or username"
            />
          )}
        </div>

        {error && <p className="field-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save sharing'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShareTaskDialog
