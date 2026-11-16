from __future__ import annotations

import base64
import binascii
import hashlib
import os
import re
from typing import Any

import requests
from cryptography.fernet import Fernet, InvalidToken
from flask import current_app

GEMINI_TTS_MODEL = "gemini-3.8-flash-tts"
GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
GEMINI_API_REVISION = "2026-05-20"
DEFAULT_TTS_VOICE = "Kore"
ALLOWED_TTS_VOICES = ("Kore", "Puck", "Zephyr", "Charon", "Aoede", "Sulafat")

_ENC_PREFIX = "enc:v1:"
_KEY_PATTERN = re.compile(r"^AIza[A-Za-z0-9_\-]{16,116}$")


def _get_cipher() -> Fernet:
    """Derive a stable Fernet cipher from Flask's SECRET_KEY without storing separate key files."""
    secret = ""
    try:
        secret = str(current_app.config.get("SECRET_KEY") or "")
    except RuntimeError:
        secret = ""
    if not secret:
        secret = os.getenv("SECRET_KEY", "") or "agri-system-local-tts-fallback"

    digest = hashlib.sha256(f"agri:gemini-tts:{secret}".encode("utf-8")).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    return Fernet(fernet_key)


def _safe_log_warning(message: str, *args: Any) -> None:
    try:
        current_app.logger.warning(message, *args)
    except RuntimeError:
        pass


def validate_gemini_api_key_format(raw_key: str | None) -> tuple[bool, str | None]:
    """Validate basic Google AI Studio Gemini API key shape before encrypting and saving."""
    key = (raw_key or "").strip()
    if not key:
        return False, "Please enter a Gemini API key."
    if any(ch.isspace() for ch in key):
        return False, "Gemini API keys cannot contain spaces or line breaks."
    if not _KEY_PATTERN.fullmatch(key):
        return (
            False,
            "Invalid Gemini API key format. Google AI Studio keys start with 'AIza' and use 20–120 URL-safe characters.",
        )
    return True, None


def encrypt_user_api_key(raw_key: str | None) -> str:
    """Encrypt a personal Gemini API key for storage inside User.ai_api_key (<=255 chars)."""
    key = (raw_key or "").strip()
    if not key:
        return ""
    if key.startswith(_ENC_PREFIX):
        return key
    token = _get_cipher().encrypt(key.encode("utf-8")).decode("ascii")
    encrypted = f"{_ENC_PREFIX}{token}"
    if len(encrypted) > 255:
        raise ValueError("Encrypted Gemini API key exceeds database column limit.")
    return encrypted


def decrypt_user_api_key(stored_value: str | None) -> str | None:
    """Decrypt a stored User.ai_api_key value; returns None if empty or unreadable."""
    value = (stored_value or "").strip()
    if not value:
        return None
    if value.startswith(_ENC_PREFIX):
        token = value[len(_ENC_PREFIX) :].encode("ascii")
        try:
            plain = _get_cipher().decrypt(token).decode("utf-8").strip()
            return plain or None
        except (InvalidToken, UnicodeDecodeError, ValueError):
            _safe_log_warning("Unable to decrypt stored Gemini TTS API key.")
            return None
    if value.startswith("enc:"):
        return None
    return value


def mask_api_key(stored_value: str | None) -> str | None:
    """Return a display-safe masked preview of a saved Gemini API key (never full secret)."""
    plain = decrypt_user_api_key(stored_value)
    if not plain:
        return None
    if len(plain) <= 10:
        return f"••••{plain[-4:]}" if len(plain) > 4 else "••••"
    return f"{plain[:6]}••••••••{plain[-4:]}"


def _extract_audio_from_interactions_response(payload: Any) -> tuple[bytes, str] | None:
    """Extract base64 WAV/audio bytes from the Interactions API model_output step."""
    if not isinstance(payload, dict):
        return None

    last_audio_block: dict[str, Any] | None = None
    for step in payload.get("steps") or []:
        if not isinstance(step, dict) or step.get("type") != "model_output":
            continue
        for block in step.get("content") or []:
            if isinstance(block, dict) and block.get("type") == "audio" and block.get("data"):
                last_audio_block = block

    if not last_audio_block:
        return None

    raw_data = last_audio_block.get("data")
    if not isinstance(raw_data, str) or not raw_data.strip():
        return None

    try:
        audio_bytes = base64.b64decode(raw_data, validate=True)
    except (binascii.Error, ValueError):
        return None

    if not audio_bytes:
        return None

    raw_mime = str(last_audio_block.get("mime_type") or "audio/wav")
    mime_type = raw_mime.split(";")[0].strip() or "audio/wav"
    return audio_bytes, mime_type


def synthesize_gemini_tts(
    text: str,
    *,
    api_key: str | None,
    lang: str = "km",
    voice: str = DEFAULT_TTS_VOICE,
    timeout: float = 20.0,
) -> tuple[bytes, str] | None:
    """Synthesize speech with gemini-3.8-flash-tts via the Gemini Interactions API."""
    clean_text = (text or "").strip()[:900]
    clean_key = (api_key or "").strip()
    if not clean_text or not clean_key:
        return None

    selected_voice = voice if voice in ALLOWED_TTS_VOICES else DEFAULT_TTS_VOICE
    style = (
        "Speak clearly, warmly, and naturally in Khmer at a comfortable listening pace."
        if lang == "km"
        else "Speak clearly, warmly, and naturally in English at a comfortable listening pace."
    )

    payload = {
        "model": GEMINI_TTS_MODEL,
        "input": [
            {
                "type": "user_input",
                "content": [
                    {
                        "type": "text",
                        "text": clean_text,
                        "annotations": [
                            {
                                "type": "speech_metadata",
                                "style": style,
                            }
                        ],
                    }
                ],
            }
        ],
        "response_format": {"type": "audio"},
        "generation_config": {
            "speech_config": [{"voice": selected_voice}],
        },
    }

    headers = {
        "x-goog-api-key": clean_key,
        "Content-Type": "application/json",
        "Api-Revision": GEMINI_API_REVISION,
    }

    try:
        resp = requests.post(
            GEMINI_INTERACTIONS_URL,
            headers=headers,
            json=payload,
            timeout=timeout,
        )
    except requests.RequestException as exc:
        _safe_log_warning("Gemini TTS Interactions request failed: %s", type(exc).__name__)
        return None

    if resp.status_code != 200:
        _safe_log_warning("Gemini TTS Interactions API returned HTTP %s", resp.status_code)
        return None

    try:
        data = resp.json()
    except ValueError:
        _safe_log_warning("Gemini TTS Interactions API returned non-JSON body.")
        return None

    return _extract_audio_from_interactions_response(data)
