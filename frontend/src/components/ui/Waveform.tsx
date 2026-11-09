import { motion } from 'framer-motion'

interface WaveformProps {
  /** Live input level 0..1 (microphone meter). */
  level?: number
  /** Drives the animated "processing" state. */
  active?: boolean
  bars?: number
  height?: number
  className?: string
  tone?: 'accent' | 'muted' | 'light'
}

const TONE_COLORS: Record<NonNullable<WaveformProps['tone']>, string> = {
  accent: '#8ff0c6',
  muted: '#565661',
  light: '#e9e9ee',
}

/**
 * Deterministic pseudo-random shape so bars stay stable between renders while
 * still looking organic. Idle bars are static; active bars animate.
 */
function barShape(index: number, total: number): number {
  const seed = Math.sin(index * 12.9898) * 43758.5453
  const noise = seed - Math.floor(seed)
  const envelope = Math.sin((index / Math.max(1, total - 1)) * Math.PI)
  return 0.2 + envelope * 0.62 * (0.45 + noise * 0.55)
}

export function Waveform({
  level = 0,
  active = false,
  bars = 44,
  height = 44,
  className = '',
  tone = 'accent',
}: WaveformProps) {
  const color = TONE_COLORS[tone]
  return (
    <div
      className={`flex items-center justify-center gap-[3px] ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, index) => {
        const base = barShape(index, bars)
        const dynamic = Math.min(1, base * (0.45 + level * 1.9))
        const target = active ? 0.25 + base * 0.75 : dynamic
        return (
          <motion.span
            key={index}
            className="rounded-full"
            style={{
              width: 3,
              background: color,
              opacity: active ? 0.75 : 0.28 + level * 0.7,
            }}
            initial={{ height: 3 }}
            animate={{ height: Math.max(3, target * height) }}
            transition={{
              duration: active ? 0.55 : 0.16,
              repeat: active ? Infinity : 0,
              repeatType: 'reverse',
              delay: active ? index * 0.018 : 0,
              ease: 'easeInOut',
            }}
          />
        )
      })}
    </div>
  )
}
