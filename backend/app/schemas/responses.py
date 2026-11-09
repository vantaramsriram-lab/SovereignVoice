"""Pydantic schemas describing what the LLM must return.

These models are the guardrail between the model and the product.  Every
field that could carry a financial claim is optional, defaults to ``None``
or ``False``, and is paired with an evidence/confidence note so the
validator can reject or downgrade unsupported claims.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

PaymentIntention = Literal[
    "explicit_intent",
    "general_willingness",
    "unable_to_pay",
    "disputes_amount",
    "needs_more_time",
    "unclear",
    "no_statement",
]

Sentiment = Literal["cooperative", "neutral", "frustrated", "distressed", "hostile", "unclear"]


class PromisedDate(BaseModel):
    """A promised date is only valid when the customer explicitly stated one."""

    original_phrase: Optional[str] = Field(
        default=None, description="Date exactly as the customer phrased it."
    )
    normalized_date: Optional[str] = Field(
        default=None, description="ISO-8601 date, only when unambiguous."
    )
    confidence: Literal["high", "medium", "low"] = "low"
    is_uncertain: bool = True
    note: Optional[str] = None

    @field_validator("normalized_date")
    @classmethod
    def _iso_like(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        parts = value.split("-")
        if len(parts) != 3 or not all(p.isdigit() for p in parts):
            # Anything that is not a clean ISO date is treated as uncertain.
            return None
        return value


class CrmFields(BaseModel):
    """The structured CRM record shown to collection teams."""

    customer_language: Optional[str] = None
    payment_reason: Optional[str] = Field(
        default=None, description="Stated reason for delay, or null if not stated."
    )
    payment_intention: PaymentIntention = "no_statement"
    payment_commitment: bool = Field(
        default=False,
        description="True only for an explicit, unambiguous promise to pay.",
    )
    promised_amount: Optional[str] = Field(
        default=None,
        description="Verbatim amount phrase, only when the customer stated one.",
    )
    promised_amount_value: Optional[float] = Field(
        default=None, description="Numeric value only when unambiguous."
    )
    promised_amount_currency: Optional[str] = None
    promised_date: Optional[PromisedDate] = None
    customer_request: Optional[str] = None
    sentiment: Sentiment = "unclear"
    suggested_next_action: Optional[str] = None
    dispute_raised: bool = False
    dispute_detail: Optional[str] = None
    complaint_raised: bool = False
    complaint_detail: Optional[str] = None
    confidence: Literal["high", "medium", "low"] = "low"
    human_review_required: bool = True
    human_review_reasons: List[str] = Field(default_factory=list)

    @field_validator("promised_amount")
    @classmethod
    def _trim_amount(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None


class CustomerIntelligenceSummary(BaseModel):
    """Natural-language summary split by epistemic status."""

    narrative: str = ""
    confirmed: List[str] = Field(default_factory=list)
    inferred: List[str] = Field(default_factory=list)
    missing: List[str] = Field(default_factory=list)
    uncertain: List[str] = Field(default_factory=list)


class ResponseScript(BaseModel):
    """The localized response the collection team can review / replay."""

    text: str = ""
    language: str = "auto"
    tone: str = "professional, empathetic, non-threatening"


class LlmAnalysis(BaseModel):
    """Full structured payload expected from Llama 3.2 3B Instruct."""

    summary: CustomerIntelligenceSummary = Field(
        default_factory=CustomerIntelligenceSummary
    )
    crm: CrmFields = Field(default_factory=CrmFields)
    response_script: ResponseScript = Field(default_factory=ResponseScript)

    @field_validator("response_script", mode="before")
    @classmethod
    def _script_from_string(cls, value):
        # Some small models return the script as a bare string.
        if isinstance(value, str):
            return {"text": value}
        return value


class TranscriptMeta(BaseModel):
    detected_language_code: Optional[str] = None
    model: Optional[str] = None
    provider_request_id: Optional[str] = None
    processing_time: Optional[float] = None


class TranscriptResult(BaseModel):
    """Original STT output — preserved verbatim, never rewritten by the LLM."""

    text: str
    meta: TranscriptMeta = Field(default_factory=TranscriptMeta)
    audio: Optional[dict] = None


class AudioPayload(BaseModel):
    mime_type: str = "audio/wav"
    extension: str = ".wav"
    duration_seconds: Optional[float] = None
    voice: Optional[str] = None
    language: Optional[str] = None
    base64: str = ""
    size_bytes: int = 0


class StageStatus(BaseModel):
    key: str
    label: str
    status: Literal["pending", "running", "complete", "error", "skipped"] = "pending"
    detail: Optional[str] = None
    duration_ms: Optional[int] = None


class AnalysisResponse(BaseModel):
    """What POST /api/analyze returns to the frontend."""

    analysis_id: str
    created_at: str
    agent_context: Optional[str] = None
    input_audio: dict
    transcript: TranscriptResult
    intelligence: LlmAnalysis
    response_audio: AudioPayload
    stages: List[StageStatus] = Field(default_factory=list)
