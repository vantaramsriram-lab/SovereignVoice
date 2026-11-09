import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'stopped'
  | 'denied'
  | 'unsupported'
  | 'error'

export interface RecordingResult {
  blob: Blob
  mimeType: string
  extension: string
  durationMs: number
}

function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  if (typeof MediaRecorder === 'undefined') return ''
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('webm')) return '.webm'
  if (mimeType.includes('ogg')) return '.ogg'
  if (mimeType.includes('mp4')) return '.m4a'
  if (mimeType.includes('wav')) return '.wav'
  return '.webm'
}

/**
 * Microphone capture via the browser MediaRecorder API.
 * Nothing is uploaded here — the blob is handed back to the page for preview
 * and only leaves the browser when the agent presses Analyze.
 */
export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>(() =>
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
      ? 'idle'
      : 'unsupported',
  )
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const resolveRef = useRef<((result: RecordingResult | null) => void) | null>(null)
  const mimeRef = useRef('')

  const cleanupAnalyser = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined)
      audioContextRef.current = null
    }
    setLevel(0)
  }, [])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      stopTimer()
      cleanupAnalyser()
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.onstop = null
        recorderRef.current.stop()
      }
      releaseStream()
    }
  }, [cleanupAnalyser, releaseStream, stopTimer])

  const attachAnalyser = useCallback(
    (stream: MediaStream) => {
      try {
        const AudioContextCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        if (!AudioContextCtor) return
        const context = new AudioContextCtor()
        const source = context.createMediaStreamSource(stream)
        const analyser = context.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)
        audioContextRef.current = context
        const buffer = new Uint8Array(analyser.frequencyBinCount)

        const tick = () => {
          analyser.getByteTimeDomainData(buffer)
          let sum = 0
          for (let i = 0; i < buffer.length; i += 1) {
            const value = (buffer[i] - 128) / 128
            sum += value * value
          }
          const rms = Math.sqrt(sum / buffer.length)
          setLevel(Math.min(1, rms * 4.5))
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        /* level metering is a nicety, never a hard failure */
      }
    },
    [],
  )

  const start = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('unsupported')
      setError('This browser does not expose the microphone recording APIs.')
      return false
    }
    setError(null)
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
      mimeRef.current = pickMimeType()
      const recorder = new MediaRecorder(
        stream,
        mimeRef.current ? { mimeType: mimeRef.current } : undefined,
      )
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        setError('The browser stopped the recording unexpectedly.')
        setStatus('error')
        stopTimer()
        cleanupAnalyser()
        releaseStream()
      }
      recorder.onstop = () => {
        const durationMs = Date.now() - startedAtRef.current
        const mimeType = mimeRef.current || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        stopTimer()
        cleanupAnalyser()
        releaseStream()
        setStatus('stopped')
        const result: RecordingResult | null =
          blob.size > 0
            ? {
                blob,
                mimeType,
                extension: extensionFor(mimeType),
                durationMs,
              }
            : null
        if (!result) setError('No audio was captured. Please try again.')
        resolveRef.current?.(result)
        resolveRef.current = null
      }

      startedAtRef.current = Date.now()
      setElapsedMs(0)
      recorder.start(250)
      attachAnalyser(stream)
      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current)
      }, 200)
      setStatus('recording')
      return true
    } catch (err) {
      stopTimer()
      cleanupAnalyser()
      releaseStream()
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied')
        setError(
          'Microphone permission was denied. Allow microphone access in your browser settings, or upload an audio file instead.',
        )
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setStatus('error')
        setError('No microphone was found on this device. You can upload an audio file instead.')
      } else {
        setStatus('error')
        setError('The microphone could not be started. You can upload an audio file instead.')
      }
      return false
    }
  }, [attachAnalyser, cleanupAnalyser, releaseStream, stopTimer])

  const stop = useCallback((): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }
      resolveRef.current = resolve
      recorder.stop()
    })
  }, [])

  const reset = useCallback(() => {
    stopTimer()
    cleanupAnalyser()
    chunksRef.current = []
    setElapsedMs(0)
    setStatus((prev) => (prev === 'denied' || prev === 'unsupported' ? prev : 'idle'))
  }, [cleanupAnalyser, stopTimer])

  return {
    status,
    elapsedMs,
    level,
    error,
    start,
    stop,
    reset,
    isRecording: status === 'recording',
    isBusy: status === 'requesting',
    canRecord: status !== 'unsupported' && status !== 'denied',
  }
}
