import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

/**
 * Task CRUD against the backend. Every task belongs to the signed-in user;
 * the list is refetched after each change to stay in sync with the server.
 */
function useTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api('/api/tasks')
      setTasks(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const mutate = async (path, init) => {
    try {
      await api(path, init)
      await refresh()
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const addTask = ({ title, dueDate, type = 'personal', members = [], teamId = null }) =>
    mutate('/api/tasks', { method: 'POST', body: { title, dueDate, type, members, teamId } })

  const updateTaskSharing = (id, payload) =>
    mutate(`/api/tasks/${id}`, { method: 'PATCH', body: payload })

  // Return whether the request succeeded so callers can offer an undo only
  // after a task was really moved to history.
  const completeTask = (id) =>
    mutate(`/api/tasks/${id}`, { method: 'PATCH', body: { completed: true } })
      .then(() => true)
      .catch(() => false)

  const restoreTask = (id) =>
    mutate(`/api/tasks/${id}`, { method: 'PATCH', body: { completed: false } })
      .then(() => true)
      .catch(() => false)

  const deleteTask = (id) => mutate(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => {})

  const clearHistory = () => mutate('/api/tasks/history', { method: 'DELETE' }).catch(() => {})

  const dismissError = () => setError(null)

  return {
    tasks,
    loading,
    error,
    refresh,
    dismissError,
    addTask,
    updateTaskSharing,
    completeTask,
    restoreTask,
    deleteTask,
    clearHistory,
  }
}

export default useTasks
