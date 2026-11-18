import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

/**
 * Named teams the signed-in user belongs to. Any member can rename a team or
 * change its members; the list is refetched after each change.
 */
function useTeams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setTeams(await api('/api/teams'))
    } catch {
      // Team actions surface their own errors; keep the last known list.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api('/api/teams')
      .then((data) => {
        if (!cancelled) setTeams(data)
      })
      .catch(() => {
        // Team actions surface their own errors; keep the last known list.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const createTeam = async ({ name, members = [] }) => {
    const team = await api('/api/teams', { method: 'POST', body: { name, members } })
    await refresh()
    return team
  }

  const updateTeam = async (id, changes) => {
    const body = {}
    if (changes.name !== undefined) body.name = changes.name
    if (changes.members !== undefined) body.members = changes.members
    const team = await api(`/api/teams/${id}`, { method: 'PATCH', body })
    await refresh()
    return team
  }

  const deleteTeam = async (id) => {
    await api(`/api/teams/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return { teams, loading, refresh, createTeam, updateTeam, deleteTeam }
}

export default useTeams
