import { motion } from 'framer-motion'
import { Check, Loader2, Minus, X } from 'lucide-react'
import type { StageKey, StageStatusValue } from '../types'

export interface StageView {
  key: StageKey
  label: string
  status: StageStatusValue
  detail?: string | null
  durationMs?: number | null
}

const DEFAULT_STAGES: StageView[] = [
  { key: 'audio', label: 'Processing customer audio', status: 'pending' },
  { key: 'stt', label: 'Transcribing with Gnani Prisma', status: 'pending' },
  { key: 'llm', label: 'Understanding conversation with LLM', status: 'pending' },
  { key: 'crm', label: 'Generating customer intelligence', status: 'pending' },
  { key: 'tts', label: 'Generating localized response with Gnani Timbre', status: 'pending' },
]

function StageIcon({ status }: { status: StageStatusValue }) {
  if (status === 'complete')
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Check size={13} strokeWidth={3} />
      </span>
    )
  if (status === 'running')
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-mist-100">
        <Loader2 size={13} className="animate-spin" />
      </span>
    )
  if (status === 'error')
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-danger/15 text-danger">
        <X size={13} strokeWidth={3} />
      </span>
    )
  if (status === 'skipped')
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-600 text-mist-500">
        <Minus size={13} strokeWidth={3} />
      </span>
    )
  return (
    <span className="flex h-6 w-6 items-center justify-center">
      <span className="h-1.5 w-1.5 rounded-full bg-mist-600" />
    </span>
  )
}

interface ProcessingStagesProps {
  /** Live stages from the backend, when available. */
  stages?: StageView[]
  /** The stage we asked for but have not heard back about yet. */
  activeIndex?: number
  /** Error message for the stage that failed. */
  errorStage?: StageKey | null
  compact?: boolean
}

/**
 * Shows genuine pipeline progress.
 *
 * The backend is a single request, so the UI advances one stage at a time:
 * the earliest stage the server has not yet reported for is shown as running.
 * A stage is only ever marked complete when the server says so, and durations
 * come from real measurements on the backend — never estimated or invented.
 */
export function ProcessingStages({
  stages,
  activeIndex = 0,
  errorStage = null,
  compact = false,
}: ProcessingStagesProps) {
  const list: StageView[] =
    stages && stages.length > 0
      ? stages
      : DEFAULT_STAGES.map((stage, index) => ({
          ...stage,
          // Live mode: the backend answers with a single response, so we never
          // claim a stage is finished before the server says it is. The current
          // stage is highlighted; everything else stays pending.
          status:
            errorStage === stage.key
              ? 'error'
              : index === activeIndex
                ? 'running'
                : 'pending',
        }))

  const completed = list.filter((stage) => stage.status === 'complete').length

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <ol className="relative">
        {list.map((stage, index) => {
          const isLast = index === list.length - 1
          return (
            <motion.li
              key={stage.key}
              initial={{ opacity: 0, x: -6 }}
              animate={{
                opacity: stage.status === 'pending' ? 0.45 : 1,
                x: 0,
              }}
              transition={{ duration: 0.35, delay: index * 0.04 }}
              className="relative flex gap-3 pb-4 last:pb-0"
            >
              {!isLast && (
                <span
                  className="absolute left-3 top-7 h-[calc(100%-1rem)] w-px"
                  style={{
                    background:
                      stage.status === 'complete'
                        ? 'rgba(143,240,198,0.28)'
                        : 'rgba(255,255,255,0.08)',
                  }}
                  aria-hidden="true"
                />
              )}
              <StageIcon status={stage.status} />
              <div className="min-w-0 flex-1 pt-[2px]">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span
                    className={`text-[13.5px] leading-5 ${
                      stage.status === 'pending' ? 'text-mist-500' : 'text-mist-100'
                    }`}
                  >
                    {stage.label}
                  </span>
                  {stage.status === 'complete' && stage.durationMs ? (
                    <span className="font-mono text-[10.5px] tabular-nums text-mist-600">
                      {(stage.durationMs / 1000).toFixed(2)}s
                    </span>
                  ) : null}
                </div>
                {stage.status === 'running' && !stage.detail && (
                  <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-ink-600">
                    <motion.div
                      className="h-full w-1/3 rounded-full bg-mist-300/70"
                      animate={{ x: ['-100%', '300%'] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                )}
                {stage.detail && (
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-mist-500">
                    {stage.detail}
                  </p>
                )}
              </div>
            </motion.li>
          )
        })}
      </ol>
      {completed > 0 && (
        <p className="pt-1 text-[11px] text-mist-600">
          {completed} of 5 stages complete · durations measured on the backend
        </p>
      )}
    </div>
  )
}
