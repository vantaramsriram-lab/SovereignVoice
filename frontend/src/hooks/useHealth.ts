import { useCallback, useEffect, useState } from 'react'
import { ApiError, getHealth } from '../services/api'
import type { HealthResponse } from '../types'

/**
 * Reads the backend's credential-free integration status.
 * Used only to show an honest "not configured" banner — never to gate the UI
 * behind fake readiness.
 */
export function useHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const data = await getHealth(signal)
      setHealth(data)
      setError(null)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setHealth(null)
      setError(err instanceof ApiError ? err.message : 'Backend unreachable.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const missingIntegrations = health
    ? Object.entries(health.integrations)
        .filter(([, ready]) => !ready)
        .map(([name]) => name)
    : []

  return { health, error, loading, reload: load, missingIntegrations }
}
