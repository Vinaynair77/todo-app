import { useEffect, useState } from 'react'
import MemberPicker from './MemberPicker'

function TeamCard({ team, currentUser, onUpdate, onDelete }) {
  const [name, setName] = useState(team.name)
  const [members, setMembers] = useState(team.members ?? [])
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  const dirty =
    name.trim() !== team.name ||
    JSON.stringify([...members].sort()) !== JSON.stringify([...(team.members ?? [])].sort())

  const save = async () => {
    if (!name.trim()) {
      setError('Team name is required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onUpdate(team.id, { name: name.trim(), members })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      await onDelete(team.id)
    } catch (err) {
      setError(err.message)
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div className="team-card">
      <div className="team-card-head">
        <input
          type="text"
          className="team-name-input"
          aria-label="Team name"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="button"
          className="btn-ghost danger-text"
          onClick={() => setConfirming(true)}
          disabled={busy}
        >
          Delete
        </button>
      </div>

      <p className="team-meta">Created by {team.createdBy}</p>

      {confirming && (
        <div className="team-confirm">
          <span>Delete this team? Its tasks stay shared with its current members.</span>
          <span className="team-confirm-actions">
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button type="button" className="btn-danger" onClick={remove} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete team'}
            </button>
          </span>
        </div>
      )}

      <div className="field">
        <span className="field-label">Members</span>
        <MemberPicker
          value={members}
          onChange={setMembers}
          exclude={[currentUser.identifier, team.createdBy]}
          placeholder="Add a member by email or username"
        />
      </div>

      {error && <p className="field-error">{error}</p>}

      <div className="team-card-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={save}
          disabled={busy || !dirty || confirming}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

function TeamsDialog({ teams, currentUser, onClose, onCreate, onUpdate, onDelete }) {
  const [name, setName] = useState('')
  const [members, setMembers] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const create = async (event) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Team name is required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onCreate({ name: name.trim(), members })
      setName('')
      setMembers([])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teams-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="teams-dialog-title" className="modal-title">
          Teams
        </h2>
        <p className="modal-subtitle">
          Create a team once, then share any number of tasks with it. Any member can rename a
          team or change its members.
        </p>

        <form className="team-create" onSubmit={create}>
          <div className="field">
            <label className="field-label" htmlFor="new-team-name">
              New team name
            </label>
            <input
              id="new-team-name"
              type="text"
              value={name}
              maxLength={80}
              placeholder="e.g. Marketing"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="field">
            <span className="field-label">Members</span>
            <MemberPicker
              value={members}
              onChange={setMembers}
              exclude={[currentUser.identifier]}
              placeholder="Add members by email or username"
            />
          </div>

          {error && <p className="field-error">{error}</p>}

          <div>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create team'}
            </button>
          </div>
        </form>

        <div className="team-list">
          {teams.length === 0 ? (
            <p className="empty">No teams yet. Create one above to start sharing tasks.</p>
          ) : (
            teams.map((team) => (
              <TeamCard
                key={`${team.id}:${team.name}:${(team.members ?? []).join(',')}`}
                team={team}
                currentUser={currentUser}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default TeamsDialog
