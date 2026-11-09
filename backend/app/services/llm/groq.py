"""Groq integration (OpenAI-compatible chat completions).

    POST https://api.groq.com/openai/v1/chat/completions
    {"model": "...", "messages": [...], "max_tokens": ..., "temperature": ...,
     "response_format": {"type": "json_object"}}
    -> choices[0].message.content

Provider-specific behaviour stays here; the rest of the app only calls
``analyse()`` and never knows which LLM vendor is behind it.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Optional

import httpx
from pydantic import ValidationError

from app.config import settings
from app.errors import (
    LlmOutputError,
    NotConfiguredError,
    ProviderAuthError,
    ProviderResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from app.schemas.responses import LlmAnalysis
from app.services.llm.prompts import messages_for

logger = logging.getLogger(__name__)

SERVICE = "llm"


@dataclass
class LlmResult:
    analysis: LlmAnalysis
    raw_text: str
    repaired: bool


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json|JSON)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _first_json_object(text: str) -> Optional[str]:
    """Extract the first balanced JSON object from arbitrary model output."""
    text = _strip_fences(text)
    start = text.find("{")
    while start != -1:
        depth = 0
        in_string = False
        escaped = False
        for index in range(start, len(text)):
            char = text[index]
            if in_string:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    in_string = False
                continue
            if char == '"':
                in_string = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return text[start : index + 1]
        start = text.find("{", start + 1)
    return None


def _coerce_keys(payload: dict) -> dict:
    """Normalise well-known alternate shapes produced by small models."""
    if not isinstance(payload, dict):
        return payload

    if "intelligence" in payload and isinstance(payload["intelligence"], dict):
        inner = payload["intelligence"]
        payload = {
            "summary": inner.get("summary", payload.get("summary")),
            "crm": inner.get("crm", payload.get("crm")),
            "response_script": inner.get(
                "response_script", payload.get("response_script")
            ),
        }

    if "customer_intelligence" in payload and "crm" not in payload:
        payload["crm"] = payload.pop("customer_intelligence")

    if "summary" in payload and isinstance(payload["summary"], str):
        payload["summary"] = {"narrative": payload["summary"]}

    if "response" in payload and "response_script" not in payload:
        payload["response_script"] = payload.pop("response")

    crm = payload.get("crm")
    if isinstance(crm, dict):
        # Normalise a few common small-model deviations.
        if "payment_commitment" in crm and isinstance(crm["payment_commitment"], str):
            crm["payment_commitment"] = crm["payment_commitment"].strip().lower() in {
                "true",
                "yes",
                "y",
                "1",
            }
        if isinstance(crm.get("promised_date"), str):
            phrase = crm["promised_date"].strip()
            crm["promised_date"] = (
                {
                    "original_phrase": phrase,
                    "normalized_date": None,
                    "confidence": "low",
                    "is_uncertain": True,
                    "note": "Returned as a bare phrase by the model.",
                }
                if phrase and phrase.lower() not in {"null", "none", "n/a"}
                else None
            )
        for key in (
            "payment_reason",
            "promised_amount",
            "customer_request",
            "suggested_next_action",
            "dispute_detail",
            "complaint_detail",
        ):
            value = crm.get(key)
            if isinstance(value, str) and value.strip().lower() in {
                "null",
                "none",
                "n/a",
                "na",
                "not mentioned",
                "not specified",
                "unknown",
                "not stated",
                "not available",
            }:
                crm[key] = None
    return payload


def parse_analysis(raw_text: str) -> tuple[LlmAnalysis, bool]:
    """Parse model output into a validated ``LlmAnalysis``."""
    candidate = _first_json_object(raw_text)
    if not candidate:
        raise LlmOutputError(
            "The language model did not return a JSON object.",
            detail=raw_text.strip()[:400],
        )
    try:
        payload: Any = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise LlmOutputError(
            "The language model returned malformed JSON.",
            detail=f"{exc.msg} at position {exc.pos}. Raw: {candidate[:300]}",
        ) from exc

    payload = _coerce_keys(payload)
    try:
        analysis = LlmAnalysis.model_validate(payload)
    except ValidationError as exc:
        raise LlmOutputError(
            "The language model returned JSON that does not match the required schema.",
            detail="; ".join(
                f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}"
                for err in exc.errors()[:6]
            ),
        ) from exc

    repaired = _strip_fences(raw_text) != _strip_fences(candidate)
    return analysis, repaired


_THINK_RE = re.compile(r"<think>.*?</think>", re.S | re.I)


def _clean_content(content: str) -> str:
    """Remove Qwen-style <think>...</think> reasoning that may precede the JSON."""
    content = _THINK_RE.sub("", content)
    # Unclosed think block (output cut off): drop everything up to the first brace.
    if "<think>" in content.lower():
        content = content[content.find("{"):] if "{" in content else ""
    return content.strip()


async def _post_chat(client: httpx.AsyncClient, messages: list[dict]) -> str:
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload: dict = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "max_tokens": settings.GROQ_MAX_TOKENS,
        "temperature": settings.GROQ_TEMPERATURE,
        "top_p": 0.9,
        "stream": False,
        "response_format": {"type": "json_object"},
    }
    if settings.GROQ_REASONING_FORMAT:
        # "hidden" keeps reasoning out of message.content (Qwen3 on Groq).
        payload["reasoning_format"] = settings.GROQ_REASONING_FORMAT

    response = await client.post(
        settings.GROQ_API_URL, headers=headers, json=payload, timeout=settings.GROQ_TIMEOUT
    )
    # Some models reject JSON mode or reasoning_format: retry once without them.
    if response.status_code == 400:
        text = (response.text or "").lower()
        if "response_format" in text or "reasoning_format" in text:
            logger.warning("Groq rejected an optional parameter; retrying without it.")
            payload.pop("response_format", None)
            payload.pop("reasoning_format", None)
            response = await client.post(
                settings.GROQ_API_URL,
                headers=headers,
                json=payload,
                timeout=settings.GROQ_TIMEOUT,
            )
    _raise_for_status(response)
    body = response.json()
    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ProviderResponseError(
            "Groq returned an unexpected chat-completions payload.",
            detail=" ".join(str(body).split())[:300],
        ) from exc
    if not isinstance(content, str) or not _clean_content(content):
        raise LlmOutputError("Groq returned an empty completion.")
    return _clean_content(content)


def _raise_for_status(response: httpx.Response) -> None:
    if response.status_code in (401, 403):
        raise ProviderAuthError(
            "Groq rejected the API key.",
            detail="Check GROQ_API_KEY (create one at console.groq.com/keys).",
        )
    if response.status_code == 404:
        raise ProviderResponseError(
            "Groq could not find the configured model or endpoint.",
            detail=f"HTTP 404 from {settings.GROQ_API_URL}. Check GROQ_MODEL.",
        )
    if response.status_code == 429:
        raise ProviderUnavailableError(
            "Groq rate limit reached for this key (free tier limits apply)."
        )
    if response.status_code >= 400:
        raise ProviderResponseError(
            f"Groq returned HTTP {response.status_code}.",
            detail=" ".join((response.text or "").split())[:400],
        )


async def analyse(
    transcript: str,
    agent_context: Optional[str] = None,
    detected_language_code: Optional[str] = None,
    client: Optional[httpx.AsyncClient] = None,
) -> LlmResult:
    """Run the conservative BFSI analysis over a transcript."""
    if not settings.llm_configured:
        raise NotConfiguredError(SERVICE, ["GROQ_API_KEY", "GROQ_MODEL", "GROQ_API_URL"])

    messages = messages_for(transcript, agent_context, detected_language_code)

    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=settings.GROQ_TIMEOUT)
    try:
        logger.info(
            "Groq request -> %s (model=%s, chars=%d)",
            settings.GROQ_API_URL,
            settings.GROQ_MODEL,
            len(transcript),
        )
        raw_text = await _post_chat(client, messages)
    except httpx.TimeoutException as exc:
        raise ProviderTimeoutError(
            "Groq did not respond in time.",
            detail=f"Timeout after {settings.GROQ_TIMEOUT}s.",
        ) from exc
    except httpx.RequestError as exc:
        raise ProviderUnavailableError(
            "Could not reach Groq.", detail=str(exc)
        ) from exc
    finally:
        if owns_client:
            await client.aclose()

    if not raw_text or not raw_text.strip():
        raise LlmOutputError("Groq returned an empty completion.")

    analysis, repaired = parse_analysis(raw_text)
    return LlmResult(analysis=analysis, raw_text=raw_text, repaired=repaired)
