"""Gnani Timbre TTS integration.

Reference (supplied screenshot):
    POST https://api.vachana.ai/api/v1/tts/inference
    Header: X-API-Key-ID: <API_KEY_ID>       <-- SAME shared Gnani credential
    application/json:
        {
          "text": "...",
          "model": "timbre-v3.0",
          "language": "auto",
          "voice": "Shivani",
          "speed": 1.0,
          "audio_config": {
            "sample_rate": 48000, "num_channels": 1, "sample_width": 2,
            "encoding": "linear_pcm", "container": "wav"
          }
        }

The screenshot shows HTTP 200 with a rendered audio player, which means the
endpoint returns *audio bytes*, not JSON.  We therefore:

  * send ``Accept: audio/*`` and read ``response.content``;
  * if the provider instead returns JSON (some deployments proxy base64 or a
    URL), we extract ``audio_base64`` / ``audio`` / ``audio_url`` defensively;
  * never assume JSON and never fabricate audio.

Exact response shape still needs verification against a live key — documented
in README ("Known limitations").
"""

from __future__ import annotations

import base64
import io
import logging
import wave
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
from app.utils.audio import content_type_for, sniff_mime

logger = logging.getLogger(__name__)

SERVICE = "tts"


@dataclass
class TimbreResult:
    audio_bytes: bytes
    mime_type: str
    extension: str
    duration_seconds: Optional[float]
    voice: str
    language: str
    raw_meta: dict


def build_payload(
    text: str,
    *,
    voice: Optional[str] = None,
    speed: Optional[float] = None,
    language: Optional[str] = None,
) -> dict:
    """Assemble the exact request body shown in the reference screenshot."""
    return {
        "text": text,
        "model": settings.TIMBRE_MODEL,
        "language": language or settings.TIMBRE_LANGUAGE,
        "voice": voice or settings.TIMBRE_VOICE,
        "speed": float(speed if speed is not None else settings.TIMBRE_SPEED),
        "audio_config": {
            "sample_rate": settings.TIMBRE_SAMPLE_RATE,
            "num_channels": settings.TIMBRE_NUM_CHANNELS,
            "sample_width": settings.TIMBRE_SAMPLE_WIDTH,
            "encoding": settings.TIMBRE_ENCODING,
            "container": settings.TIMBRE_CONTAINER,
        },
    }


def _wav_duration(data: bytes) -> Optional[float]:
    try:
        with wave.open(io.BytesIO(data), "rb") as wav:
            rate = wav.getframerate() or 0
            if not rate:
                return None
            return round(wav.getnframes() / float(rate), 2)
    except Exception:  # noqa: BLE001
        return None


def _from_json(payload: dict) -> Optional[tuple[bytes, Optional[str]]]:
    """Pull audio bytes out of a JSON body if the deployment wraps them."""
    for key in ("audio_base64", "audio", "audio_content", "base64", "data"):
        value = payload.get(key)
        if isinstance(value, str) and len(value) > 64:
            try:
                decoded = base64.b64decode(value, validate=False)
                if len(decoded) > 128:
                    return decoded, payload.get("mime_type") or payload.get("format")
            except Exception:  # noqa: BLE001
                continue
    url = payload.get("audio_url")
    if isinstance(url, str) and url.startswith("http"):
        raise ProviderResponseError(
            "Gnani Timbre returned an audio URL instead of audio bytes.",
            detail=(
                "This deployment wraps the audio in a URL. Enable URL download "
                "support or request raw audio output from the provider."
            ),
        )
    return None


async def synthesize(
    text: str,
    *,
    voice: Optional[str] = None,
    speed: Optional[float] = None,
    language: Optional[str] = None,
    client: Optional[httpx.AsyncClient] = None,
) -> TimbreResult:
    """Convert text into speech using Gnani Timbre."""
    if not settings.timbre_configured:
        raise NotConfiguredError(SERVICE, ["API_KEY_ID"])

    payload = build_payload(text, voice=voice, speed=speed, language=language)
    headers = {
        settings.GNANI_KEY_HEADER: settings.API_KEY_ID,
        "Content-Type": "application/json",
        "Accept": "audio/wav, audio/mpeg, audio/ogg, application/json;q=0.5",
    }

    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=settings.TIMBRE_TIMEOUT)

    try:
        logger.info(
            "Timbre TTS request -> %s (voice=%s, language=%s, chars=%d)",
            settings.TIMBRE_API_URL,
            payload["voice"],
            payload["language"],
            len(text),
        )
        response = await client.post(
            settings.TIMBRE_API_URL,
            headers=headers,
            json=payload,
            timeout=settings.TIMBRE_TIMEOUT,
        )
    except httpx.TimeoutException as exc:
        raise ProviderTimeoutError(
            "Gnani Timbre did not respond in time.",
            detail=f"Timeout after {settings.TIMBRE_TIMEOUT}s.",
        ) from exc
    except httpx.RequestError as exc:
        raise ProviderUnavailableError(
            "Could not reach Gnani Timbre.", detail=str(exc)
        ) from exc
    finally:
        if owns_client:
            await client.aclose()

    if response.status_code in (401, 403):
        raise ProviderAuthError(
            "Gnani Timbre rejected the credentials.",
            detail=(
                "Timbre uses the same API_KEY_ID as Prisma, sent via the "
                "X-API-Key-ID header. Confirm that single key is valid."
            ),
        )
    if response.status_code == 429:
        raise ProviderUnavailableError("Gnani Timbre rate limit reached.")
    if response.status_code >= 400:
        raise ProviderResponseError(
            f"Gnani Timbre returned HTTP {response.status_code}.",
            detail=" ".join((response.text or "").split())[:400],
        )

    declared = (response.headers.get("content-type") or "").lower()
    audio_bytes: bytes
    extension_hint: Optional[str] = None

    if "application/json" in declared:
        try:
            body = response.json()
        except ValueError as exc:
            raise ProviderResponseError(
                "Gnani Timbre returned unreadable JSON."
            ) from exc
        found = _from_json(body if isinstance(body, dict) else {})
        if not found:
            raise ProviderResponseError(
                "Gnani Timbre returned JSON without audio content.",
                detail=" ".join(str(body).split())[:300],
            )
        audio_bytes, extension_hint = found
    else:
        audio_bytes = response.content
        extension_hint = declared or None

    if not audio_bytes or len(audio_bytes) < 128:
        raise ProviderResponseError(
            "Gnani Timbre returned an empty or truncated audio payload."
        )

    mime_type = content_type_for(audio_bytes, extension_hint)
    if mime_type == "application/octet-stream":
        mime_type = "audio/wav"
    _, extension = sniff_mime(audio_bytes, "")
    if extension in ("", ".bin"):
        extension = ".wav"

    duration = _wav_duration(audio_bytes) if extension == ".wav" else None

    return TimbreResult(
        audio_bytes=audio_bytes,
        mime_type=mime_type,
        extension=extension,
        duration_seconds=duration,
        voice=payload["voice"],
        language=payload["language"],
        raw_meta={
            "content_type": declared or None,
            "size_bytes": len(audio_bytes),
            "model": payload["model"],
        },
    )
