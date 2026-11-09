import { useEffect, useRef, useState } from 'react'
import { Download, Pause, Play, RotateCcw } from 'lucide-react'
import { formatDuration } from '../../utils/format'
import { Waveform } from '../ui/Waveform'

interface AudioPlayerProps {
  src: string
  label?: string
  tone?: 'accent' | 'muted' | 'light'
  downloadFilename?: string
  compact?: boolean
  className?: string
}

/**
 * A single, consistent audio control used for both customer input audio and
 * generated response audio. Uses the native <audio> element for playback and
 * only draws the chrome itself.
 */
export function AudioPlayer({
  src,
  label,
  tone = 'accent',
  downloadFilename,
  compact = false,
  className = '',
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
    setDuration(null)
    setFailed(false)
  }, [src])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrent(audio.currentTime)
    const onMeta = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : null)
    const onEnd = () => {
      setPlaying(false)
      setCurrent(0)
    }
    const onError = () => {
      setFailed(true)
      setPlaying(false)
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('error', onError)
    }
  }, [src])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio || failed) return
    if (audio.paused) {
      void audio.play().catch(() => setFailed(true))
      setPlaying(true)
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  const restart = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    setCurrent(0)
  }

  const seek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const next = Number(event.target.value)
    audio.currentTime = next
    setCurrent(next)
  }

  const progress = duration && duration > 0 ? (current / duration) * 100 : 0

  return (
    <div
      className={`group flex items-center gap-3 ${compact ? 'px-3 py-2.5' : 'px-4 py-3.5'} ${className}`}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={toggle}
        disabled={failed}
        aria-label={playing ? 'Pause audio' : 'Play audio'}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
          failed
            ? 'cursor-not-allowed bg-ink-700 text-mist-600'
            : 'bg-mist-50 text-ink-950 hover:scale-[1.04] hover:bg-white'
        }`}
      >
        {playing ? (
          <Pause size={16} strokeWidth={2.4} />
        ) : (
          <Play size={16} strokeWidth={2.4} className="ml-[2px]" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="truncate text-[12.5px] font-medium text-mist-200">
            {label ?? 'Audio'}
          </span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-mist-500">
            {formatDuration(current)} / {duration !== null ? formatDuration(duration) : '—'}
          </span>
        </div>

        <div className="relative flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink-600">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-mist-100/85 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration ?? 0}
            step={0.05}
            value={current}
            onChange={seek}
            aria-label="Seek audio"
            disabled={!duration}
            className="absolute inset-0 h-1.5 w-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
        </div>

        {failed && (
          <p className="mt-1.5 text-[11px] text-danger">
            This browser could not decode the audio.
          </p>
        )}
      </div>

      {!compact && (
        <Waveform
          active={playing}
          bars={18}
          height={26}
          tone={playing ? tone : 'muted'}
          className="hidden shrink-0 sm:flex"
        />
      )}

      <button
        type="button"
        onClick={restart}
        className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-mist-500 transition-colors hover:bg-white/[0.06] hover:text-mist-200 sm:flex"
        aria-label="Restart audio"
      >
        <RotateCcw size={14} />
      </button>

      {downloadFilename && (
        <a
          href={src}
          download={downloadFilename}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mist-500 transition-colors hover:bg-white/[0.06] hover:text-mist-200"
          aria-label="Download audio"
        >
          <Download size={14} />
        </a>
      )}
    </div>
  )
}
