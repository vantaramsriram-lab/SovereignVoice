import { motion } from 'framer-motion'
import { AudioLines, ClipboardList, Sparkles } from 'lucide-react'
import type { AnalysisResponse } from '../../types'
import { audioUrlFromBase64 } from '../../services/api'
import { formatDateTime } from '../../utils/format'
import { AudioPlayer } from '../audio/AudioPlayer'
import { Pill } from '../ui/Pill'
import { CrmFields } from './CrmFields'
import { IntelligenceSummary } from './IntelligenceSummary'
import { TranscriptPanel } from './TranscriptPanel'

interface AnalysisResultsProps {
  analysis: AnalysisResponse
  inputAudioUrl: string
  onReset: () => void
  voiceLabel?: string | null
}

function SectionCard({
  index,
  eyebrow,
  title,
  icon,
  children,
  delay = 0,
}: {
  index: string
  eyebrow: string
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className="surface overflow-hidden"
    >
      <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-mist-300">
            {icon}
          </span>
          <div>
            <span className="label">{index} · {eyebrow}</span>
            <h2 className="mt-0.5 text-[15.5px] font-medium tracking-[-0.01em] text-mist-50">
              {title}
            </h2>
          </div>
        </div>
      </header>
      <div className="px-5 py-5 sm:px-7 sm:py-6">{children}</div>
    </motion.section>
  )
}

/**
 * The results view contains exactly three primary sections:
 *   A. Generated localized response audio
 *   B. Customer intelligence summary
 *   C. Structured CRM information
 * The original transcript lives inside a collapsible evidence panel so the
 * default view stays uncluttered.
 */
export function AnalysisResults({
  analysis,
  inputAudioUrl,
  onReset,
  voiceLabel,
}: AnalysisResultsProps) {
  const outputUrl = audioUrlFromBase64(
    analysis.response_audio.base64,
    analysis.response_audio.mime_type,
  )
  const { crm, summary, response_script } = analysis.intelligence
  const extension = analysis.response_audio.extension || '.wav'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* result header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
        <div>
          <p className="label mb-1.5">Analysis complete</p>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-mist-50 sm:text-[28px]">
            Customer conversation intelligence
          </h1>
          <p className="mt-1.5 text-[12.5px] text-mist-500">
            {formatDateTime(analysis.created_at)}
            {analysis.input_audio.filename ? ` · ${analysis.input_audio.filename}` : ''}
            {crm.customer_language ? ` · ${crm.customer_language}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {crm.human_review_required && <Pill tone="warning" dot>Review required</Pill>}
          <button type="button" onClick={onReset} className="btn-ghost">
            New analysis
          </button>
        </div>
      </div>

      {analysis.agent_context && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
          <span className="label">Agent context used</span>
          <p className="mt-1 text-[13px] leading-relaxed text-mist-300">
            {analysis.agent_context}
          </p>
        </div>
      )}

      {/* A — generated audio */}
      <SectionCard
        index="A"
        eyebrow="Generated audio"
        title="Localized response"
        icon={<AudioLines size={15} />}
      >
        <div className="rounded-2xl border border-white/[0.07] bg-ink-850">
          <AudioPlayer
            src={outputUrl}
            label={`Response audio${analysis.response_audio.voice ? ` · ${analysis.response_audio.voice}` : ''}`}
            downloadFilename={`sovereignvoice-response${extension}`}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.012] px-4 py-3">
            <span className="label">Response script</span>
            <p className="mt-1.5 text-[13.5px] leading-[1.8] text-mist-200">
              {response_script.text}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.012] px-4 py-3">
            <span className="label">Customer audio</span>
            <div className="-mx-2 mt-1">
              <AudioPlayer
                src={inputAudioUrl}
                label={analysis.input_audio.filename ?? 'Customer audio'}
                compact
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-mist-600">
              {analysis.response_audio.language && (
                <span>Voice language: {analysis.response_audio.language}</span>
              )}
              {analysis.response_audio.duration_seconds !== null && (
                <span>Duration: {analysis.response_audio.duration_seconds}s</span>
              )}
              {voiceLabel && <span>{voiceLabel}</span>}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* B — summary */}
      <SectionCard
        index="B"
        eyebrow="Intelligence"
        title="Customer intelligence summary"
        icon={<Sparkles size={15} />}
        delay={0.06}
      >
        <IntelligenceSummary summary={summary} />
      </SectionCard>

      {/* C — CRM */}
      <SectionCard
        index="C"
        eyebrow="CRM"
        title="Structured CRM information"
        icon={<ClipboardList size={15} />}
        delay={0.12}
      >
        <CrmFields crm={crm} />
      </SectionCard>

      {/* evidence */}
      <TranscriptPanel transcript={analysis.transcript} />
    </motion.div>
  )
}
