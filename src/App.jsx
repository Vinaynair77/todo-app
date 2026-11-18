import { AuthProvider, useAuth } from './auth/AuthContext'
import AuthPage from './components/AuthPage'
import TodoApp from './components/TodoApp'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  )
}

function AppRoot() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app">
        <p className="loading">Loading…</p>
      </div>
    )
  }

  return user ? <TodoApp user={user} /> : <AuthPage />
}

export default App
