import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight,
  Check,
  Mic,
  Paperclip,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useAudioSource, type AudioSource } from '../hooks/useAudioSource'
import { useRecorder } from '../hooks/useRecorder'
import { formatBytes, formatDuration, formatTimer } from '../utils/format'
import { AudioPlayer } from './audio/AudioPlayer'
import { Spinner } from './ui/Spinner'
import { Waveform } from './ui/Waveform'

export interface SubmitPayload {
  source: AudioSource
  agentContext: string
}

interface VoiceInputProps {
  onSubmit: (payload: SubmitPayload) => void
  isProcessing: boolean
  /** Set when the backend is unreachable or misconfigured. */
  blockedReason?: string | null
}

/**
 * The primary interaction: one pill-shaped field that accepts an uploaded
 * audio file or a live recording, plus optional agent context.
 *
 * Adapted from the reference composition (centred, rounded, minimal) but built
 * around SovereignVoice's real capability: customer audio in, intelligence out.
 */
export function VoiceInput({ onSubmit, isProcessing, blockedReason }: VoiceInputProps) {
  const [context, setContext] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [micHint, setMicHint] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const contextRef = useRef<HTMLTextAreaElement | null>(null)
  const dragDepth = useRef(0)

  const audio = useAudioSource()
  const recorder = useRecorder()

  const hasSource = Boolean(audio.source)
  const busy = isProcessing || audio.busy
  const canSubmit = hasSource && !busy && !blockedReason && !recorder.isRecording

  useEffect(() => {
    if (showContext) contextRef.current?.focus()
  }, [showContext])

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    await audio.acceptFile(files[0])
    setMicHint(null)
  }

  const toggleRecording = async () => {
    setMicHint(null)
    if (recorder.isRecording) {
      const result = await recorder.stop()
      if (result) {
        await audio.setRecording(result.blob, result.extension, result.durationMs)
      }
      recorder.reset()
      return
    }
    await audio.clear()
    const started = await recorder.start()
    if (!started) setMicHint(recorder.error)
  }

  const submit = () => {
    if (!audio.source || !canSubmit) return
    onSubmit({ source: audio.source, agentContext: context })
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="w-full">
      <motion.div
        layout
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault()
          dragDepth.current -= 1
          if (dragDepth.current <= 0) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          dragDepth.current = 0
          setDragging(false)
          void handleFiles(event.dataTransfer.files)
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className={`relative w-full border bg-ink-800/80 backdrop-blur-2xl transition-colors duration-300 ${
          hasSource || recorder.isRecording
            ? 'rounded-[2rem] shadow-pill'
            : 'rounded-[2.5rem] shadow-pill'
        } ${
          dragging
            ? 'border-accent/50 ring-2 ring-accent/20'
            : 'border-white/[0.09] hover:border-white/[0.14]'
        }`}
      >
        {/* drag overlay */}
        <AnimatePresence>
          {dragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-ink-950/80"
            >
              <span className="flex items-center gap-2 text-[13px] font-medium text-accent-soft">
                <Upload size={15} /> Drop audio to attach
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* attached audio summary + player */}
        <AnimatePresence initial={false}>
          {hasSource && audio.source && !recorder.isRecording && (
            <motion.div
              key="attached"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                    <Check size={13} strokeWidth={3} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-mist-100">
                      {audio.source.filename}
                    </p>
                    <p className="text-[11px] text-mist-500">
                      {formatBytes(audio.source.sizeBytes)}
                      {audio.source.durationSeconds
                        ? ` · ${formatDuration(audio.source.durationSeconds)}`
                        : ''}
                      {audio.source.origin === 'recording' ? ' · Recorded' : ' · Uploaded'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full px-3 py-1.5 text-[11.5px] font-medium text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist-100"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      audio.clear()
                      recorder.reset()
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-mist-500 transition-colors hover:bg-white/[0.06] hover:text-danger"
                    aria-label="Remove attached audio"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {audio.objectUrl && (
                <div className="mt-2 border-t border-white/[0.06]">
                  <AudioPlayer
                    src={audio.objectUrl}
                    label="Customer audio · preview"
                    compact
                    className="!px-5 sm:!px-6"
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* main row */}
        <div
          className={`flex items-center gap-2 ${
            hasSource && !recorder.isRecording ? 'px-3 py-2.5 sm:px-4' : 'px-3 py-2.5 sm:px-4'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.m4a,.ogg,.webm,.flac,audio/*"
            className="hidden"
            onChange={(event) => {
              void handleFiles(event.target.files)
              event.target.value = ''
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy || recorder.isRecording}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-mist-300 transition-all duration-300 hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
            aria-label="Upload audio file"
            title="Upload audio file"
          >
            <Paperclip size={18} strokeWidth={1.9} />
          </button>

          {recorder.isRecording ? (
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-danger/70" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-danger" />
              </span>
              <span className="font-mono text-[13px] tabular-nums text-mist-100">
                {formatTimer(recorder.elapsedMs)}
              </span>
              <Waveform
                level={recorder.level}
                bars={18}
                height={22}
                className="min-w-0 flex-1 sm:!flex"
              />
              <span className="hidden shrink-0 text-[11px] text-mist-500 md:block">Recording</span>
            </div>
          ) : showContext ? (
            <textarea
              ref={contextRef}
              value={context}
              onChange={(event) => setContext(event.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={2000}
              placeholder="Add the agent's question or context (optional)…"
              className="min-w-0 flex-1 resize-none bg-transparent py-2 text-[14.5px] leading-snug text-mist-50 placeholder:text-mist-500 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowContext(true)}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 truncate py-2 text-left text-[14.5px] text-mist-500 transition-colors hover:text-mist-300"
            >
              {context.trim()
                ? context
                : hasSource
                  ? 'Add the agent’s question or context (optional)…'
                  : 'Upload audio, record, or add a question…'}
            </button>
          )}

          {!recorder.isRecording && showContext && (
            <button
              type="button"
              onClick={() => setShowContext(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mist-500 transition-colors hover:bg-white/[0.06] hover:text-mist-200"
              aria-label="Close context field"
            >
              <X size={14} />
            </button>
          )}

          <div className="mx-0.5 hidden h-6 w-px shrink-0 bg-white/10 sm:block" />

          <button
            type="button"
            onClick={() => void toggleRecording()}
            disabled={busy || !recorder.canRecord}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 disabled:opacity-40 ${
              recorder.isRecording
                ? 'bg-danger/15 text-danger hover:bg-danger/25'
                : 'text-mist-300 hover:bg-white/[0.07] hover:text-white'
            }`}
            aria-label={recorder.isRecording ? 'Stop recording' : 'Record from microphone'}
            title={recorder.isRecording ? 'Stop recording' : 'Record from microphone'}
          >
            {recorder.isRecording ? (
              <Square size={14} strokeWidth={2.6} fill="currentColor" />
            ) : (
              <Mic size={18} strokeWidth={1.9} />
            )}
          </button>

          <motion.button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            whileTap={canSubmit ? { scale: 0.96 } : undefined}
            className={`flex h-11 shrink-0 items-center gap-2 rounded-full pl-4 pr-3.5 text-[13.5px] font-semibold transition-all duration-300 ${
              canSubmit
                ? 'bg-mist-50 text-ink-950 hover:bg-white'
                : 'cursor-not-allowed bg-ink-600 text-mist-500'
            }`}
          >
            {isProcessing ? (
              <>
                <Spinner size={14} />
                <span className="hidden sm:inline">Analyzing</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Analyze</span>
                <ArrowUpRight size={16} strokeWidth={2.4} />
              </>
            )}
          </motion.button>
        </div>

        {/* helper row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] px-5 py-2 sm:px-6">
          <p className="text-[11px] text-mist-600">
            {recorder.isRecording
              ? 'Press the stop button when the customer conversation ends.'
              : hasSource
                ? 'Ready. Analyze runs transcription, understanding, CRM extraction and localized speech.'
                : 'WAV · MP3 · M4A · OGG · WEBM · FLAC · up to 25 MB'}
          </p>
        </div>
      </motion.div>

      {/* inline errors */}
      <div className="mt-3 space-y-2 px-2">
        {audio.error && (
          <p className="text-[12px] leading-relaxed text-danger" role="alert">
            {audio.error}
          </p>
        )}
        {(micHint || recorder.error) && !recorder.isRecording && (
          <p className="text-[12px] leading-relaxed text-warn" role="alert">
            {micHint ?? recorder.error}
          </p>
        )}
        {blockedReason && (
          <p className="text-[12px] leading-relaxed text-warn" role="status">
            {blockedReason}
          </p>
        )}
      </div>
    </div>
  )
}
