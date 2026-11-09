import type {
  ConfidenceLevel,
  CrmFields,
  PaymentIntention,
  Sentiment,
} from '../types'

/**
 * Presentation helpers for CRM values.
 * IMPORTANT: these only describe values the backend already verified.
 * Nothing here upgrades, guesses or fills in missing data.
 */

export const INTENTION_LABELS: Record<PaymentIntention, string> = {
  explicit_intent: 'Explicit intent to pay',
  general_willingness: 'General willingness only',
  unable_to_pay: 'Unable to pay right now',
  disputes_amount: 'Disputes the amount',
  needs_more_time: 'Needs more time',
  unclear: 'Unclear',
  no_statement: 'No statement made',
}

export const INTENTION_TONE: Record<PaymentIntention, PillTone> = {
  explicit_intent: 'positive',
  general_willingness: 'neutral',
  unable_to_pay: 'warning',
  disputes_amount: 'warning',
  needs_more_time: 'neutral',
  unclear: 'muted',
  no_statement: 'muted',
}

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  cooperative: 'Cooperative',
  neutral: 'Neutral',
  frustrated: 'Frustrated',
  distressed: 'Distressed',
  hostile: 'Hostile',
  unclear: 'Unclear',
}

export const SENTIMENT_TONE: Record<Sentiment, PillTone> = {
  cooperative: 'positive',
  neutral: 'neutral',
  frustrated: 'warning',
  distressed: 'warning',
  hostile: 'danger',
  unclear: 'muted',
}

export const CONFIDENCE_TONE: Record<ConfidenceLevel, PillTone> = {
  high: 'positive',
  medium: 'warning',
  low: 'danger',
}

export type PillTone = 'positive' | 'neutral' | 'warning' | 'danger' | 'muted'

export const PILL_CLASSES: Record<PillTone, string> = {
  positive: 'border-accent/30 bg-accent-dim text-accent-soft',
  neutral: 'border-white/12 bg-white/[0.04] text-mist-200',
  warning: 'border-warn/30 bg-warn/10 text-warn',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  muted: 'border-white/10 bg-white/[0.02] text-mist-400',
}

export interface CrmRow {
  key: string
  label: string
  value: string | null
  tone?: PillTone
  hint?: string
  isMissing: boolean
}

const NOT_AVAILABLE = 'Not stated in the conversation'

export function crmRows(crm: CrmFields): CrmRow[] {
  const amount = crm.promised_amount
  const date = crm.promised_date
  const rows: CrmRow[] = [
    {
      key: 'customer_language',
      label: 'Customer language',
      value: crm.customer_language,
      isMissing: !crm.customer_language,
      hint: 'Detected by Gnani Prisma and confirmed by the analyst model.',
    },
    {
      key: 'payment_reason',
      label: 'Payment reason',
      value: crm.payment_reason,
      isMissing: !crm.payment_reason,
    },
    {
      key: 'payment_intention',
      label: 'Payment intention',
      value: INTENTION_LABELS[crm.payment_intention],
      tone: INTENTION_TONE[crm.payment_intention],
      isMissing: crm.payment_intention === 'no_statement',
    },
    {
      key: 'payment_commitment',
      label: 'Payment commitment',
      value: crm.payment_commitment ? 'Explicit commitment made' : 'No explicit commitment',
      tone: crm.payment_commitment ? 'positive' : 'muted',
      isMissing: false,
      hint: 'Only set when the customer explicitly promised to pay.',
    },
    {
      key: 'promised_amount',
      label: 'Promised amount',
      value: amount,
      isMissing: !amount,
      hint: amount ? 'Shown exactly as the customer stated it.' : undefined,
    },
    {
      key: 'promised_date',
      label: 'Promised date',
      value: date?.original_phrase ?? null,
      tone: date?.is_uncertain ? 'warning' : date ? 'neutral' : undefined,
      isMissing: !date?.original_phrase,
      hint: date?.normalized_date
        ? `Normalised: ${date.normalized_date}`
        : date?.is_uncertain
          ? 'Ambiguous — keep the original phrase and confirm with the customer.'
          : undefined,
    },
    {
      key: 'customer_request',
      label: 'Customer request',
      value: crm.customer_request,
      isMissing: !crm.customer_request,
    },
    {
      key: 'sentiment',
      label: 'Sentiment',
      value: SENTIMENT_LABELS[crm.sentiment],
      tone: SENTIMENT_TONE[crm.sentiment],
      isMissing: crm.sentiment === 'unclear',
    },
    {
      key: 'suggested_next_action',
      label: 'Suggested next action',
      value: crm.suggested_next_action,
      isMissing: !crm.suggested_next_action,
      hint: 'Recommendation for a human agent — nothing is executed automatically.',
    },
    {
      key: 'dispute',
      label: 'Dispute flag',
      value: crm.dispute_raised
        ? crm.dispute_detail || 'Dispute raised'
        : 'No dispute raised',
      tone: crm.dispute_raised ? 'warning' : 'muted',
      isMissing: false,
    },
    {
      key: 'complaint',
      label: 'Complaint flag',
      value: crm.complaint_raised
        ? crm.complaint_detail || 'Complaint raised'
        : 'No complaint raised',
      tone: crm.complaint_raised ? 'warning' : 'muted',
      isMissing: false,
    },
    {
      key: 'confidence',
      label: 'Confidence',
      value: crm.confidence.toUpperCase(),
      tone: CONFIDENCE_TONE[crm.confidence],
      isMissing: false,
    },
    {
      key: 'human_review',
      label: 'Human review',
      value: crm.human_review_required ? 'Required' : 'Not required',
      tone: crm.human_review_required ? 'warning' : 'positive',
      isMissing: false,
    },
  ]

  return rows.map((row) =>
    row.isMissing && !row.value ? { ...row, value: NOT_AVAILABLE } : row,
  )
}

export function reviewSummary(crm: CrmFields): string {
  const items: string[] = []
  if (crm.dispute_raised) items.push('dispute raised')
  if (crm.complaint_raised) items.push('complaint raised')
  if (crm.payment_commitment) items.push('commitment recorded')
  if (crm.confidence === 'low') items.push('low confidence')
  if (crm.promised_date?.is_uncertain) items.push('ambiguous date')
  if (items.length === 0) items.push('standard verification')
  return items.join(' · ')
}
