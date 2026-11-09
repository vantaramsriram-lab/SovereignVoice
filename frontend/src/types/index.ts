/**
 * Shared types mirroring the FastAPI response schemas.
 * Keep these in sync with backend/app/schemas/responses.py.
 */

export type PaymentIntention =
  | 'explicit_intent'
  | 'general_willingness'
  | 'unable_to_pay'
  | 'disputes_amount'
  | 'needs_more_time'
  | 'unclear'
  | 'no_statement'

export type Sentiment =
  | 'cooperative'
  | 'neutral'
  | 'frustrated'
  | 'distressed'
  | 'hostile'
  | 'unclear'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface PromisedDate {
  original_phrase: string | null
  normalized_date: string | null
  confidence: ConfidenceLevel
  is_uncertain: boolean
  note: string | null
}

export interface CrmFields {
  customer_language: string | null
  payment_reason: string | null
  payment_intention: PaymentIntention
  payment_commitment: boolean
  promised_amount: string | null
  promised_amount_value: number | null
  promised_amount_currency: string | null
  promised_date: PromisedDate | null
  customer_request: string | null
  sentiment: Sentiment
  suggested_next_action: string | null
  dispute_raised: boolean
  dispute_detail: string | null
  complaint_raised: boolean
  complaint_detail: string | null
  confidence: ConfidenceLevel
  human_review_required: boolean
  human_review_reasons: string[]
}

export interface CustomerIntelligenceSummary {
  narrative: string
  confirmed: string[]
  inferred: string[]
  missing: string[]
  uncertain: string[]
}

export interface ResponseScript {
  text: string
  language: string
  tone: string
}

export interface LlmAnalysis {
  summary: CustomerIntelligenceSummary
  crm: CrmFields
  response_script: ResponseScript
}

export interface AudioInfo {
  filename: string | null
  size_bytes: number
  extension: string
  mime_type: string
  duration_seconds: number | null
  sample_rate?: number | null
  channels?: number | null
}

export interface TranscriptResult {
  text: string
  meta: {
    detected_language_code: string | null
    model: string | null
    provider_request_id: string | null
    processing_time: number | null
  }
  audio: AudioInfo | null
}

export interface ResponseAudio {
  mime_type: string
  extension: string
  duration_seconds: number | null
  voice: string | null
  language: string | null
  base64: string
  size_bytes: number
}

export type StageKey = 'audio' | 'stt' | 'llm' | 'crm' | 'tts'
export type StageStatusValue =
  | 'pending'
  | 'running'
  | 'complete'
  | 'error'
  | 'skipped'

export interface StageStatus {
  key: StageKey
  label: string
  status: StageStatusValue
  detail: string | null
  duration_ms: number | null
}

export interface AnalysisResponse {
  analysis_id: string
  created_at: string
  agent_context: string | null
  input_audio: AudioInfo
  transcript: TranscriptResult
  intelligence: LlmAnalysis
  response_audio: ResponseAudio
  stages: StageStatus[]
}

/** What we persist in localStorage (audio included as data URLs). */
export interface DemoRecord {
  id: string
  createdAt: string
  label: string
  agentContext: string | null
  inputAudio: {
    filename: string
    mimeType: string
    sizeBytes: number
    durationSeconds: number | null
    dataUrl: string
  }
  outputAudio: {
    mimeType: string
    extension: string
    durationSeconds: number | null
    voice: string | null
    language: string | null
    dataUrl: string
  }
  transcript: TranscriptResult
  intelligence: LlmAnalysis
  stages: StageStatus[]
}

export interface IntegrationConfig {
  gnani_api_key_configured: boolean
  gnani_auth_header: string
  gnani_shared_key: boolean
  prisma: {
    configured: boolean
    endpoint: string
    model: string
    language_code: string
    auth_header: string
    credential_source: string
  }
  timbre: {
    configured: boolean
    endpoint: string
    model: string
    voice: string
    language: string
    speed: number
    auth_header: string
    credential_source: string
  }
  llm: {
    configured: boolean
    model_id: string | null
    endpoint: string | null
    credential_source: string
  }
  limits: {
    max_audio_bytes: number
    allowed_extensions: string[]
  }
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  service: string
  version: string
  timestamp: string
  pipeline_ready: boolean
  integrations: { stt: boolean; llm: boolean; tts: boolean }
  config: IntegrationConfig
  notes: string[]
}

export interface ApiErrorPayload {
  error: string
  service?: string
  message: string
  detail?: string
  missing?: string[]
  human_review_required?: boolean
}
