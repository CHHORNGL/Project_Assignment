"""Remote inference client for the trained agricultural assistant.

The Flask process never loads model weights. It sends a bounded prompt to a
separately hosted Hugging Face endpoint and normalizes common response shapes
used by Text Generation Inference, Spaces, and OpenAI-compatible gateways.
"""

from __future__ import annotations

import os
import json
import re
from typing import Any, Optional
from urllib.parse import urlparse

import requests
from flask import current_app


DEFAULT_TIMEOUT_SECONDS = 30.0
# Keep enough retrieval context and generation budget for complete agricultural
# answers while retaining a hard upper bound for the remote request.
MAX_CONTEXT_CHARS = 8_000
MAX_MESSAGE_CHARS = 4_000


def _active_model_profile() -> dict[str, str] | None:
    """Return the admin-selected trained-model profile, if one exists."""
    try:
        from app.models.site_setting import SiteSetting

        raw = SiteSetting.query.get("HF_MODELS")
        if not raw or not raw.value:
            return None
        profiles = json.loads(raw.value)
        if not isinstance(profiles, list):
            return None
        active_setting = SiteSetting.query.get("HF_ACTIVE_MODEL")
        active_id = active_setting.value.strip() if active_setting and active_setting.value else ""
        for profile in profiles:
            if not isinstance(profile, dict):
                continue
            if active_id and profile.get("id") == active_id:
                return profile
        for profile in profiles:
            if isinstance(profile, dict) and profile.get("active"):
                return profile
        return next((p for p in profiles if isinstance(p, dict)), None)
    except Exception:
        return None


def _setting(name: str, default: str = "") -> str:
    """Read runtime settings, preferring the protected admin configuration.

    A saved value allows an admin change to persist across backend restarts.
    If it has not been saved in the admin screen, normal deployment
    environment variables remain the fallback.
    """
    # A selected profile overrides the legacy single-model settings. Secrets
    # remain in their own protected SiteSetting rather than in the JSON list.
    if name in {"HF_MODEL_ID", "HF_INFERENCE_URL", "HF_TOKEN"}:
        profile = _active_model_profile()
        if profile:
            if name == "HF_MODEL_ID":
                value = str(profile.get("model_id") or "").strip()
                if value:
                    return value
            elif name == "HF_INFERENCE_URL":
                value = str(profile.get("endpoint") or "").strip()
                if value:
                    return value
            else:
                try:
                    from app.models.site_setting import SiteSetting

                    token_key = str(profile.get("token_key") or "").strip()
                    token_setting = SiteSetting.query.get(token_key) if token_key else None
                    if token_setting and token_setting.value and token_setting.value.strip():
                        return token_setting.value.strip()
                except Exception:
                    pass

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


def is_gradio_endpoint(endpoint: str) -> bool:
    """Return whether an endpoint is a public Gradio Space/API URL."""
    parsed = urlparse((endpoint or "").strip())
    hostname = (parsed.hostname or "").lower()
    path = parsed.path.rstrip("/")
    return hostname.endswith(".hf.space") or "/gradio_api/call/" in path or "/call/" in path


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
        return max(2.0, min(float(raw), 180.0))
    except (TypeError, ValueError):
        return DEFAULT_TIMEOUT_SECONDS


def _is_khmer(language: Optional[str], text: str = "") -> bool:
    if (language or "").lower() in {"km", "kh", "khmer"}:
        return True
    return bool(re.search(r"[\u1780-\u17ff]", text))


def _language_name(language: Optional[str]) -> str:
    return "Khmer" if (language or "").lower() in {"km", "kh", "khmer"} else "English"


def _build_prompt(message: str, context: str, language: Optional[str]) -> str:
    bounded_message = message.strip()[:MAX_MESSAGE_CHARS]
    if _is_khmer(language, message):
        bounded_context = (context or "រកមិនឃើញព័ត៌មាននៅក្នុងមូលដ្ឋានចំណេះដឹងទេ។").strip()[:MAX_CONTEXT_CHARS]
        return (
            "អ្នកគឺជា AgriSystem AI (ម៉ូឌែលឈ្មោះ AGY V2.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ "
            "អ្នកគឺជាអ្នកជំនាញកសិកម្មដ៏រួសរាយ រាក់ទាក់ សុជីវធម៌ និងមានវិជ្ជាជីវៈខ្ពស់ដូចមនុស្សពិតប្រាកដ។ "
            "ប្រសិនបើអ្នកប្រើប្រាស់សួរអំពីអត្តសញ្ញាណរបស់អ្នក អ្នកណាបង្កើតអ្នក ឬម៉ូឌែលឈ្មោះអ្វី សូមបញ្ជាក់ដោយច្បាស់លាស់ថា អ្នកគឺជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ "
            "ប្រសិនបើអ្នកប្រើប្រាស់គ្រាន់តែស្វាគមន៍ គួរសម ឬសួរសួស្តី (ដូចជា សួស្តី, ជំរាបសួរ, Hello) សូមឆ្លើយតបស្វាគមន៍ដោយរាក់ទាក់ ហើយសួរថាតើមានបញ្ហាដំណាំ ឬការងារកសិកម្មអ្វីដែលអ្នកអាចជួយបាន។ "
            "សូមឆ្លើយជាភាសាខ្មែរឱ្យបានត្រឹមត្រូវ ច្បាស់លាស់ រលូន និងមានលក្ខណៈវិជ្ជាជីវៈជានិច្ច។ "
            "សម្រាប់ការសាកសួរអំពីបច្ចេកទេសកសិកម្ម សូមប្រើប្រាស់ព័ត៌មានពីបរិបទចំណេះដឹងខាងក្រោម។ "
            "កុំបង្កើតកម្រិតថ្នាំគីមី ឬការធ្វើរោគវិនិច្ឆ័យដោយគ្មានមូលដ្ឋានច្បាស់លាស់។ "
            "ប្រសិនបើព័ត៌មានកសិកម្មមិនគ្រប់គ្រាន់ សូមបញ្ជាក់ និងណែនាំឱ្យកសិករពិគ្រោះជាមួយអ្នកជំនាញកសិកម្មក្នុងតំបន់។ "
            "ផ្តល់ចម្លើយពេញលេញ រៀបចំជាចំណុច និងអនុវត្តបានជាក់ស្តែង។ សម្រាប់សំណួរដែលស្មុគស្មាញ សូមរួមបញ្ចូលសេចក្តីសង្ខេប មូលហេតុដែលអាចកើតមាន ជំហានអនុវត្ត ការប្រុងប្រយ័ត្ន និងពេលណាត្រូវពិគ្រោះអ្នកជំនាញ។ កុំកាត់ចម្លើយមុនពេលឆ្លើយគ្រប់ផ្នែកនៃសំណួរ។\n\n"
            f"បរិបទចំណេះដឹងកសិកម្ម៖\n{bounded_context}\n\n"
            f"សំណួររបស់កសិករ៖\n{bounded_message}\n\n"
            "ចម្លើយ៖\n"
        )

    language_name = _language_name(language)
    bounded_context = (context or "No matching knowledge-base context was found.").strip()[:MAX_CONTEXT_CHARS]
    return (
        "You are AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. "
        "You are a professional, empathetic, and knowledgeable agricultural expert who communicates naturally and warmly like a human agronomist. "
        "If the user asks who you are, who created you, or what model you are, clearly state that you are AgriSystem AI (model: AGY V2.0.0), created by Team Leader Mao Seavik. "
        "If the user greets you or says hello (e.g. Hello, Hi), greet them back warmly and ask how you can help with their crops or farming today. "
        f"Answer in {language_name}. Use the knowledge-base context below for agricultural inquiries; "
        "follow the trusted agent instructions and do not invent pesticide doses, "
        "diagnoses, live weather, or guarantees. If the context is insufficient, "
        "say that more information or a local expert is needed. "
        "Give complete, well-structured, practical advice and mention uncertainty when appropriate. For complex questions, include a summary, possible causes, actionable steps, safety precautions, and when to contact an expert. Address every part of the question before stopping.\n\n"
        f"Knowledge-base context:\n{bounded_context}\n\n"
        f"Farmer question:\n{bounded_message}\n\nAnswer:\n"
    )


def _extract_text(payload: Any) -> str:
    if isinstance(payload, str):
        return payload.strip()
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
    for marker in ("\nAnswer:\n", "\nចម្លើយ៖\n", "\nចម្លើយ:\n", "Answer:\n", "ចម្លើយ៖\n", "ចម្លើយ:\n"):
        if marker in cleaned:
            cleaned = cleaned.rsplit(marker, 1)[-1].strip()
    return cleaned


def _gradio_call_urls(endpoint: str) -> list[str]:
    """Build Gradio 6 and legacy Gradio queue endpoint candidates."""
    parsed = urlparse((endpoint or "").strip())
    base = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    path = parsed.path.rstrip("/")
    if "/gradio_api/call/" in path or path.endswith("/call/answer"):
        return [endpoint.rstrip("/")]
    if path and path not in {"/", "/en"}:
        base = f"{base}{path}"
    return [
        f"{base}/gradio_api/call/answer",
        f"{base}/call/answer",
    ]


def _gradio_reply(endpoint: str, token: str, prompt: str, timeout: float, max_new_tokens: int) -> str:
    """Call a Gradio Space's queued API and read its final SSE event."""
    headers = {"Content-Type": "application/json"}
    # A public Space does not need the admin-generated endpoint key. Only send
    # a token there when it is actually a Hugging Face token, otherwise an
    # unrelated bearer key can turn a public request into a 401.
    hostname = (urlparse(endpoint).hostname or "").lower()
    if token and (not hostname.endswith(".hf.space") or token.startswith("hf_")):
        headers["Authorization"] = f"Bearer {token}"
    payload = {"data": [prompt, 0.25, max(32, min(int(max_new_tokens), 1024))]}

    call_urls = _gradio_call_urls(endpoint)
    last_response = None
    call_url = call_urls[-1]
    for candidate in call_urls:
        response = requests.post(candidate, json=payload, headers=headers, timeout=timeout)
        last_response = response
        call_url = candidate
        if response.status_code == 404 and candidate != call_urls[-1]:
            continue
        response.raise_for_status()
        break
    else:
        last_response.raise_for_status()

    event_id = (last_response.json() or {}).get("event_id")
    if not event_id:
        raise RuntimeError("Gradio endpoint did not return an event ID")

    with requests.get(
        f"{call_url}/{event_id}",
        headers=headers,
        stream=True,
        timeout=timeout,
    ) as stream:
        stream.raise_for_status()
        event_name = ""
        for raw_line in stream.iter_lines(decode_unicode=True):
            line = (raw_line or "").strip()
            if line.startswith("event:"):
                event_name = line[6:].strip()
                continue
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if event_name == "error":
                raise RuntimeError(data or "Gradio generation failed")
            if event_name == "complete":
                return _extract_text(json.loads(data))

    raise RuntimeError("Gradio endpoint closed before returning a result")


def request_endpoint(
    endpoint: str,
    token: str,
    prompt: str,
    *,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    max_new_tokens: int = 768,
) -> str:
    """Call either the custom TGI-compatible service or a Gradio Space."""
    if is_gradio_endpoint(endpoint):
        return _gradio_reply(endpoint, token, prompt, timeout, max_new_tokens)

    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = requests.post(
        endpoint,
        json={
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": max_new_tokens,
                "temperature": 0.25,
                "top_p": 0.9,
                "return_full_text": False,
            },
        },
        headers=headers,
        timeout=timeout,
    )
    response.raise_for_status()
    return _remove_prompt_echo(_extract_text(response.json()), prompt)


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
    try:
        max_tokens = 768
        reply = request_endpoint(
            endpoint,
            token,
            prompt,
            timeout=_timeout(),
            max_new_tokens=max_tokens,
        )
        return reply or None
    except (requests.RequestException, RuntimeError, ValueError) as exc:
        try:
            current_app.logger.warning("Remote agricultural AI request failed: %s", exc)
        except RuntimeError:
            pass
        return None
