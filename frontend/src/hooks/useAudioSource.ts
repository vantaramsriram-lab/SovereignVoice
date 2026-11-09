import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { blobToDataUrl, probeAudioDuration } from '../services/api'

export interface AudioSource {
  blob: Blob
  filename: string
  mimeType: string
  sizeBytes: number
  durationSeconds: number | null
  origin: 'upload' | 'recording'
}

const ACCEPTED_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.ogg', '.webm', '.flac']
const ACCEPTED_MIME = [
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/x-flac',
]

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/**
 * Owns the currently selected customer audio (upload *or* recording) and
 * exposes a stable object URL for playback.
 */
export function useAudioSource() {
  const [source, setSource] = useState<AudioSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const objectUrl = useMemo(
    () => (source ? URL.createObjectURL(source.blob) : null),
    [source],
  )

  // Release the previous object URL whenever the source changes, so previews of
  // replaced recordings don't leak blob handles.
  const previousUrl = useRef<string | null>(null)
  useEffect(() => {
    if (previousUrl.current && previousUrl.current !== objectUrl) {
      URL.revokeObjectURL(previousUrl.current)
    }
    previousUrl.current = objectUrl
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      previousUrl.current = null
    }
  }, [objectUrl])

  const acceptFile = useCallback(async (file: File) => {
    setError(null)
    const extension = `.${(file.name.split('.').pop() ?? '').toLowerCase()}`
    const typeOk =
      ACCEPTED_MIME.includes(file.type.toLowerCase()) ||
      ACCEPTED_EXTENSIONS.includes(extension)

    if (!typeOk) {
      setError(
        `"${file.name}" is not a supported audio file. Use ${ACCEPTED_EXTENSIONS.join(', ')}.`,
      )
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is 25 MB.`,
      )
      return
    }
    if (file.size < 256) {
      setError(`"${file.name}" looks empty. Please choose a real audio recording.`)
      return
    }

    setBusy(true)
    try {
      const duration = await probeAudioDuration(file)
      setSource({
        blob: file,
        filename: file.name,
        mimeType: file.type || 'audio/wav',
        sizeBytes: file.size,
        durationSeconds: duration,
        origin: 'upload',
      })
    } finally {
      setBusy(false)
    }
  }, [])

  const setRecording = useCallback(
    async (blob: Blob, extension: string, durationMs: number) => {
      setError(null)
      setBusy(true)
      try {
        const duration = await probeAudioDuration(blob)
        const stamp = new Date()
        const name = `recording-${stamp.getHours().toString().padStart(2, '0')}${stamp
          .getMinutes()
          .toString()
          .padStart(2, '0')}${stamp.getSeconds().toString().padStart(2, '0')}${extension}`
        setSource({
          blob,
          filename: name,
          mimeType: blob.type || 'audio/webm',
          sizeBytes: blob.size,
          durationSeconds: duration ?? durationMs / 1000,
          origin: 'recording',
        })
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const clear = useCallback(() => {
    setSource(null)
    setError(null)
  }, [])

  const toDataUrl = useCallback(async (): Promise<string | null> => {
    if (!source) return null
    return blobToDataUrl(source.blob)
  }, [source])

  return {
    source,
    objectUrl,
    error,
    busy,
    acceptFile,
    setRecording,
    clear,
    toDataUrl,
    setError,
  }
}
