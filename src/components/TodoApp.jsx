import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import useTasks from '../hooks/useTasks'
import useTeams from '../hooks/useTeams'
import TaskForm from './TaskForm'
import TaskList from './TaskList'
import History from './History'
import ShareTaskDialog from './ShareTaskDialog'
import TeamsDialog from './TeamsDialog'
import ThemeToggle from './ThemeToggle'

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
    deleteTask,
    clearHistory,
  } = useTasks()
  const { teams, createTeam, updateTeam, deleteTeam } = useTeams()

  // The toggle only changes what kind of task the form creates; the lists
  // below always show personal and team tasks together.
  const [formType, setFormType] = useState('personal')
  const [sharingTask, setSharingTask] = useState(null)
  const [teamsOpen, setTeamsOpen] = useState(false)

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
              onComplete={completeTask}
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
    </div>
  )
}

export default TodoApp
