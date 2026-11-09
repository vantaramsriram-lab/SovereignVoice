"""The end-to-end SovereignVoice pipeline.

    customer audio
        -> Gnani Prisma STT            (transcript, verbatim)
        -> Llama 3.2 3B Instruct       (structured intelligence + script)
        -> CRM validator               (financial-safety gate)
        -> Gnani Timbre TTS            (localized response audio)
        -> AnalysisResponse

Every stage reports real status. Nothing is faked: if a stage fails, the
exception propagates and the API returns an explicit error for that stage.
"""

from __future__ import annotations

import base64
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.errors import IntegrationError
from app.schemas.responses import (
    AnalysisResponse,
    AudioPayload,
    StageStatus,
    TranscriptMeta,
    TranscriptResult,
)
from app.services.crm.validator import validate_analysis
from app.services.llm.groq import analyse
from app.services.stt.prisma import transcribe
from app.services.tts.timbre import synthesize
from app.utils.audio import AudioInfo

logger = logging.getLogger(__name__)

STAGE_LABELS = {
    "audio": "Processing customer audio",
    "stt": "Transcribing with Gnani Prisma",
    "llm": "Understanding conversation with Llama",
    "crm": "Generating customer intelligence",
    "tts": "Generating localized response with Gnani Timbre",
}


def _initial_stages() -> list[StageStatus]:
    return [
        StageStatus(key=key, label=label, status="pending")
        for key, label in STAGE_LABELS.items()
    ]


class PipelineTrace:
    """Tracks real stage timings so the UI can show genuine progress."""

    def __init__(self) -> None:
        self.stages = {stage.key: stage for stage in _initial_stages()}

    def start(self, key: str) -> float:
        self.stages[key].status = "running"
        return time.perf_counter()

    def complete(self, key: str, started: float, detail: Optional[str] = None) -> None:
        stage = self.stages[key]
        stage.status = "complete"
        stage.duration_ms = int((time.perf_counter() - started) * 1000)
        if detail:
            stage.detail = detail

    def fail(self, key: str, started: float, detail: str) -> None:
        stage = self.stages[key]
        stage.status = "error"
        stage.duration_ms = int((time.perf_counter() - started) * 1000)
        stage.detail = detail

    def skip(self, key: str, detail: str) -> None:
        self.stages[key].status = "skipped"
        stage_detail = detail
        self.stages[key].detail = stage_detail

    def as_list(self) -> list[StageStatus]:
        return list(self.stages.values())


async def run_pipeline(
    audio_bytes: bytes,
    filename: str,
    mime_type: str,
    audio_info: AudioInfo,
    agent_context: Optional[str],
) -> AnalysisResponse:
    trace = PipelineTrace()

    # ------------------------------------------------ stage 1: audio intake
    started = trace.start("audio")
    trace.complete(
        "audio",
        started,
        detail=(
            f"{audio_info.extension.lstrip('.').upper()} · "
            f"{round(audio_info.size_bytes / 1024, 1)} KB"
            + (
                f" · {audio_info.duration_seconds}s"
                if audio_info.duration_seconds
                else ""
            )
        ),
    )

    # ------------------------------------------------------ stage 2: Prisma
    started = trace.start("stt")
    try:
        prisma = await transcribe(audio_bytes, filename, mime_type)
    except IntegrationError as exc:
        trace.fail("stt", started, exc.message)
        raise
    except Exception as exc:  # noqa: BLE001
        trace.fail("stt", started, "Unexpected transcription failure")
        logger.exception("Unexpected STT failure")
        raise IntegrationError(
            "Transcription failed unexpectedly.", detail=str(exc)
        ) from exc
    trace.complete(
        "stt",
        started,
        detail=(
            f"{len(prisma.transcript)} chars"
            + (f" · {prisma.detected_language_code}" if prisma.detected_language_code else "")
        ),
    )

    transcript = TranscriptResult(
        text=prisma.transcript,  # verbatim, never rewritten downstream
        meta=TranscriptMeta(**prisma.to_meta()),
        audio=audio_info.to_dict(),
    )

    # --------------------------------------------------------- stage 3: LLM
    started = trace.start("llm")
    try:
        llm = await analyse(
            transcript=prisma.transcript,
            agent_context=agent_context,
            detected_language_code=prisma.detected_language_code,
        )
    except IntegrationError as exc:
        trace.fail("llm", started, exc.message)
        raise
    except Exception as exc:  # noqa: BLE001
        trace.fail("llm", started, "Unexpected language-model failure")
        logger.exception("Unexpected LLM failure")
        raise IntegrationError(
            "Conversation understanding failed unexpectedly.", detail=str(exc)
        ) from exc
    trace.complete(
        "llm",
        started,
        detail=f"{settings.GROQ_MODEL.split('/')[-1]}"
        + (" · repaired output" if llm.repaired else ""),
    )

    # --------------------------------------------------------- stage 4: CRM
    started = trace.start("crm")
    try:
        analysis, applied_rules = validate_analysis(llm.analysis, prisma.transcript)
    except Exception as exc:  # noqa: BLE001
        trace.fail("crm", started, "Validation failure")
        logger.exception("Unexpected CRM validation failure")
        raise IntegrationError(
            "Customer intelligence could not be validated.", detail=str(exc)
        ) from exc
    trace.complete(
        "crm",
        started,
        detail=(
            f"{len(applied_rules)} safety check(s) applied"
            if applied_rules
            else "No safety corrections needed"
        ),
    )

    # --------------------------------------------------------- stage 5: TTS
    started = trace.start("tts")
    script_text = analysis.response_script.text
    try:
        # Voice / language / speed come from the backend configuration so that
        # the browser can never influence provider parameters.
        timbre = await synthesize(script_text)
    except IntegrationError as exc:
        trace.fail("tts", started, exc.message)
        raise
    except Exception as exc:  # noqa: BLE001
        trace.fail("tts", started, "Unexpected speech-synthesis failure")
        logger.exception("Unexpected TTS failure")
        raise IntegrationError(
            "Localized response generation failed unexpectedly.", detail=str(exc)
        ) from exc
    trace.complete(
        "tts",
        started,
        detail=f"{timbre.voice} · {timbre.extension.lstrip('.').upper()} · "
        f"{round(len(timbre.audio_bytes) / 1024, 1)} KB",
    )

    response_audio = AudioPayload(
        mime_type=timbre.mime_type,
        extension=timbre.extension,
        duration_seconds=timbre.duration_seconds,
        voice=timbre.voice,
        language=timbre.language,
        base64=base64.b64encode(timbre.audio_bytes).decode("ascii"),
        size_bytes=len(timbre.audio_bytes),
    )

    return AnalysisResponse(
        analysis_id=str(uuid.uuid4()),
        created_at=datetime.now(timezone.utc).isoformat(),
        agent_context=agent_context or None,
        input_audio=audio_info.to_dict(),
        transcript=transcript,
        intelligence=analysis,
        response_audio=response_audio,
        stages=trace.as_list(),
    )
