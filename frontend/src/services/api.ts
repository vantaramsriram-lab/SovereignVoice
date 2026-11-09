import type { AnalysisResponse, HealthResponse } from '../types'

/**
 * All backend communication lives here.
 *
 * The browser only ever talks to our own FastAPI server. Provider credentials
 * (the shared Gnani API_KEY_ID and the Groq API key) stay on the server
 * and are never sent to, or stored in, the frontend.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  service?: string
  detail?: string
  missing?: string[]
  kind: 'not_configured' | 'integration_error' | 'validation' | 'network' | 'unknown'

  constructor(message: string, options: {
    status?: number
    service?: string
    detail?: string
    missing?: string[]
    kind?: ApiError['kind']
  } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.service = options.service
    this.detail = options.detail
    this.missing = options.missing
    this.kind = options.kind ?? 'unknown'
  }
}

function friendlyNetworkError(error: unknown): ApiError {
  return new ApiError(
    'Could not reach the SovereignVoice backend. Confirm that the FastAPI server is running and that /api is proxied to it.',
    { kind: 'network', detail: error instanceof Error ? error.message : String(error) },
  )
}

async function parseError(response: Response): Promise<ApiError> {
  let body: Record<string, unknown> | null = null
  try {
    body = (await response.json()) as Record<string, unknown>
  } catch {
    /* non-JSON error body */
  }

  if (body && typeof body.error === 'string') {
    const kind =
      body.error === 'not_configured'
        ? 'not_configured'
        : body.error === 'llm_output_invalid'
          ? 'validation'
          : 'integration_error'
    return new ApiError(String(body.message ?? 'The request failed.'), {
      status: response.status,
      service: typeof body.service === 'string' ? body.service : undefined,
      detail: typeof body.detail === 'string' ? body.detail : undefined,
      missing: Array.isArray(body.missing) ? (body.missing as string[]) : undefined,
      kind,
    })
  }

  const detail = body && typeof body.detail === 'string' ? body.detail : null
  return new ApiError(
    detail ?? `The backend returned HTTP ${response.status}.`,
    { status: response.status, kind: response.status === 422 ? 'validation' : 'unknown' },
  )
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/health`, { signal })
  } catch (error) {
    throw friendlyNetworkError(error)
  }
  if (!response.ok) throw await parseError(response)
  return (await response.json()) as HealthResponse
}

export async function analyzeAudio(
  file: Blob,
  filename: string,
  agentContext: string,
  signal?: AbortSignal,
): Promise<AnalysisResponse> {
  const form = new FormData()
  form.append('audio_file', file, filename)
  if (agentContext.trim()) form.append('agent_context', agentContext.trim())

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      body: form,
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw friendlyNetworkError(error)
  }

  if (!response.ok) throw await parseError(response)
  return (await response.json()) as AnalysisResponse
}

export function audioUrlFromBase64(base64: string, mimeType: string): string {
  return `data:${mimeType || 'audio/wav'};base64,${base64}`
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the audio file.'))
    reader.readAsDataURL(blob)
  })
}

export function probeAudioDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const audio = document.createElement('audio')
    let settled = false
    const finish = (value: number | null) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      resolve(value)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const value = Number.isFinite(audio.duration) ? audio.duration : null
      finish(value)
    }
    audio.onerror = () => finish(null)
    window.setTimeout(() => finish(null), 4000)
    audio.src = url
  })
}
