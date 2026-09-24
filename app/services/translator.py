"""Translation through the owner's self-trained agricultural model only."""

from typing import Optional


def translate_to_khmer(text: str, model_choice: Optional[str] = None) -> Optional[str]:
    """Translate text with the configured custom endpoint.

    ``model_choice`` remains accepted for API compatibility, but it cannot
    select an external provider or override the owner's active model.
    """
    value = (text or "").strip()
    if not value:
        return None
    try:
        from app.services.ai_expert_service import generate_reply

        prompt = (
            "Translate the following text into natural Khmer for Cambodian farmers. "
            "Preserve crop, disease, pesticide, and scientific names. Return only the translation.\n\n"
            f"Text:\n{value[:4000]}"
        )
        reply = generate_reply(prompt, context="Translation task: do not add explanations.", language="km")
        return reply.strip() if reply else None
    except Exception:
        return None


def translate_audio_to_khmer(file_path: str) -> Optional[str]:
    """Audio translation is unavailable until the custom model supports audio."""
    return None
