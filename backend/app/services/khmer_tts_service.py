"""Remote HTTP API client for external Khmer TTS providers (optional API-key integration)."""
from __future__ import annotations

import os
from typing import Optional

import requests
from flask import current_app


def synthesize_khmer_speech(text: str, *, timeout: float = 15.0) -> Optional[tuple[bytes, str]]:
    """
    Call an external Khmer TTS HTTP API when configured (`KHMER_TTS_API_URL` or `KHMER_TTS_URL`).

    Supports bearer authentication via `KHMER_TTS_API_KEY` (or `HF_TOKEN`).
    Returns `(audio_bytes, mimetype)` on success, or None to use standard fallback TTS.
    """
    clean = (text or "").strip()
    if not clean:
        return None

    api_url = (
        os.getenv("KHMER_TTS_API_URL")
        or os.getenv("KHMER_TTS_URL")
        or ""
    ).strip()
    if not api_url:
        return None

    headers = {"Content-Type": "application/json"}
    api_key = (
        os.getenv("KHMER_TTS_API_KEY")
        or os.getenv("HF_TOKEN")
        or ""
    ).strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    target_url = api_url if api_url.endswith("/synthesize") else f"{api_url.rstrip('/')}/synthesize"
    try:
        resp = requests.post(
            target_url,
            json={"text": clean, "inputs": clean},
            headers=headers,
            timeout=timeout,
        )
        if resp.status_code == 200 and resp.content and len(resp.content) > 64:
            mime = resp.headers.get("Content-Type", "audio/mpeg").split(";", 1)[0].strip()
            if mime.startswith("audio/"):
                return resp.content, mime
            return resp.content, "audio/mpeg"
    except Exception as exc:  # noqa: BLE001
        try:
            current_app.logger.debug("External Khmer TTS API unavailable: %s", exc)
        except RuntimeError:
            pass

    return None
