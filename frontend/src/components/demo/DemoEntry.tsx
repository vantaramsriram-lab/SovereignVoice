import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  Download,
  Trash2,
  Waves,
} from 'lucide-react'
import type { DemoRecord } from '../../types'
import {
  CONFIDENCE_TONE,
  INTENTION_LABELS,
  INTENTION_TONE,
  SENTIMENT_LABELS,
  SENTIMENT_TONE,
} from '../../utils/crm'
import { formatDateTime, formatDuration, formatRelative } from '../../utils/format'
import { AudioPlayer } from '../audio/AudioPlayer'
import { CrmFields } from '../results/CrmFields'
import { IntelligenceSummary } from '../results/IntelligenceSummary'
import { TranscriptPanel } from '../results/TranscriptPanel'
import { Pill } from '../ui/Pill'

interface DemoEntryProps {
  record: DemoRecord
  onDelete?: (id: string) => void
  readOnly?: boolean
}

function exportRecord(record: DemoRecord) {
  const blob = new Blob([JSON.stringify(record, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const safeName = record.inputAudio.filename
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'analysis'
  anchor.href = url
  anchor.download = `sovereignvoice-${safeName}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function DemoEntry({ record, onDelete, readOnly = false }: DemoEntryProps) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { crm, summary } = record.intelligence

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="surface overflow-hidden"
    >
      <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Waves size={13} className="shrink-0 text-mist-500" />
              <h3 className="truncate text-[14.5px] font-medium text-mist-50">
                {record.inputAudio.filename}
              </h3>
            </div>
            <p className="mt-1 text-[11.5px] text-mist-500">
              {formatDateTime(record.createdAt)} · {formatRelative(record.createdAt)}
              {record.inputAudio.durationSeconds
                ? ` · ${formatDuration(record.inputAudio.durationSeconds)}`
                : ''}
              {crm.customer_language ? ` · ${crm.customer_language}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={INTENTION_TONE[crm.payment_intention]}>
              {INTENTION_LABELS[crm.payment_intention]}
            </Pill>
            <Pill tone={SENTIMENT_TONE[crm.sentiment]}>{SENTIMENT_LABELS[crm.sentiment]}</Pill>
            <Pill tone={CONFIDENCE_TONE[crm.confidence]}>{crm.confidence}</Pill>
            {crm.human_review_required && <Pill tone="warning" dot>Review</Pill>}
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.015]">
            <AudioPlayer
              src={record.inputAudio.dataUrl}
              label="Customer audio"
              compact
              downloadFilename={record.inputAudio.filename}
            />
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.015]">
            <AudioPlayer
              src={record.outputAudio.dataUrl}
              label={`Response audio${record.outputAudio.voice ? ` · ${record.outputAudio.voice}` : ''}`}
              compact
              downloadFilename={`sovereignvoice-response${record.outputAudio.extension}`}
            />
          </div>
        </div>

        <p className="line-clamp-2 text-[13px] leading-relaxed text-mist-400">
          {summary.narrative}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3.5 py-1.5 text-[11.5px] font-medium text-mist-300 transition-colors hover:border-white/20 hover:text-white"
          >
            {open ? 'Hide details' : 'Open analysis'}
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
              <ChevronDown size={13} />
            </motion.span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportRecord(record)}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3 py-1.5 text-[11.5px] font-medium text-mist-300 transition-colors hover:border-white/20 hover:text-white"
              aria-label="Export analysis with audio and results"
            >
              <Download size={12} />
              Export
            </button>
            {!readOnly && onDelete && (
              confirming ? (
                <span className="flex items-center gap-2 text-[11.5px]">
                  <button
                    type="button"
                    onClick={() => onDelete(record.id)}
                    className="rounded-full bg-danger/15 px-3 py-1.5 font-medium text-danger transition-colors hover:bg-danger/25"
                  >
                    Delete permanently
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rounded-full px-2.5 py-1.5 text-mist-500 transition-colors hover:text-mist-200"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-mist-600 transition-colors hover:bg-white/[0.05] hover:text-danger"
                  aria-label="Delete this demo record"
                >
                  <Trash2 size={14} />
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="space-y-6 px-5 py-6 sm:px-6">
              {record.agentContext && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
                  <span className="label">Agent context used</span>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-mist-300">
                    {record.agentContext}
                  </p>
                </div>
              )}

              <div>
                <span className="label">Customer intelligence summary</span>
                <div className="mt-3">
                  <IntelligenceSummary summary={summary} />
                </div>
              </div>

              <div>
                <span className="label">Structured CRM information</span>
                <div className="mt-3">
                  <CrmFields crm={crm} />
                </div>
              </div>

              <TranscriptPanel transcript={record.transcript} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}
