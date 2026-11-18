import { formatDueDate, formatCompletedAt, isOverdue } from '../utils/date'

function sharingLabel(task) {
  const members = task.members ?? []
  if (task.team) {
    const count = members.length
    return `${task.team.name} · ${count} member${count === 1 ? '' : 's'}`
  }
  if (members.length === 0) return 'not shared yet'
  if (members.length === 1) return 'shared with 1 person'
  return `shared with ${members.length} people`
}

function TaskItem({ task, onComplete, onRestore, onDelete, onShare }) {
  const isTeam = task.type === 'team'
  const memberList = task.members ?? []

  if (task.completed) {
    return (
      <li className="task task-history">
        <div className="task-body">
          <span className="task-title">
            <span className={`task-type-badge${isTeam ? '' : ' personal'}`}>
              {isTeam ? 'Team' : 'Personal'}
            </span>
            {task.title}
          </span>
          <span className="task-meta">
            {task.owner && (
              <span className="task-owner" title={task.owner}>
                {task.owner}
              </span>
            )}
            {isTeam && (
              <span className="task-sharing" title={memberList.join(', ')}>
                {sharingLabel(task)}
              </span>
            )}
            {task.dueDate && <span className="due">was due {formatDueDate(task.dueDate)}</span>}
            <span>
              completed
              {isTeam && task.completedBy && task.completedBy !== task.owner
                ? ` by ${task.completedBy}`
                : ''}{' '}
              {formatCompletedAt(task.completedAt)}
            </span>
          </span>
        </div>
        <div className="task-actions">
          {isTeam && (
            <button type="button" className="btn-ghost" onClick={() => onShare(task)}>
              Share
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => onRestore(task.id)}>
            Restore
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-label={`Delete ${task.title}`}
            onClick={() => onDelete(task.id)}
          >
            ×
          </button>
        </div>
      </li>
    )
  }

  const overdue = isOverdue(task)

  return (
    <li className={`task${overdue ? ' task-overdue' : ''}`}>
      <input
        type="checkbox"
        className="task-checkbox"
        aria-label={`Mark ${task.title} as complete`}
        checked={false}
        onChange={() => onComplete(task.id)}
      />
      <div className="task-body">
        <span className="task-title">
          <span className={`task-type-badge${isTeam ? '' : ' personal'}`}>
            {isTeam ? 'Team' : 'Personal'}
          </span>
          {task.title}
        </span>
        <span className="task-meta">
          {task.owner && (
            <span className="task-owner" title={task.owner}>
              {task.owner}
            </span>
          )}
          {isTeam && (
            <span className="task-sharing" title={memberList.join(', ')}>
              {sharingLabel(task)}
            </span>
          )}
          {task.dueDate && (
            <span className={overdue ? 'due overdue-text' : 'due'}>
              due {formatDueDate(task.dueDate)}
              {overdue ? ' · overdue' : ''}
            </span>
          )}
        </span>
      </div>
      {isTeam && (
        <button type="button" className="btn-ghost" onClick={() => onShare(task)}>
          Share
        </button>
      )}
      <button
        type="button"
        className="btn-icon"
        aria-label={`Delete ${task.title}`}
        onClick={() => onDelete(task.id)}
      >
        ×
      </button>
    </li>
  )
}

export default TaskItem
