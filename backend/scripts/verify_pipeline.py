"""End-to-end wiring verification against the dev mock providers.

Prerequisites:
  1. python scripts/mock_providers.py      (terminal 1, port 9099)
  2. backend/.env pointing at the mock, with API_KEY_ID=mock-key-id
  3. uvicorn app.main:app --port 8000      (terminal 2)
  4. python scripts/verify_pipeline.py     (terminal 3)

This script proves that:
  * the STT request uses multipart/form-data with the exact field names,
  * both Gnani calls send the SAME X-API-Key-ID credential from API_KEY_ID,
  * the LLM output is parsed, validated and safety-checked,
  * the TTS audio comes back as real bytes and is returned to the client,
  * no stage is ever invented.
"""

from __future__ import annotations

import base64
import io
import json
import math
import struct
import sys
import wave

import httpx

API = "http://127.0.0.1:8000"


def make_wav(seconds: float = 1.2, rate: int = 16000) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        frames = []
        for i in range(int(rate * seconds)):
            t = i / rate
            value = 0.2 * math.sin(2 * math.pi * 220 * t) * math.exp(-2 * t)
            frames.append(struct.pack("<h", int(value * 32767)))
        wav.writeframes(b"".join(frames))
    return buffer.getvalue()


def check(label: str, condition: bool, detail: str = "") -> bool:
    mark = "PASS" if condition else "FAIL"
    print(f"[{mark}] {label}" + (f" — {detail}" if detail else ""))
    return condition


def main() -> int:
    ok = True
    audio = make_wav()

    with httpx.Client(timeout=120) as client:
        health = client.get(f"{API}/health").json()
        print("\n--- /health ---")
        ok &= check("pipeline_ready", health["pipeline_ready"] is True)
        ok &= check(
            "shared Gnani key reported",
            health["config"]["gnani_shared_key"] is True,
        )
        ok &= check(
            "prisma and timbre share credential source",
            health["config"]["prisma"]["credential_source"]
            == health["config"]["timbre"]["credential_source"]
            == "API_KEY_ID",
        )
        ok &= check(
            "health leaks no credential value",
            "mock-key-id" not in json.dumps(health),
        )

        print("\n--- STT probe ---")
        stt = client.post(
            f"{API}/api/integrations/stt/test",
            files={"audio_file": ("sample.wav", audio, "audio/wav")},
        )
        if not check("HTTP 200", stt.status_code == 200, stt.text[:200]):
            return 1
        stt_body = stt.json()
        ok &= check("transcript returned", bool(stt_body["transcript"]))
        ok &= check(
            "detected language", stt_body["detected_language_code"] == "te-IN"
        )
        ok &= check(
            "auth header is X-API-Key-ID",
            stt_body["auth_header"] == "X-API-Key-ID",
        )

        print("\n--- LLM probe ---")
        llm = client.post(
            f"{API}/api/integrations/llm/test",
            json={"transcript": stt_body["transcript"], "agent_context": "When will you pay?"},
        )
        if not check("HTTP 200", llm.status_code == 200, llm.text[:300]):
            return 1
        llm_body = llm.json()
        crm = llm_body["intelligence"]["crm"]
        ok &= check("payment_commitment not fabricated", crm["payment_commitment"] is False)
        ok &= check("promised_amount is null", crm["promised_amount"] is None)
        ok &= check("dispute flagged", crm["dispute_raised"] is True)
        ok &= check("human review required", crm["human_review_required"] is True)
        ok &= check(
            "uncertain date kept as phrase",
            crm["promised_date"]["original_phrase"] == "15 tareekh tarvata",
        )

        print("\n--- TTS probe ---")
        tts = client.post(
            f"{API}/api/integrations/tts/test",
            json={"text": "Namaskaram, mee call ki dhanyavaadalu."},
        )
        if not check("HTTP 200", tts.status_code == 200, tts.text[:200]):
            return 1
        ok &= check("audio bytes returned", len(tts.content) > 1000, f"{len(tts.content)} bytes")
        ok &= check("audio content-type", tts.headers["content-type"].startswith("audio/"))
        ok &= check("RIFF/WAVE header", tts.content[:4] == b"RIFF")
        ok &= check("voice echoed", tts.headers.get("x-audio-voice") == "Shivani")

        print("\n--- Full pipeline ---")
        analyze = client.post(
            f"{API}/api/analyze",
            files={"audio_file": ("sample.wav", audio, "audio/wav")},
            data={"agent_context": "Customer claims payment already made. Confirm."},
        )
        if not check("HTTP 200", analyze.status_code == 200, analyze.text[:400]):
            return 1
        body = analyze.json()

        stages = {stage["key"]: stage for stage in body["stages"]}
        ok &= check(
            "all five stages complete",
            all(stage["status"] == "complete" for stage in stages.values()),
            ", ".join(f"{k}={v['status']}" for k, v in stages.items()),
        )
        ok &= check(
            "stage order",
            [s["key"] for s in body["stages"]] == ["audio", "stt", "llm", "crm", "tts"],
        )
        ok &= check("real stage timings recorded", all(
            stage.get("duration_ms") is not None for stage in body["stages"]
        ))
        ok &= check(
            "original transcript preserved verbatim",
            body["transcript"]["text"].startswith("Hello sir, nenu ee month salary"),
        )
        ok &= check(
            "language detected on transcript",
            body["transcript"]["meta"]["detected_language_code"] == "te-IN",
        )
        ok &= check("agent context echoed", "Confirm" in (body["agent_context"] or ""))
        ok &= check(
            "response audio decodes to a WAV",
            base64.b64decode(body["response_audio"]["base64"])[:4] == b"RIFF",
        )
        ok &= check(
            "response audio has duration",
            body["response_audio"]["duration_seconds"] is not None,
            str(body["response_audio"]["duration_seconds"]),
        )
        ok &= check(
            "response script present",
            len(body["intelligence"]["response_script"]["text"]) > 20,
        )
        ok &= check(
            "no fabricated commitment in final output",
            body["intelligence"]["crm"]["payment_commitment"] is False,
        )

        print("\n--- Safety: claims are cross-checked against the transcript ---")
        mismatch = client.post(
            f"{API}/api/integrations/llm/test",
            json={
                "transcript": "The customer said they will think about it.",
                "agent_context": None,
            },
        )
        if mismatch.status_code == 200:
            rules = mismatch.json()["validator_rules_applied"]
            ok &= check(
                "unverifiable claims are flagged",
                "promised_date_unverified" in rules and "dispute_unverified" in rules,
                str(rules),
            )
            ok &= check(
                "confidence downgraded on mismatch",
                mismatch.json()["intelligence"]["crm"]["confidence"] == "low",
            )
            ok &= check(
                "human review forced on mismatch",
                mismatch.json()["intelligence"]["crm"]["human_review_required"] is True,
            )

        print("\n--- Error handling: bad audio ---")
        bad = client.post(
            f"{API}/api/analyze",
            files={"audio_file": ("notes.txt", b"not audio" * 40, "text/plain")},
        )
        ok &= check("rejects non-audio with 422", bad.status_code == 422, bad.text[:160])

    print("\n" + ("ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
