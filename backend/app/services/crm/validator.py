"""CRM intelligence validator — the financial-safety gate.

This module runs *after* the LLM and *before* anything reaches the UI.  It
re-reads the raw transcript and checks every financial claim against the
evidence.  Anything unsupported is removed or downgraded, and the record is
flagged for human review.

The validator never adds information. It can only:
  * null out unsupported values,
  * flip ``payment_commitment`` to False,
  * downgrade confidence,
  * force ``human_review_required``,
  * append reasons when it changed or questioned something,
  * re-classify statements between confirmed / inferred / uncertain.
"""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Iterable, Optional

from app.schemas.responses import CrmFields, LlmAnalysis, PromisedDate

# ---------------------------------------------------------------- lexicons

# Phrases that constitute an explicit commitment (multi-lingual / code-mixed).
COMMITMENT_PATTERNS = [
    r"\bi (will|shall) pay\b",
    r"\bi('ll| will) definitely pay\b",
    r"\bi promise\b",
    r"\bguarantee\b",
    r"\bconfirmed i will\b",
    r"\bi will (definitely |surely )?(transfer|deposit|clear|settle)\b",
    r"\bpay(ment)? (kar|karunga|karta hu|karti hu|dongi|dongu|chestha|chestanu)\b",
    r"\bkal (tak )?(de|dega|dungi|dongi|chestha)\b",
    r"\b(ippa?du|repu|nenu)\b.{0,20}\b(cattu|kattestanu|kattuthanu|pay)\b",
    r"\b(pay|paid) (on|by) \w+day\b",
    r"\bset(ting)? up (a )?(standing|auto)\b",
    r"\bstanding instruction\b",
    r"\bauto[- ]?debit\b",
]

# Hedges / non-commitments that must never be read as a promise.
HEDGE_PATTERNS = [
    r"\btry\b",
    r"\btry(ing)? my best\b",
    r"\bi('ll)? see\b",
    r"\bdekhta hu\b",
    r"\bdekhti hu\b",
    r"\bchusta\b",
    r"\bchustanu\b",
    r"\bmaybe\b",
    r"\bhopefully\b",
    r"\bsomehow\b",
    r"\bif possible\b",
    r"\b(ho|hoga|hogi|hoy)\b.{0,6}\b(jayega|chestanu)?\b",
    r"\bnot sure\b",
    r"\bsochna\b",
    r"\baalochistha\b",
]

DISPUTE_PATTERNS = [
    r"\bdispute\b",
    r"\bwrong(ly)? charged\b",
    r"\bincorrect (amount|charge|bill)\b",
    r"\bnot my (loan|debt|account)\b",
    r"\bi (already )?paid\b",
    r"\balready (cleared|settled|paid)\b",
    r"\bfraud\b",
    r"\bgalat\b",
    r"\btappu\b",
    r"\bnot mine\b",
]

COMPLAINT_PATTERNS = [
    r"\bcomplain(t|ing)?\b",
    r"\bharass\w*",
    r"\bcall(ing)? me (again and again|repeatedly|daily|every ?day)\b",
    r"\btoo many calls\b",
    r"\brude\b",
    r"\bmisbehav\w*",
    r"\bunfair\b",
    r"\bnot acceptable\b",
    r"\bshikayat\b",
    r"\bphiriyadu\b",
    r"\bbad experience\b",
]

AMOUNT_KEYWORDS = [
    "rupee", "rupees", "rs", "rs.", "inr", "₹", "lakh", "lakhs", "lac",
    "thousand", "hazar", "hazaar", "crore", "thousands", "వేల", "లక్ష",
    "हज़ार", "हजार", "लाख", "ரூபாய்", "ஆயிரம்", "ரூ",
]

DATE_KEYWORDS = [
    "today", "tomorrow", "tonight", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday", "sunday", "next week", "next month",
    "end of month", "eom", "kal", "aaj", "parso", "agle", "hafte", "mahine",
    "tarikh", "tareekh", "repu", "ivaala", "naalai", "vaaram", "maasam",
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december", "salary",
]

GENERIC_PLACEHOLDERS = {
    "n/a", "na", "none", "null", "nil", "not mentioned", "not specified",
    "not stated", "not available", "unknown", "unclear", "-", "—", "no data",
}


# ---------------------------------------------------------------- helpers


def normalise(text: str) -> str:
    """Lowercase + strip diacritics + collapse whitespace for matching."""
    text = text or ""
    text = unicodedata.normalize("NFKC", text)
    text = text.lower()
    text = re.sub(r"[\u200b-\u200f\ufeff]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _matches(patterns: Iterable[str], text: str) -> bool:
    return any(re.search(pattern, text) for pattern in patterns)


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", normalise(text)))


def _contains_phrase(haystack: str, needle: str) -> bool:
    """Strict containment: most significant tokens of ``needle`` must appear."""
    needle_tokens = [
        t
        for t in re.findall(r"[\w\u0900-\u0DFF]+", normalise(needle))
        if len(t) > 1
    ]
    if not needle_tokens:
        return False
    hay = normalise(haystack)
    hay_tokens = _tokens(hay) | set(re.findall(r"[\u0900-\u0DFF]+", hay))
    hits = sum(1 for token in needle_tokens if token in hay_tokens)
    # 60% of the phrase's tokens must be present; a single-token phrase needs
    # that one token to be present.
    required = 1 if len(needle_tokens) == 1 else math.ceil(len(needle_tokens) * 0.6)
    return hits >= required


def _numbers_in(text: str) -> list[str]:
    """Numbers present in the transcript, including simple word numerals."""
    cleaned = normalise(text).replace(",", "")
    found = re.findall(r"\d+(?:\.\d+)?", cleaned)
    words = {
        "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
        "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
        "fifteen": "15", "twenty": "20", "thirty": "30", "fifty": "50",
        "hundred": "100", "thousand": "1000", "lakh": "100000",
        "ek": "1", "do": "2", "teen": "3", "char": "4", "paanch": "5",
        "das": "10", "bees": "20", "pachas": "50", "sau": "100",
    }
    for word, value in words.items():
        if re.search(rf"\b{word}\b", cleaned):
            found.append(value)
    return found


def _mentions_amount(transcript: str, amount_text: str) -> bool:
    """Is the claimed amount actually consistent with the transcript?"""
    if not amount_text:
        return False
    transcript_numbers = _numbers_in(transcript)
    claimed_numbers = _numbers_in(amount_text)
    if claimed_numbers:
        # Accept if any claimed number appears in the transcript, either as a
        # digit string or with its zeros stripped (e.g. 5000 vs 5,000 vs "5k").
        for claimed in claimed_numbers:
            core = claimed.rstrip("0") or claimed
            if any(
                claimed == t or (core and core != "0" and t.startswith(core[:2]) and claimed in t)
                for t in transcript_numbers
            ):
                return True
            if claimed in normalise(transcript).replace(",", "").replace(".", ""):
                return True
        return False
    # No digits at all in the claim (e.g. "the full amount") -> not a hard number.
    return _contains_phrase(transcript, amount_text)


def _clean_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    if not value or value.lower() in GENERIC_PLACEHOLDERS:
        return None
    return value


@dataclass
class ValidationReport:
    applied_rules: list[str] = field(default_factory=list)
    review_reasons: list[str] = field(default_factory=list)

    def flag(self, rule: str, reason: Optional[str] = None) -> None:
        if rule not in self.applied_rules:
            self.applied_rules.append(rule)
        if reason and reason not in self.review_reasons:
            self.review_reasons.append(reason)
        elif not reason and rule not in self.review_reasons:
            # Rules are also surfaced to the UI as human-readable notes.
            self.review_reasons.append(rule.replace("_", " "))


def validate_analysis(analysis: LlmAnalysis, transcript: str) -> tuple[LlmAnalysis, list[str]]:
    """Return a sanitised analysis plus the list of review reasons."""
    report = ValidationReport()
    crm: CrmFields = analysis.crm
    text = normalise(transcript)
    crm_text = normalise(jsonish(crm))

    # ---------------------------------------------------------- 0. hygiene
    crm.payment_reason = _clean_value(crm.payment_reason)
    crm.customer_request = _clean_value(crm.customer_request)
    crm.suggested_next_action = _clean_value(crm.suggested_next_action)
    crm.dispute_detail = _clean_value(crm.dispute_detail)
    crm.complaint_detail = _clean_value(crm.complaint_detail)
    crm.promised_amount = _clean_value(crm.promised_amount)
    crm.promised_amount_currency = _clean_value(crm.promised_amount_currency)
    crm.customer_language = _clean_value(crm.customer_language)

    has_commitment_language = _matches(COMMITMENT_PATTERNS, text)
    has_hedge = _matches(HEDGE_PATTERNS, text)

    # ------------------------------------- 1. never invent a commitment
    if crm.payment_commitment and not has_commitment_language:
        crm.payment_commitment = False
        report.flag(
            "payment_commitment_downgraded",
            "The model marked a payment commitment, but the transcript contains no "
            "explicit promise to pay. Commitment was reset to 'No'.",
        )
        if crm.payment_intention == "explicit_intent":
            crm.payment_intention = (
                "general_willingness" if has_hedge else "needs_more_time"
            )

    if crm.payment_commitment and has_hedge and not re.search(
        r"\b(i will|i'll|shall|promise|guarantee)\b", text
    ):
        crm.payment_commitment = False
        report.flag(
            "hedged_statement_not_commitment",
            "The customer used hedged language ('will try', 'let's see'). That is "
            "willingness, not an explicit commitment.",
        )

    # ---------------------------- 2. intention / commitment consistency
    if crm.payment_intention in {
        "general_willingness",
        "unclear",
        "no_statement",
        "unable_to_pay",
    } and crm.payment_commitment:
        crm.payment_commitment = False
        report.flag(
            "intention_commitment_conflict",
            "Payment intention and payment commitment contradicted each other; "
            "commitment was reset to 'No'.",
        )

    if not crm.payment_commitment and crm.payment_intention == "explicit_intent" and not has_commitment_language:
        crm.payment_intention = "general_willingness"
        report.flag(
            "intention_softened",
            "No explicit promise was found, so intention was recorded as general "
            "willingness rather than committed intent.",
        )

    # ------------------------------------------- 3. never invent an amount
    if crm.promised_amount:
        if not _mentions_amount(transcript, crm.promised_amount):
            report.flag(
                "promised_amount_removed",
                f"The reported amount ({crm.promised_amount}) could not be found in "
                "the transcript and was removed.",
            )
            crm.promised_amount = None
            crm.promised_amount_value = None
            crm.promised_amount_currency = None
        elif crm.promised_amount_value is not None:
            # Cross-check the numeric value against the verbatim phrase.
            claimed = _numbers_in(crm.promised_amount)
            if claimed and str(int(crm.promised_amount_value)) not in claimed:
                crm.promised_amount_value = None
                report.flag(
                    "amount_value_unverified",
                    "The numeric amount did not match the customer's own wording, so "
                    "only the verbatim phrase is shown.",
                )
    else:
        crm.promised_amount_value = None
        crm.promised_amount_currency = None

    # --------------------------------------------- 4. never invent a date
    if crm.promised_date is not None:
        phrase = crm.promised_date.original_phrase
        if not phrase:
            crm.promised_date = None
            report.flag(
                "promised_date_removed",
                "A promised date had no original customer phrase and was removed.",
            )
        else:
            if not _contains_phrase(transcript, phrase):
                crm.promised_date = PromisedDate(
                    original_phrase=phrase,
                    normalized_date=None,
                    confidence="low",
                    is_uncertain=True,
                    note=(
                        "The date phrase could not be located verbatim in the "
                        "transcript — verify with the customer."
                    ),
                )
                report.flag(
                    "promised_date_unverified",
                    "The promised date phrase was not found verbatim in the "
                    "transcript and is marked uncertain.",
                )
            else:
                if not any(keyword in text for keyword in DATE_KEYWORDS) and not re.search(
                    r"\b\d{1,2}(st|nd|rd|th)?\b", text
                ):
                    crm.promised_date.is_uncertain = True
                    crm.promised_date.confidence = "low"
                    report.flag(
                        "promised_date_no_reference",
                        "No clear date reference was detected in the transcript.",
                    )
                if crm.promised_date.is_uncertain or crm.promised_date.confidence != "high":
                    # An uncertain date must never be shown as a hard date.
                    crm.promised_date.normalized_date = None
                    crm.promised_date.is_uncertain = True
                    report.flag(
                        "promised_date_uncertain",
                        "The promised date is ambiguous; keep the customer's original "
                        "wording and confirm before acting on it.",
                    )
                    if not crm.payment_commitment:
                        report.flag(
                            "date_without_commitment",
                            "A date was mentioned but no explicit payment commitment "
                            "was made.",
                        )

    # ---------------------------------- 5. disputes and complaints evidence
    if crm.dispute_raised and not _matches(DISPUTE_PATTERNS, text):
        report.flag(
            "dispute_unverified",
            "A dispute was flagged but no dispute language was found in the "
            "transcript — verify manually.",
        )
        crm.human_review_required = True

    if crm.complaint_raised and not _matches(COMPLAINT_PATTERNS, text):
        report.flag(
            "complaint_unverified",
            "A complaint was flagged but no complaint language was found in the "
            "transcript — verify manually.",
        )
        crm.human_review_required = True

    # -------------------------------- 6. reverse check: missed flags
    if not crm.dispute_raised and _matches(DISPUTE_PATTERNS, text):
        crm.dispute_raised = True
        report.flag(
            "dispute_detected",
            "The transcript contains language consistent with a dispute; the flag "
            "was raised for human confirmation.",
        )
        crm.human_review_required = True

    if not crm.complaint_raised and _matches(COMPLAINT_PATTERNS, text):
        crm.complaint_raised = True
        report.flag(
            "complaint_detected",
            "The transcript contains language consistent with a complaint; the flag "
            "was raised for human confirmation.",
        )
        crm.human_review_required = True

    # ------------------------------------------------- 7. concessions guard
    concession_terms = re.search(
        r"\b(waiv\w+|write[- ]?off|settle(ment)? (at|for)|reduce|reduc\w+|discount|"
        r"revers\w+|leeway|emi plan|installment plan)\b",
        crm_text,
    )
    if concession_terms and not re.search(
        r"\b(waiv\w+|write[- ]?off|settle(ment)?|discount|reduc\w+|revers\w+|emi)\b",
        text,
    ):
        report.flag(
            "concession_not_approved",
            "A concession was mentioned in the model output but was not discussed "
            "by the customer. No concession is approved — a human must decide.",
        )
        crm.human_review_required = True

    # ------------------------------------------- 8. summary consistency
    summary = analysis.summary
    summary.narrative = (summary.narrative or "").strip()
    if not summary.narrative:
        summary.narrative = (
            "The transcript was processed, but the model did not produce a narrative "
            "summary. Review the original transcript."
        )
        report.flag("summary_missing", "No narrative summary was generated.")

    # A "confirmed" bullet is only demoted when it makes a *checkable* claim:
    #   * it asserts a number/amount that is absent from the transcript, or
    #   * it asserts a payment commitment while the transcript has no
    #     commitment language.
    # Summaries are legitimately written in English over code-mixed speech, so
    # pure lexical overlap is NOT used as evidence.
    demoted: list[str] = []
    kept: list[str] = []
    for item in summary.confirmed:
        item = item.strip()
        if not item:
            continue
        item_norm = normalise(item)
        claimed_numbers = _numbers_in(item)
        unsupported_number = bool(claimed_numbers) and not any(
            _mentions_amount(transcript, str(number)) for number in claimed_numbers
        )
        claims_commitment = bool(
            re.search(r"\b(commit|promise|agreed|confirmed to pay|will pay)\b", item_norm)
        ) and not has_commitment_language
        if unsupported_number or claims_commitment:
            demoted.append(item)
        else:
            kept.append(item)

    if demoted:
        summary.confirmed = kept
        summary.uncertain.extend(
            f"Possible interpretation (not verifiable in the transcript): {item}"
            for item in demoted
        )
        report.flag(
            "confirmed_statements_demoted",
            f"{len(demoted)} statement(s) were moved out of 'confirmed' because the "
            "amount or commitment they assert could not be verified in the transcript.",
        )

    # -------------------------------------------------- 9. confidence rules
    confidence_issues = {
        "payment_commitment_downgraded",
        "hedged_statement_not_commitment",
        "promised_amount_removed",
        "promised_date_unverified",
        "dispute_unverified",
        "complaint_unverified",
        "intention_commitment_conflict",
    }
    triggered = confidence_issues & set(report.applied_rules)
    if triggered:
        if len(triggered) >= 2:
            crm.confidence = "low"
        elif crm.confidence == "high":
            crm.confidence = "medium"
        elif crm.confidence == "medium":
            crm.confidence = "low"

    if not summary.confirmed:
        crm.confidence = "low"
        report.flag(
            "no_confirmed_facts",
            "No confirmed customer statements could be extracted.",
        )

    if not summary.missing:
        summary.missing = [
            "No explicit missing-information list was produced by the model; the "
            "agent should confirm amount, date and payment mode."
        ]

    if not summary.uncertain and (crm.promised_date and crm.promised_date.is_uncertain):
        summary.uncertain.append("The promised date is not fully unambiguous.")

    # ------------------------------------------- 10. human review decision
    if crm.confidence == "low":
        crm.human_review_required = True
        report.flag(
            "low_confidence_review",
            "Extraction confidence is low, so human review is required.",
        )
    if crm.payment_commitment and not crm.promised_date:
        crm.human_review_required = True
        report.flag(
            "commitment_without_date",
            "A commitment was recorded without a date; confirm the payment date "
            "before acting.",
        )
    if crm.payment_commitment or crm.dispute_raised or crm.complaint_raised:
        crm.human_review_required = True

    # Keep reasons de-duplicated and bounded.
    existing = [r for r in crm.human_review_reasons if r and r.strip()]
    merged: list[str] = []
    for reason in existing + report.review_reasons:
        if reason not in merged:
            merged.append(reason)
    crm.human_review_reasons = merged[:8]

    if not crm.human_review_required and merged:
        crm.human_review_required = True

    # ------------------------------------------------------- 11. script guard
    script_text = (analysis.response_script.text or "").strip()
    if not script_text:
        analysis.response_script.text = (
            "Namaste, thank you for speaking with us. We have noted your response "
            "and our team will review the details of your account and follow up "
            "with you. Please contact us if you need any clarification."
        )
        report.flag(
            "response_script_fallback",
            "The model did not return a response script, so a neutral, "
            "non-committal fallback is shown for agent review.",
        )
        crm.human_review_required = True

    banned = re.search(
        r"\b(legal action|court|police|arrest|seize|garnish|we will waive our rights)\b",
        normalise(analysis.response_script.text),
    )
    if banned:
        analysis.response_script.text = (
            "Thank you for your time. We have noted the details you shared and our "
            "team will review your account and get back to you."
        )
        report.flag(
            "script_sanitised",
            "The generated script contained threatening language and was replaced "
            "with a neutral version.",
        )
        crm.human_review_required = True

    return analysis, report.applied_rules


def jsonish(model) -> str:
    """Flatten a pydantic model into a searchable string."""
    try:
        return model.model_dump_json(exclude_none=True)
    except Exception:  # noqa: BLE001
        return str(model)
