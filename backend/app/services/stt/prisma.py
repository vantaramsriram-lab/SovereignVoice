"""Gnani Prisma STT integration.

Reference (supplied screenshot):
    POST https://api.vachana.ai/stt/v3
    Header: X-API-Key-ID: <API_KEY_ID>       <-- shared Gnani credential
    multipart/form-data:
        audio_file     -> the uploaded audio
        model          -> prisma-v3.0
        language_code  -> indic-auto

Example success payload:
    {"success": true, "request_id": "...", "transcript": "...",
     "model": "prisma-v3.0", "processing_time": 0.34,
     "end_to_end_latency": 0.34, "detected_language_code": "te-IN"}

No additional request parameters are invented.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from app.config import settings
from app.errors import (
    NotConfiguredError,
    ProviderAuthError,
    ProviderResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)

logger = logging.getLogger(__name__)

SERVICE = "stt"


@dataclass
class PrismaResult:
    transcript: str
    detected_language_code: Optional[str]
    model: Optional[str]
    request_id: Optional[str]
    processing_time: Optional[float]
    raw: dict

    def to_meta(self) -> dict:
        return {
            "detected_language_code": self.detected_language_code,
            "model": self.model,
            "provider_request_id": self.request_id,
            "processing_time": self.processing_time,
        }


def _extract_transcript(payload: dict) -> Optional[str]:
    """The screenshot shows ``transcript``; tolerate a couple of aliases."""
    for key in ("transcript", "text", "transcription"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value
    # Some variants nest the result.
    for key in ("data", "result", "output"):
        nested = payload.get(key)
        if isinstance(nested, dict):
            found = _extract_transcript(nested)
            if found:
                return found
    return None


async def transcribe(
    audio_bytes: bytes,
    filename: str,
    mime_type: str,
    client: Optional[httpx.AsyncClient] = None,
) -> PrismaResult:
    """Send audio to Gnani Prisma and return the verbatim transcript."""
    if not settings.prisma_configured:
        raise NotConfiguredError(SERVICE, ["API_KEY_ID"])

    headers = {settings.GNANI_KEY_HEADER: settings.API_KEY_ID}
    # Let httpx set the multipart boundary; we only supply the parts.
    files = {
        "audio_file": (filename, audio_bytes, mime_type or "application/octet-stream"),
    }
    data = {
        "model": settings.PRISMA_MODEL,
        "language_code": settings.PRISMA_LANGUAGE_CODE,
    }

    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=settings.PRISMA_TIMEOUT)

    try:
        logger.info(
            "Prisma STT request -> %s (model=%s, language_code=%s, bytes=%d)",
            settings.PRISMA_API_URL,
            data["model"],
            data["language_code"],
            len(audio_bytes),
        )
        response = await client.post(
            settings.PRISMA_API_URL,
            headers=headers,
            files=files,
            data=data,
            timeout=settings.PRISMA_TIMEOUT,
        )
    except httpx.TimeoutException as exc:
        raise ProviderTimeoutError(
            "Gnani Prisma did not respond in time.",
            detail=f"Timeout after {settings.PRISMA_TIMEOUT}s.",
        ) from exc
    except httpx.RequestError as exc:
        raise ProviderUnavailableError(
            "Could not reach Gnani Prisma.", detail=str(exc)
        ) from exc
    finally:
        if owns_client:
            await client.aclose()

    if response.status_code in (401, 403):
        raise ProviderAuthError(
            "Gnani Prisma rejected the credentials.",
            detail=(
                "Verify that API_KEY_ID contains a valid Gnani API Key ID; it is "
                "sent in the X-API-Key-ID header and shared with Gnani Timbre."
            ),
        )
    if response.status_code == 429:
        raise ProviderUnavailableError(
            "Gnani Prisma rate limit reached. Try again shortly."
        )
    if response.status_code >= 400:
        raise ProviderResponseError(
            f"Gnani Prisma returned HTTP {response.status_code}.",
            detail=_safe_body(response),
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise ProviderResponseError(
            "Gnani Prisma returned a non-JSON response.",
            detail=_safe_body(response),
        ) from exc

    if not isinstance(payload, dict):
        raise ProviderResponseError("Gnani Prisma returned an unexpected payload.")

    if payload.get("success") is False:
        raise ProviderResponseError(
            "Gnani Prisma reported that transcription failed.",
            detail=str(payload.get("message") or payload.get("error") or ""),
        )

    transcript = _extract_transcript(payload)
    if not transcript:
        raise ProviderResponseError(
            "Gnani Prisma returned no transcript.",
            detail="The response did not contain a non-empty 'transcript' field.",
        )

    return PrismaResult(
        transcript=transcript.strip(),
        detected_language_code=payload.get("detected_language_code")
        or payload.get("language_code"),
        model=payload.get("model") or settings.PRISMA_MODEL,
        request_id=payload.get("request_id"),
        processing_time=payload.get("processing_time")
        or payload.get("end_to_end_latency"),
        raw=payload,
    )


def _safe_body(response: httpx.Response, limit: int = 400) -> str:
    text = (response.text or "").strip()
    text = " ".join(text.split())
    return text[:limit]
