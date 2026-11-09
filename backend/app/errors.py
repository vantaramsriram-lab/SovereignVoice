"""Typed service errors so the API layer can map failures to good HTTP codes."""

from __future__ import annotations

from typing import Optional


class IntegrationError(Exception):
    """Base class for any third-party integration failure."""

    service: str = "integration"
    http_status: int = 502

    def __init__(self, message: str, *, detail: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.detail = detail

    def to_payload(self) -> dict:
        payload = {
            "error": "integration_error",
            "service": self.service,
            "message": self.message,
        }
        if self.detail:
            payload["detail"] = self.detail
        return payload


class NotConfiguredError(IntegrationError):
    """Raised when credentials/endpoints for a service are missing."""

    http_status = 503

    def __init__(self, service: str, missing: list[str]):
        human = {
            "stt": "Gnani Prisma (STT)",
            "llm": "Groq (LLM)",
            "tts": "Gnani Timbre (TTS)",
        }.get(service, service)
        self.service = service
        self.missing = missing
        super().__init__(
            f"{human} is not configured on the backend. "
            f"Set {', '.join(missing)} in backend/.env and restart the API.",
        )

    def to_payload(self) -> dict:
        payload = super().to_payload()
        payload["error"] = "not_configured"
        payload["missing"] = self.missing
        return payload


class ProviderAuthError(IntegrationError):
    http_status = 502


class ProviderResponseError(IntegrationError):
    http_status = 502


class ProviderTimeoutError(IntegrationError):
    http_status = 504


class ProviderUnavailableError(IntegrationError):
    http_status = 503


class LlmOutputError(IntegrationError):
    """The model answered, but not with usable structured JSON."""

    service = "llm"
    http_status = 502

    def to_payload(self) -> dict:
        payload = super().to_payload()
        payload["error"] = "llm_output_invalid"
        payload["human_review_required"] = True
        return payload


class AudioValidationError(ValueError):
    """Raised when an uploaded payload is not usable audio (HTTP 422)."""
