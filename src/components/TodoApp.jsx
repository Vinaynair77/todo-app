import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import useTasks from '../hooks/useTasks'
import useTeams from '../hooks/useTeams'
import TaskForm from './TaskForm'
import TaskList from './TaskList'
import History from './History'
import ShareTaskDialog from './ShareTaskDialog'
import TeamsDialog from './TeamsDialog'
import ThemeToggle from './ThemeToggle'

const UNDO_TIMEOUT_MS = 7000

function TodoApp({ user }) {
  const { logout } = useAuth()
  const {
    tasks,
    loading,
    error,
    refresh: refreshTasks,
    dismissError,
    addTask,
    updateTaskSharing,
    completeTask,
    restoreTask,
    deleteTask,
    clearHistory,
  } = useTasks()
  const { teams, createTeam, updateTeam, deleteTeam } = useTeams()

  // The toggle only changes what kind of task the form creates; the lists
  // below always show personal and team tasks together.
  const [formType, setFormType] = useState('personal')
  const [sharingTask, setSharingTask] = useState(null)
  const [teamsOpen, setTeamsOpen] = useState(false)
  const [undoEntries, setUndoEntries] = useState([])
  const undoTimers = useRef(new Map())
  const undoKey = useRef(0)

  const activeTasks = useMemo(
    () =>
      tasks
        .filter((task) => !task.completed)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate) || a.createdAt - b.createdAt),
    [tasks],
  )

  const historyTasks = useMemo(
    () => tasks.filter((task) => task.completed).sort((a, b) => b.completedAt - a.completedAt),
    [tasks],
  )

  // Team changes can affect task visibility and labels, so refetch both.
  const handleCreateTeam = async (payload) => {
    const team = await createTeam(payload)
    await refreshTasks()
    return team
  }
  const handleUpdateTeam = async (id, changes) => {
    const team = await updateTeam(id, changes)
    await refreshTasks()
    return team
  }
  const handleDeleteTeam = async (id) => {
    await deleteTeam(id)
    await refreshTasks()
  }

  const dismissUndo = useCallback((key) => {
    const timer = undoTimers.current.get(key)
    if (timer) {
      window.clearTimeout(timer)
      undoTimers.current.delete(key)
    }
    setUndoEntries((entries) => entries.filter((entry) => entry.key !== key))
  }, [])

  // Cancel pending auto-dismiss timers when the app unmounts (e.g. sign out).
  useEffect(() => {
    const timers = undoTimers.current
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const handleComplete = async (id) => {
    const task = tasks.find((item) => item.id === id)
    const completed = await completeTask(id)
    if (!completed || !task) return

    undoKey.current += 1
    const key = undoKey.current
    setUndoEntries((entries) => [...entries, { key, id, title: task.title }])
    const timer = window.setTimeout(() => dismissUndo(key), UNDO_TIMEOUT_MS)
    undoTimers.current.set(key, timer)
  }

  const handleUndo = async (entry) => {
    const restored = await restoreTask(entry.id)
    // Keep the toast visible if restoration failed so the user can retry.
    if (restored) dismissUndo(entry.key)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-row">
          <h1>To-Do</h1>
          <div className="user-menu">
            <ThemeToggle />
            <span className="task-owner" title={user.identifier}>
              {user.identifier}
            </span>
            <button type="button" className="btn-ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
        <p className="app-subtitle">
          {activeTasks.length} open · {historyTasks.length} completed
        </p>
      </header>

      <main>
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" className="btn-icon" aria-label="Dismiss error" onClick={dismissError}>
              ×
            </button>
          </div>
        )}

        <div className="task-toolbar">
          <span className="toolbar-label">New task</span>
          <div className="segmented segmented-lg" role="group" aria-label="Task type">
            <button
              type="button"
              className={formType === 'personal' ? 'active' : ''}
              onClick={() => setFormType('personal')}
            >
              Personal
            </button>
            <button
              type="button"
              className={formType === 'team' ? 'active' : ''}
              onClick={() => setFormType('team')}
            >
              Team
            </button>
          </div>
          <button type="button" className="btn-ghost" onClick={() => setTeamsOpen(true)}>
            Manage teams
          </button>
        </div>

        <TaskForm
          onAdd={addTask}
          owner={user.identifier}
          type={formType}
          teams={teams}
          onManageTeams={() => setTeamsOpen(true)}
        />

        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">
              Tasks <span className="count-badge">{activeTasks.length}</span>
            </h2>
          </div>
          {loading ? (
            <p className="loading">Loading your tasks…</p>
          ) : (
            <TaskList
              tasks={activeTasks}
              onComplete={handleComplete}
              onDelete={deleteTask}
              onShare={setSharingTask}
            />
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">
              History <span className="count-badge">{historyTasks.length}</span>
            </h2>
            {historyTasks.length > 0 && (
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  if (window.confirm('Clear all completed tasks you created from the history?')) {
                    clearHistory()
                  }
                }}
              >
                Clear history
              </button>
            )}
          </div>
          {loading ? (
            <p className="loading">Loading your tasks…</p>
          ) : (
            <History
              tasks={historyTasks}
              onRestore={restoreTask}
              onDelete={deleteTask}
              onShare={setSharingTask}
            />
          )}
        </section>
      </main>

      {sharingTask && (
        <ShareTaskDialog
          task={sharingTask}
          currentUser={user}
          teams={teams}
          onClose={() => setSharingTask(null)}
          onSave={updateTaskSharing}
          onManageTeams={() => {
            setSharingTask(null)
            setTeamsOpen(true)
          }}
        />
      )}

      {teamsOpen && (
        <TeamsDialog
          teams={teams}
          currentUser={user}
          onClose={() => setTeamsOpen(false)}
          onCreate={handleCreateTeam}
          onUpdate={handleUpdateTeam}
          onDelete={handleDeleteTeam}
        />
      )}

      <div className="undo-stack" role="region" aria-label="Recent completions">
        {undoEntries.map((entry) => (
          <div
            className="undo-toast"
            key={entry.key}
            role="status"
            style={{ '--undo-duration': `${UNDO_TIMEOUT_MS}ms` }}
          >
            <span className="undo-message">
              Completed <strong>{entry.title}</strong>
            </span>
            <button type="button" className="undo-action" onClick={() => handleUndo(entry)}>
              Undo
            </button>
            <button
              type="button"
              className="undo-close"
              aria-label={`Dismiss undo for ${entry.title}`}
              onClick={() => dismissUndo(entry.key)}
            >
              ×
            </button>
            <span className="undo-progress" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default TodoApp
