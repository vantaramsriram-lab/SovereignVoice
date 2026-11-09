"""DEV-ONLY mock provider server — for verifying wiring, never for demos.

This file exists so a developer can test the *plumbing* (multipart field names,
the X-API-Key-ID header, JSON body shape, binary audio handling, error paths)
without spending real provider credits.

It is NOT part of the application and is never imported by the app. The
SovereignVoice product must always talk to the real providers; the app will
report a clear configuration error rather than fall back to this mock.

Usage (PowerShell):
    cd backend
    python scripts/mock_providers.py            # listens on :9099

Then point the backend .env at it and restart uvicorn:
    API_KEY_ID=mock-key-id
    PRISMA_API_URL=http://127.0.0.1:9099/stt/v3
    TIMBRE_API_URL=http://127.0.0.1:9099/api/v1/tts/inference
    GROQ_API_KEY=mock-key
    GROQ_API_URL=http://127.0.0.1:9099/v1/chat/completions

Run the checks in scripts/verify_pipeline.py to confirm the pipeline end to end.
"""

from __future__ import annotations

import json
import math
import struct
import wave
from io import BytesIO
from typing import Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import Response

app = FastAPI(title="SovereignVoice mock providers (dev only)")

REQUIRED_HEADER = "X-API-Key-ID"

MOCK_TRANSCRIPT = (
    "Hello sir, nenu ee month salary vachaka pay chestanu ani cheppanu. "
    "Kaani naa account lo already paid ani chupistondi, adi tappu. "
    "Please check cheyandi, naaku 15 tareekh tarvata matrame possible."
)

MOCK_LLM_JSON = {
    "summary": {
        "narrative": (
            "The customer states they can only pay after their salary arrives this "
            "month and that the account incorrectly shows a payment as already made. "
            "They ask for the records to be checked and mention the 15th as the "
            "earliest possible date, without an explicit promise to pay."
        ),
        "confirmed": [
            "Customer says payment is only possible after this month's salary.",
            "Customer states the account wrongly shows a payment as already made.",
            "Customer asks for the records to be checked.",
        ],
        "inferred": [
            "The customer appears to be disputing the recorded payment status.",
        ],
        "missing": [
            "No payment amount was stated.",
            "No explicit commitment to pay on a specific date was made.",
        ],
        "uncertain": [
            "The phrase '15 tareekh tarvata' may mean after the 15th rather than on the 15th.",
        ],
    },
    "crm": {
        "customer_language": "Telugu (code-mixed with English)",
        "payment_reason": "Waiting for this month's salary",
        "payment_intention": "needs_more_time",
        "payment_commitment": False,
        "promised_amount": None,
        "promised_amount_value": None,
        "promised_amount_currency": None,
        "promised_date": {
            "original_phrase": "15 tareekh tarvata",
            "normalized_date": None,
            "confidence": "low",
            "is_uncertain": True,
            "note": "Relative phrase; could mean on or after the 15th.",
        },
        "customer_request": "Check why the account shows the payment as already made.",
        "sentiment": "frustrated",
        "suggested_next_action": (
            "Have a human agent verify the payment posting history and call back to "
            "confirm a specific payment date."
        ),
        "dispute_raised": True,
        "dispute_detail": "Customer says the account wrongly shows the payment as paid.",
        "complaint_raised": False,
        "complaint_detail": None,
        "confidence": "medium",
        "human_review_required": True,
        "human_review_reasons": ["Dispute raised", "Payment date is ambiguous"],
    },
    "response_script": {
        "text": (
            "Namaskaram, mee call ki dhanyavaadalu. Mee account lo payment status "
            "gurinchi memu check chestamu. Dayachesi 15 tareekh tarvata ready ga "
            "unte, oka spastamaina date cheppandi, memu aa date ki follow up "
            "chestamu."
        ),
        "language": "Telugu",
        "tone": "professional, empathetic, non-threatening",
    },
}


def _require_key(value: Optional[str]) -> None:
    if not value:
        raise HTTPException(
            status_code=401,
            detail=f"Missing {REQUIRED_HEADER} header.",
        )
    if value != "mock-key-id":
        raise HTTPException(status_code=403, detail="Invalid mock key.")


def _silence_wav(seconds: float = 1.6, rate: int = 48000) -> bytes:
    buffer = BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        frames = []
        for i in range(int(rate * seconds)):
            t = i / rate
            value = 0.12 * math.sin(2 * math.pi * 180 * t) * math.exp(-1.5 * t)
            frames.append(struct.pack("<h", int(value * 32767)))
        wav.writeframes(b"".join(frames))
    return buffer.getvalue()


@app.post("/stt/v3")
async def stt(
    audio_file: UploadFile = File(...),
    model: str = Form(...),
    language_code: str = Form(...),
    x_api_key_id: Optional[str] = Header(default=None, alias=REQUIRED_HEADER),
):
    _require_key(x_api_key_id)
    payload = await audio_file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="audio_file is empty")
    # Assert the exact request shape from the reference screenshot.
    assert model == "prisma-v3.0", f"unexpected model {model}"
    assert language_code == "indic-auto", f"unexpected language_code {language_code}"
    return {
        "success": True,
        "request_id": "mock-0f1a2b3c",
        "transcript": MOCK_TRANSCRIPT,
        "model": model,
        "processing_time": 0.34,
        "end_to_end_latency": 0.35,
        "detected_language_code": "te-IN",
    }


@app.post("/v1/chat/completions")
async def chat(request: Request, authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer mock-key"):
        raise HTTPException(status_code=401, detail="Invalid mock Groq key")
    body = await request.json()
    assert body["model"], "model is required"
    assert body["messages"][0]["role"] == "system"
    return {
        "id": "mock-completion",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "```json\n" + json.dumps(MOCK_LLM_JSON) + "\n```",
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 100, "completion_tokens": 200},
    }


@app.post("/api/v1/tts/inference")
async def tts(request: Request, x_api_key_id: Optional[str] = Header(default=None, alias=REQUIRED_HEADER)):
    _require_key(x_api_key_id)
    body = await request.json()
    for field in ("text", "model", "language", "voice", "speed", "audio_config"):
        assert field in body, f"missing {field} in TTS body"
    assert set(body["audio_config"]) == {
        "sample_rate",
        "num_channels",
        "sample_width",
        "encoding",
        "container",
    }, "audio_config shape mismatch"
    return Response(content=_silence_wav(), media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn

    print("DEV-ONLY mock providers on http://127.0.0.1:9099 — never use in a demo.")
    uvicorn.run(app, host="127.0.0.1", port=9099, log_level="warning")
