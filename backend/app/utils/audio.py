"""Audio validation and lightweight container helpers.

No heavy audio decoding is required for the pipeline: the raw bytes are
forwarded to Gnani Prisma, and Timbre returns audio bytes that we pass
straight back to the browser.  We only need enough inspection to reject
obviously invalid uploads and to guess a sensible MIME type for playback.
"""

from __future__ import annotations

import io
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.errors import AudioValidationError  # re-exported for convenience

# Magic-number prefixes for the containers we accept.
_SIGNATURES: list[tuple[bytes, str, str]] = [
    (b"RIFF", "audio/wav", ".wav"),          # RIFF....WAVE
    (b"ID3", "audio/mpeg", ".mp3"),
    (b"\xff\xfb", "audio/mpeg", ".mp3"),
    (b"\xff\xf3", "audio/mpeg", ".mp3"),
    (b"OggS", "audio/ogg", ".ogg"),
    (b"fLaC", "audio/flac", ".flac"),
    (b"\x1aE\xdf\xa3", "audio/webm", ".webm"),  # Matroska / WebM
]


@dataclass
class AudioInfo:
    filename: str
    size_bytes: int
    extension: str
    mime_type: str
    duration_seconds: Optional[float] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "filename": self.filename,
            "size_bytes": self.size_bytes,
            "extension": self.extension,
            "mime_type": self.mime_type,
            "duration_seconds": self.duration_seconds,
            "sample_rate": self.sample_rate,
            "channels": self.channels,
        }


def _is_mp4_family(head: bytes) -> bool:
    # ISO base media file format: bytes 4..8 == 'ftyp' (m4a / mp4 / mov)
    return len(head) >= 12 and head[4:8] == b"ftyp"


def sniff_mime(data: bytes, filename: str) -> tuple[str, str]:
    """Return (mime_type, extension) using magic numbers, with a filename fallback."""
    head = data[:64]
    for signature, mime, ext in _SIGNATURES:
        if head.startswith(signature):
            if signature == b"RIFF" and head[8:12] != b"WAVE":
                continue
            return mime, ext
    if _is_mp4_family(head):
        return "audio/mp4", ".m4a"

    ext = Path(filename or "").suffix.lower()
    guess = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".mp4": "audio/mp4",
        ".ogg": "audio/ogg",
        ".webm": "audio/webm",
        ".flac": "audio/flac",
    }
    return guess.get(ext, "application/octet-stream"), ext


def _wav_metadata(data: bytes) -> tuple[Optional[float], Optional[int], Optional[int]]:
    try:
        with wave.open(io.BytesIO(data), "rb") as wav:
            frames = wav.getnframes()
            rate = wav.getframerate()
            channels = wav.getnchannels()
            duration = frames / float(rate) if rate else None
            return (
                round(duration, 2) if duration is not None else None,
                rate,
                channels,
            )
    except Exception:  # noqa: BLE001 - metadata is best-effort only
        return None, None, None


def inspect_audio(
    data: bytes,
    filename: str,
    allowed_extensions: list[str],
    max_bytes: int,
) -> AudioInfo:
    """Validate an uploaded audio payload and describe it."""
    if not data:
        raise AudioValidationError("The uploaded file is empty.")

    if len(data) > max_bytes:
        limit_mb = round(max_bytes / (1024 * 1024), 1)
        raise AudioValidationError(
            f"Audio file is too large ({len(data) / (1024 * 1024):.1f} MB). "
            f"The limit is {limit_mb} MB."
        )

    if len(data) < 128:
        raise AudioValidationError(
            "The uploaded file is too small to be a valid audio recording."
        )

    mime, ext = sniff_mime(data, filename)
    normalised_name = filename or f"audio{ext}"
    suffix = Path(normalised_name).suffix.lower()

    allowed = {e.lower() for e in allowed_extensions}
    if suffix and suffix not in allowed and ext not in allowed:
        raise AudioValidationError(
            f"Unsupported audio format '{suffix}'. "
            f"Supported formats: {', '.join(sorted(allowed))}."
        )

    if mime == "application/octet-stream":
        raise AudioValidationError(
            "The uploaded file does not look like a supported audio container "
            "(WAV, MP3, M4A, OGG, WEBM or FLAC)."
        )

    duration = rate = channels = None
    if mime == "audio/wav":
        duration, rate, channels = _wav_metadata(data)

    return AudioInfo(
        filename=normalised_name,
        size_bytes=len(data),
        extension=ext or suffix,
        mime_type=mime,
        duration_seconds=duration,
        sample_rate=rate,
        channels=channels,
    )


def detect_audio_container(data: bytes) -> tuple[str, str]:
    """Guess (mime_type, extension) of a TTS response body."""
    mime, ext = sniff_mime(data, "")
    if mime == "application/octet-stream":
        return "audio/wav", ".wav"
    return mime, ext


def content_type_for(data: bytes, hint: str | None = None) -> str:
    if hint and hint.startswith("audio/"):
        return hint
    mime, _ = detect_audio_container(data)
    return mime
