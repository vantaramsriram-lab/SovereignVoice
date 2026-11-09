"""
Centralised configuration for the SovereignVoice backend.

Design rules (see README):
  * Exactly ONE Gnani credential exists: ``API_KEY_ID``.
    Both Prisma (STT) and Timbre (TTS) read this same value and send it
    through the ``X-API-Key-ID`` header.
  * Groq (the LLM) keeps its own key (``GROQ_API_KEY``) because it is a
    different provider with a different authentication scheme.
  * No credential is ever exposed to the frontend or returned by /health.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _str(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _int(name: str, default: int) -> int:
    try:
        return int(_str(name) or default)
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(_str(name) or default)
    except ValueError:
        return default


def _bool(name: str, default: bool = False) -> bool:
    raw = _str(name).lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _list(name: str, default: List[str]) -> List[str]:
    raw = _str(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings:
    """Immutable-ish settings object built from environment variables."""

    # ---------------------------------------------------------------- app
    APP_NAME: str = "SovereignVoice API"
    APP_VERSION: str = "1.0.0"

    # -------------------------------------------------- Gnani (shared key)
    # SINGLE credential shared by Prisma STT and Timbre TTS.
    API_KEY_ID: str = _str("API_KEY_ID")
    GNANI_KEY_HEADER: str = "X-API-Key-ID"

    # ---------------------------------------------------------- Prisma STT
    PRISMA_API_URL: str = _str("PRISMA_API_URL", "https://api.vachana.ai/stt/v3")
    PRISMA_MODEL: str = _str("PRISMA_MODEL", "prisma-v3.0")
    PRISMA_LANGUAGE_CODE: str = _str("PRISMA_LANGUAGE_CODE", "indic-auto")
    PRISMA_TIMEOUT: float = _float("PRISMA_TIMEOUT", 60.0)

    # ---------------------------------------------------------- Timbre TTS
    TIMBRE_API_URL: str = _str(
        "TIMBRE_API_URL", "https://api.vachana.ai/api/v1/tts/inference"
    )
    TIMBRE_MODEL: str = _str("TIMBRE_MODEL", "timbre-v3.0")
    TIMBRE_VOICE: str = _str("TIMBRE_VOICE", "Shivani")
    TIMBRE_LANGUAGE: str = _str("TIMBRE_LANGUAGE", "auto")
    TIMBRE_SPEED: float = _float("TIMBRE_SPEED", 1.0)
    TIMBRE_SAMPLE_RATE: int = _int("TIMBRE_SAMPLE_RATE", 48000)
    TIMBRE_NUM_CHANNELS: int = _int("TIMBRE_NUM_CHANNELS", 1)
    TIMBRE_SAMPLE_WIDTH: int = _int("TIMBRE_SAMPLE_WIDTH", 2)
    TIMBRE_ENCODING: str = _str("TIMBRE_ENCODING", "linear_pcm")
    TIMBRE_CONTAINER: str = _str("TIMBRE_CONTAINER", "wav")
    TIMBRE_TIMEOUT: float = _float("TIMBRE_TIMEOUT", 120.0)

    # ------------------------------------------------------------- Groq LLM
    GROQ_API_KEY: str = _str("GROQ_API_KEY")
    GROQ_MODEL: str = _str("GROQ_MODEL", "qwen/qwen3.8-27b")
    GROQ_API_URL: str = _str(
        "GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions"
    )
    GROQ_MAX_TOKENS: int = _int("GROQ_MAX_TOKENS", 1600)
    GROQ_TEMPERATURE: float = _float("GROQ_TEMPERATURE", 0.2)
    GROQ_TIMEOUT: float = _float("GROQ_TIMEOUT", 90.0)
    # Qwen3 on Groq is a reasoning model; "hidden" keeps <think> out of the reply.
    # Set empty (GROQ_REASONING_FORMAT=) if your model does not support it.
    GROQ_REASONING_FORMAT: str = _str("GROQ_REASONING_FORMAT", "hidden")

    # --------------------------------------------------------------- http
    REQUEST_TIMEOUT: float = _float("REQUEST_TIMEOUT", 90.0)
    MAX_AUDIO_BYTES: int = _int("MAX_AUDIO_BYTES", 25 * 1024 * 1024)
    ALLOWED_AUDIO_EXTENSIONS: List[str] = _list(
        "ALLOWED_AUDIO_EXTENSIONS", [".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac"]
    )

    # --------------------------------------------------------------- cors
    CORS_ORIGINS: List[str] = _list(
        "CORS_ORIGINS",
        [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ],
    )

    # ------------------------------------------------------------ logging
    LOG_LEVEL: str = _str("LOG_LEVEL", "INFO")
    DEBUG: bool = _bool("DEBUG", False)

    # ---------------------------------------------------- derived helpers
    @property
    def gnani_configured(self) -> bool:
        """True when the single shared Gnani key is present."""
        return bool(self.API_KEY_ID)

    @property
    def prisma_configured(self) -> bool:
        # Prisma has no credential of its own: it reuses API_KEY_ID.
        return self.gnani_configured

    @property
    def timbre_configured(self) -> bool:
        # Timbre has no credential of its own: it reuses API_KEY_ID.
        return self.gnani_configured

    @property
    def llm_configured(self) -> bool:
        return bool(self.GROQ_API_KEY and self.GROQ_MODEL and self.GROQ_API_URL)

    def public_status(self) -> dict:
        """Credential-free view of the integration configuration."""
        return {
            "gnani_api_key_configured": self.gnani_configured,
            "gnani_auth_header": self.GNANI_KEY_HEADER,
            "gnani_shared_key": True,
            "prisma": {
                "configured": self.prisma_configured,
                "endpoint": self.PRISMA_API_URL,
                "model": self.PRISMA_MODEL,
                "language_code": self.PRISMA_LANGUAGE_CODE,
                "auth_header": self.GNANI_KEY_HEADER,
                "credential_source": "API_KEY_ID",
            },
            "timbre": {
                "configured": self.timbre_configured,
                "endpoint": self.TIMBRE_API_URL,
                "model": self.TIMBRE_MODEL,
                "voice": self.TIMBRE_VOICE,
                "language": self.TIMBRE_LANGUAGE,
                "speed": self.TIMBRE_SPEED,
                "auth_header": self.GNANI_KEY_HEADER,
                "credential_source": "API_KEY_ID",
            },
            "llm": {
                "configured": self.llm_configured,
                "provider": "groq",
                "model_id": self.GROQ_MODEL or None,
                "endpoint": self.GROQ_API_URL or None,
                "credential_source": "GROQ_API_KEY",
            },
            "limits": {
                "max_audio_bytes": self.MAX_AUDIO_BYTES,
                "allowed_extensions": self.ALLOWED_AUDIO_EXTENSIONS,
            },
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
