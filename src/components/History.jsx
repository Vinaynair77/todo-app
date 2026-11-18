import TaskItem from './TaskItem'

function History({ tasks, onRestore, onDelete, onShare }) {
  if (tasks.length === 0) {
    return (
      <p className="empty">Nothing here yet. Tasks you complete will show up in your history.</p>
    )
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onRestore={onRestore}
          onDelete={onDelete}
          onShare={onShare}
        />
      ))}
    </ul>
  )
}

export default History
