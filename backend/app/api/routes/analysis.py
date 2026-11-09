"""Analysis endpoint + independent integration probes.

Routes
------
POST /api/analyze                     full pipeline (audio -> intelligence -> audio)
POST /api/integrations/stt/test       Prisma only (upload audio -> transcript)
POST /api/integrations/llm/test       Llama only (transcript -> structured intelligence)
POST /api/integrations/tts/test       Timbre only (text -> audio bytes)
GET  /api/integrations/status         credential-free configuration snapshot
"""

from __future__ import annotations

import base64
import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from app.config import settings
from app.errors import AudioValidationError
from app.schemas.requests import LlmProbeRequest, TtsProbeRequest
from app.schemas.responses import AnalysisResponse
from app.services.crm.validator import validate_analysis
from app.services.llm.groq import analyse
from app.services.pipeline import run_pipeline
from app.services.stt.prisma import transcribe
from app.services.tts.timbre import synthesize
from app.utils.audio import inspect_audio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["analysis"])


async def _read_and_validate(file: UploadFile):
    raw = await file.read()
    try:
        return raw, inspect_audio(
            raw,
            file.filename or "audio",
            settings.ALLOWED_AUDIO_EXTENSIONS,
            settings.MAX_AUDIO_BYTES,
        )
    except AudioValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    summary="Run the full SovereignVoice voice-intelligence pipeline",
)
async def analyze(
    audio_file: UploadFile = File(..., description="Customer audio recording"),
    agent_context: Optional[str] = Form(
        default=None,
        description="Optional collection-agent question or additional context",
    ),
) -> AnalysisResponse:
    raw, info = await _read_and_validate(audio_file)
    context = (agent_context or "").strip() or None
    if context and len(context) > 2000:
        raise HTTPException(
            status_code=422,
            detail="Agent context must be 2000 characters or fewer.",
        )

    logger.info(
        "Analyze request: %s (%s, %d bytes) context=%s",
        info.filename,
        info.mime_type,
        info.size_bytes,
        bool(context),
    )
    return await run_pipeline(
        audio_bytes=raw,
        filename=info.filename,
        mime_type=info.mime_type,
        audio_info=info,
        agent_context=context,
    )


# --------------------------------------------------------------- probes


@router.get("/integrations/status", summary="Credential-free integration status")
async def integration_status() -> dict:
    return settings.public_status()


@router.post(
    "/integrations/stt/test",
    summary="Test Gnani Prisma STT on its own",
)
async def test_stt(audio_file: UploadFile = File(...)) -> dict:
    raw, info = await _read_and_validate(audio_file)
    result = await transcribe(raw, info.filename, info.mime_type)
    return {
        "ok": True,
        "service": "prisma-stt",
        "endpoint": settings.PRISMA_API_URL,
        "auth_header": settings.GNANI_KEY_HEADER,
        "model": result.model,
        "language_code_sent": settings.PRISMA_LANGUAGE_CODE,
        "detected_language_code": result.detected_language_code,
        "provider_request_id": result.request_id,
        "processing_time": result.processing_time,
        "transcript": result.transcript,
        "input_audio": info.to_dict(),
    }


@router.post(
    "/integrations/llm/test",
    summary="Test the Groq LLM + the CRM validator on their own",
)
async def test_llm(payload: LlmProbeRequest) -> dict:
    result = await analyse(
        transcript=payload.transcript,
        agent_context=payload.agent_context,
    )
    validated, rules = validate_analysis(result.analysis, payload.transcript)
    return {
        "ok": True,
        "service": "groq-llm",
        "model": settings.GROQ_MODEL,
        "endpoint": settings.GROQ_API_URL,
        "validator_rules_applied": rules,
        "intelligence": validated.model_dump(),
        "raw_model_output": result.raw_text,
    }


@router.post(
    "/integrations/tts/test",
    summary="Test Gnani Timbre TTS on its own (returns audio bytes)",
    response_class=Response,
)
async def test_tts(payload: TtsProbeRequest) -> Response:
    result = await synthesize(
        payload.text,
        voice=payload.voice,
        speed=payload.speed,
        language=payload.language,
    )
    return Response(
        content=result.audio_bytes,
        media_type=result.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="timbre-probe{result.extension}"',
            "X-Audio-Voice": result.voice,
            "X-Audio-Language": result.language,
            "X-Audio-Size": str(len(result.audio_bytes)),
        },
    )


@router.post(
    "/integrations/tts/test-json",
    summary="Same as the TTS probe but returns base64 JSON (convenient for scripts)",
)
async def test_tts_json(payload: TtsProbeRequest) -> dict:
    result = await synthesize(
        payload.text,
        voice=payload.voice,
        speed=payload.speed,
        language=payload.language,
    )
    return {
        "ok": True,
        "service": "timbre-tts",
        "endpoint": settings.TIMBRE_API_URL,
        "auth_header": settings.GNANI_KEY_HEADER,
        "voice": result.voice,
        "language": result.language,
        "mime_type": result.mime_type,
        "duration_seconds": result.duration_seconds,
        "size_bytes": len(result.audio_bytes),
        "audio_base64": base64.b64encode(result.audio_bytes).decode("ascii"),
    }

# IntegrationError is converted to an HTTP response by the app-level handler
# registered in main.py, so no per-route try/except is needed here.
