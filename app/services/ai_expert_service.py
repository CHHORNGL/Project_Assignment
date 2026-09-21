"""Remote inference client for the trained agricultural assistant.

The Flask process never loads model weights. It sends a bounded prompt to a
separately hosted Hugging Face endpoint and normalizes common response shapes
used by Text Generation Inference, Spaces, and OpenAI-compatible gateways.
"""

from __future__ import annotations

import os
from typing import Any, Optional
from urllib.parse import urlparse

import requests
from flask import current_app


DEFAULT_TIMEOUT_SECONDS = 30.0
MAX_CONTEXT_CHARS = 12_000
MAX_MESSAGE_CHARS = 4_000


def _setting(name: str, default: str = "") -> str:
    """Read runtime settings, preferring the protected admin configuration.

    A saved value allows an admin change to persist across Railway restarts.
    If it has not been saved in the admin screen, normal deployment
    environment variables remain the fallback.
    """
    try:
        from app.models.site_setting import SiteSetting

        aliases = {
            "HF_TOKEN": ("HF_API_KEY", "HF_TOKEN"),
            "HUGGINGFACEHUB_API_TOKEN": ("HF_API_KEY", "HF_TOKEN"),
        }
        keys = aliases.get(name, (name,))
        for key in keys:
            saved = SiteSetting.query.get(key)
            if saved and saved.value and saved.value.strip():
                return saved.value.strip()
    except Exception:
        # Settings lookup must never prevent the chat endpoint from starting.
        pass

    try:
        configured = current_app.config.get(name)
        if configured is not None and str(configured).strip():
            return str(configured).strip()
    except RuntimeError:
        pass
    configured = os.getenv(name, "").strip()
    if configured:
        return configured

    return default.strip()


def legacy_fallback_enabled() -> bool:
    """Whether farmer chat may fall back to a legacy hosted provider."""
    return _setting("AI_LEGACY_FALLBACK_ENABLED", "true").lower() in {
        "1", "true", "yes", "on"
    }


def is_huggingface_provider() -> bool:
    return _setting("AI_PROVIDER", "").lower() in {
        "huggingface", "hf", "hugging_face"
    }


def is_valid_inference_endpoint(endpoint: str) -> bool:
    """Reject a Hugging Face model-page URL; it cannot perform inference."""
    parsed = urlparse((endpoint or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    return parsed.hostname not in {"huggingface.co", "www.huggingface.co"}


def is_configured() -> bool:
    provider = _setting("AI_PROVIDER", "").lower()
    endpoint = _setting("HF_INFERENCE_URL") or _setting("HUGGINGFACE_INFERENCE_URL")
    return (
        provider in {"huggingface", "hf", "hugging_face"}
        and is_valid_inference_endpoint(endpoint)
    )


def _endpoint() -> str:
    return _setting("HF_INFERENCE_URL") or _setting("HUGGINGFACE_INFERENCE_URL")


def _timeout() -> float:
    raw = _setting("AI_REQUEST_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS))
    try:
        return max(2.0, min(float(raw), 120.0))
    except (TypeError, ValueError):
        return DEFAULT_TIMEOUT_SECONDS


def _language_name(language: Optional[str]) -> str:
    return "Khmer" if (language or "").lower() in {"km", "kh", "khmer"} else "English"


def _build_prompt(message: str, context: str, language: Optional[str]) -> str:
    language_name = _language_name(language)
    bounded_message = message.strip()[:MAX_MESSAGE_CHARS]
    bounded_context = (context or "No matching knowledge-base context was found.").strip()
    bounded_context = bounded_context[:MAX_CONTEXT_CHARS]
    return (
        "You are AgriSystem AI, a careful agricultural assistant. "
        f"Answer in {language_name}. Use only the knowledge-base context below; "
        "do not invent pesticide doses, diagnoses, or guarantees. If the context "
        "is insufficient, say that more information or a local expert is needed. "
        "Give concise, practical advice and mention uncertainty when appropriate.\n\n"
        f"Knowledge-base context:\n{bounded_context}\n\n"
        f"Farmer question:\n{bounded_message}\n\nAnswer:\n"
    )


def _extract_text(payload: Any) -> str:
    if isinstance(payload, list):
        if not payload:
            return ""
        return _extract_text(payload[0])
    if isinstance(payload, dict):
        for key in ("generated_text", "response", "text", "answer", "content"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        choices = payload.get("choices")
        if isinstance(choices, list) and choices:
            return _extract_text(choices[0].get("message", choices[0]))
    return ""


def _remove_prompt_echo(reply: str, prompt: str) -> str:
    cleaned = reply.strip()
    if cleaned.startswith(prompt):
        cleaned = cleaned[len(prompt):].strip()
    if "\nAnswer:\n" in cleaned:
        cleaned = cleaned.rsplit("\nAnswer:\n", 1)[-1].strip()
    return cleaned


def generate_reply(
    user_message: str,
    *,
    context: str = "",
    language: Optional[str] = None,
) -> Optional[str]:
    """Generate a reply through the configured remote model.

    Returns ``None`` when the Hugging Face provider is not configured or when
    the request fails. Callers can then use the existing provider fallback.
    """
    if not user_message or not is_configured():
        return None

    endpoint = _endpoint()
    token = _setting("HF_TOKEN") or _setting("HUGGINGFACEHUB_API_TOKEN")
    prompt = _build_prompt(user_message, context, language)
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    # This is the standard Text Generation Inference payload. A custom Space
    # can accept the same fields and return {"generated_text": "..."}.
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 600,
            "temperature": 0.25,
            "top_p": 0.9,
            "return_full_text": False,
        },
    }
    try:
        response = requests.post(
            endpoint,
            json=payload,
            headers=headers,
            timeout=_timeout(),
        )
        response.raise_for_status()
        reply = _remove_prompt_echo(_extract_text(response.json()), prompt)
        return reply or None
    except (requests.RequestException, ValueError) as exc:
        try:
            current_app.logger.warning("Remote agricultural AI request failed: %s", exc)
        except RuntimeError:
            pass
        return None
