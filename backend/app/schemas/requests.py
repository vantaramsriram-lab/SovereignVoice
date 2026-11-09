"""Request schemas for the individual integration probes."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class TtsProbeRequest(BaseModel):
    """Body for POST /api/integrations/tts/test."""

    text: str = Field(min_length=1, max_length=1200)
    voice: Optional[str] = None
    speed: Optional[float] = Field(default=None, ge=0.5, le=2.0)
    language: Optional[str] = None


class LlmProbeRequest(BaseModel):
    """Body for POST /api/integrations/llm/test."""

    transcript: str = Field(min_length=1, max_length=4000)
    agent_context: Optional[str] = Field(default=None, max_length=2000)


class AudioConfigSchema(BaseModel):
    """Mirrors the ``audio_config`` block accepted by Gnani Timbre."""

    sample_rate: int = 48000
    num_channels: int = 1
    sample_width: int = 2
    encoding: str = "linear_pcm"
    container: str = "wav"
