import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'todo-app-theme'
const listeners = new Set()

function storedTheme() {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : null
}

function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

let current = storedTheme() ?? systemTheme()

function apply(theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme
  }
}

// Apply before React renders so the first paint already uses the right theme.
apply(current)

// Follow the OS when the user has not chosen a theme explicitly.
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    if (storedTheme()) return
    current = event.matches ? 'dark' : 'light'
    apply(current)
    listeners.forEach((listener) => listener())
  })
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return current
}

function setTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return
  current = theme
  apply(theme)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, theme)
  }
  listeners.forEach((listener) => listener())
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot)
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  return { theme, setTheme, toggleTheme }
}

export default useTheme
