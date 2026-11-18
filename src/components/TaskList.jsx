import TaskItem from './TaskItem'

function TaskList({ tasks, onComplete, onDelete, onShare }) {
  if (tasks.length === 0) {
    return <p className="empty">No open tasks. Add one above to get started.</p>
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onComplete={onComplete}
          onDelete={onDelete}
          onShare={onShare}
        />
      ))}
    </ul>
  )
}

export default TaskList
