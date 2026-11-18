/**
 * A task is overdue when its (uncompleted) due date has fully passed.
 */
export function isOverdue(task) {
  if (!task.dueDate || task.completed) return false
  const endOfDueDay = new Date(`${task.dueDate}T23:59:59.999`)
  return endOfDueDay < new Date()
}

export function formatDueDate(dueDate) {
  return new Date(`${dueDate}T00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatCompletedAt(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
