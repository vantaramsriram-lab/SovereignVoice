import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, FileAudio2 } from 'lucide-react'
import type { TranscriptResult } from '../../types'
import { readPreferences } from '../../services/storage'

interface TranscriptPanelProps {
  transcript: TranscriptResult
  defaultOpen?: boolean
}

/**
 * Evidence panel. The transcript here is the untouched STT output — it is
 * never cleaned up or rewritten by the language model.
 */
export function TranscriptPanel({ transcript, defaultOpen }: TranscriptPanelProps) {
  // Respect the user's saved UI preference (localStorage) unless overridden.
  const [open, setOpen] = useState(() =>
    defaultOpen === undefined ? readPreferences().showTranscriptByDefault : defaultOpen,
  )
  const meta = transcript.meta

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.012]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="flex items-center gap-2.5">
          <FileAudio2 size={14} className="text-mist-500" />
          <span className="text-[13px] font-medium text-mist-200">
            Original transcript / View evidence
          </span>
          <span className="label !text-[10px] !tracking-[0.14em]">verbatim</span>
        </span>
        <span className="flex items-center gap-3">
          {meta.detected_language_code && (
            <span className="hidden font-mono text-[10.5px] text-mist-600 sm:block">
              {meta.detected_language_code}
            </span>
          )}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown size={16} className="text-mist-500" />
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="px-4 py-4">
              <p
                className="whitespace-pre-wrap text-[14px] leading-[1.85] text-mist-200"
                lang="auto"
              >
                {transcript.text}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-white/[0.05] pt-3 text-[10.5px] text-mist-600">
                {meta.model && <span>STT model: {meta.model}</span>}
                {meta.detected_language_code && (
                  <span>Detected: {meta.detected_language_code}</span>
                )}
                {meta.processing_time !== null && (
                  <span>Provider time: {meta.processing_time}s</span>
                )}
                {meta.provider_request_id && (
                  <span className="font-mono">Request: {meta.provider_request_id}</span>
                )}
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-mist-600">
                Kept exactly as returned by Gnani Prisma. Analysis is performed on this
                text; it is never rewritten.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
