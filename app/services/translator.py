# app/services/translator.py

import os
from typing import Optional

from openai import OpenAI


DEFAULT_TRANSLATE_MODEL = "gpt-4o-mini"


def _get_client() -> Optional[OpenAI]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    return OpenAI(api_key=api_key)


def translate_to_khmer(text: str) -> Optional[str]:
    client = _get_client()
    if not client:
        return None

    model = os.getenv("OPENAI_TRANSLATE_MODEL", "").strip() or DEFAULT_TRANSLATE_MODEL
    system_prompt = (
        "Translate the user's text into Khmer. "
        "Preserve technical terms and crop/disease names if they are already Khmer. "
        "Return only the translated text."
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            temperature=0.2,
            max_tokens=300,
        )
    except Exception:
        return None

    if not response or not response.choices:
        return None
    content = response.choices[0].message.content if response.choices[0].message else None
    return content.strip() if content else None
