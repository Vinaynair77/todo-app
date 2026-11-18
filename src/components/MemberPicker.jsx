import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

/**
 * Chips + search box for picking account identifiers (emails/usernames).
 * Suggestions come from /api/users/search; a typed identifier can also be
 * added directly and is validated by the server when the task is saved.
 */
function MemberPicker({ value, onChange, exclude = [], placeholder }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const boxRef = useRef(null)

  const excluded = new Set(
    [...exclude, ...value].map((identifier) => identifier.trim().toLowerCase()),
  )

  useEffect(() => {
    const term = query.trim()
    if (!term) return undefined

    let cancelled = false
    const timer = setTimeout(() => {
      setSearching(true)
      api(`/api/users/search?q=${encodeURIComponent(term)}`)
        .then((list) => {
          if (!cancelled) setSuggestions(list)
        })
        .catch(() => {
          if (!cancelled) setSuggestions([])
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    const onDocumentMouseDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentMouseDown)
    return () => document.removeEventListener('mousedown', onDocumentMouseDown)
  }, [])

  const add = (identifier) => {
    const trimmed = identifier.trim()
    if (!trimmed || excluded.has(trimmed.toLowerCase())) return
    onChange([...value, trimmed])
    setQuery('')
    setSuggestions([])
    setOpen(false)
  }

  const remove = (identifier) => onChange(value.filter((item) => item !== identifier))

  const visibleSuggestions = suggestions.filter(
    (suggestion) => !excluded.has(suggestion.identifier.toLowerCase()),
  )

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      const term = query.trim()
      if (!term) return
      const exact = visibleSuggestions.find(
        (suggestion) => suggestion.identifier.toLowerCase() === term.toLowerCase(),
      )
      add(exact?.identifier ?? term)
    } else if (event.key === 'Backspace' && !query && value.length > 0) {
      remove(value[value.length - 1])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="member-picker" ref={boxRef}>
      {value.length > 0 && (
        <ul className="member-chips">
          {value.map((identifier) => (
            <li key={identifier} className="member-chip">
              <span title={identifier}>{identifier}</span>
              <button
                type="button"
                aria-label={`Remove ${identifier}`}
                onClick={() => remove(identifier)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="text"
        value={query}
        placeholder={placeholder ?? 'Search by email or username'}
        autoComplete="off"
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)
          if (!next.trim()) setSuggestions([])
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {open && query.trim().length > 0 && (
        <div className="member-suggestions">
          {searching && <p className="suggestion-empty">Searching…</p>}
          {!searching && visibleSuggestions.length === 0 && (
            <p className="suggestion-empty">
              No matching accounts. Type a full email/username and press Enter.
            </p>
          )}
          {visibleSuggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion.id}
              className="suggestion"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(suggestion.identifier)}
            >
              {suggestion.identifier}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default MemberPicker
