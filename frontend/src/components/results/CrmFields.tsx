import { AlertTriangle, ShieldCheck } from 'lucide-react'
import type { CrmFields as CrmFieldsType } from '../../types'
import { CONFIDENCE_TONE, crmRows, reviewSummary } from '../../utils/crm'
import { Pill } from '../ui/Pill'

interface CrmFieldsProps {
  crm: CrmFieldsType
}

/**
 * Structured CRM record. Values are shown exactly as the backend validated
 * them: missing information reads as "Not stated in the conversation" instead
 * of being guessed, and every uncertain field carries its caveat.
 */
export function CrmFields({ crm }: CrmFieldsProps) {
  const rows = crmRows(crm)

  return (
    <div>
      {/* review banner */}
      <div
        className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
          crm.human_review_required
            ? 'border-warn/25 bg-warn/[0.06]'
            : 'border-accent/20 bg-accent/[0.05]'
        }`}
      >
        <div className="flex items-start gap-2.5">
          {crm.human_review_required ? (
            <AlertTriangle size={15} className="mt-[2px] text-warn" />
          ) : (
            <ShieldCheck size={15} className="mt-[2px] text-accent" />
          )}
          <div>
            <p
              className={`text-[12.5px] font-medium ${
                crm.human_review_required ? 'text-warn' : 'text-accent-soft'
              }`}
            >
              {crm.human_review_required
                ? 'Human review required before any action'
                : 'No additional review flag raised'}
            </p>
            <p className="mt-0.5 text-[11.5px] text-mist-500">{reviewSummary(crm)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={CONFIDENCE_TONE[crm.confidence]} dot>
            Confidence: {crm.confidence}
          </Pill>
        </div>
      </div>

      {crm.human_review_reasons.length > 0 && (
        <ul className="mb-6 space-y-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.015] px-4 py-3">
          {crm.human_review_reasons.map((reason, index) => (
            <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-mist-400">
              <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-warn/70" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="divide-y divide-white/[0.055]">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid gap-1 py-3.5 sm:grid-cols-[210px_1fr] sm:gap-6 sm:py-3"
          >
            <dt className="text-[12.5px] text-mist-500">{row.label}</dt>
            <dd className="min-w-0">
              {row.tone ? (
                <Pill tone={row.tone}>{row.value}</Pill>
              ) : (
                <span
                  className={`text-[13.5px] leading-relaxed ${
                    row.isMissing ? 'text-mist-600' : 'text-mist-100'
                  }`}
                >
                  {row.value}
                </span>
              )}
              {row.hint && (
                <p className="mt-1 text-[11px] leading-relaxed text-mist-600">{row.hint}</p>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-5 border-t border-white/[0.05] pt-4 text-[11px] leading-relaxed text-mist-600">
        Extracted from the customer's own words and checked against the transcript.
        Amounts, dates and commitments are only shown when explicitly stated — nothing
        here is auto-approved.
      </p>
    </div>
  )
}
