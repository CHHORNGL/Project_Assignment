# app/services/translator.py

import os
from typing import Optional

try:
    from openai import OpenAI
except Exception:  # pragma: no cover - optional dependency for local/dev environments
    OpenAI = None

try:
    from google import genai
except Exception:
    genai = None

from flask_login import current_user
import logging
import time

DEFAULT_TRANSLATE_MODEL = "gpt-4o-mini"

_cached_openai_client = None
_cached_openai_key = None

class MultiKeyOpenAIChatCompletions:
    def __init__(self, clients):
        self.clients = clients
    def create(self, **kwargs):
        last_exception = None
        for client in self.clients:
            try:
                return client.chat.completions.create(**kwargs)
            except Exception as e:
                last_exception = e
                print(f"API key failed, falling back to next: {e}")
        if last_exception:
            raise last_exception
        return None

class MultiKeyOpenAIChat:
    def __init__(self, clients):
        self.completions = MultiKeyOpenAIChatCompletions(clients)

class MultiKeyOpenAI:
    def __init__(self, clients):
        self.chat = MultiKeyOpenAIChat(clients)

def _get_client() -> Optional[MultiKeyOpenAI]:
    global _cached_openai_client, _cached_openai_key
    if OpenAI is None:
        return None

    from app.models.site_setting import SiteSetting
    keys_list = []
    base_url = None
    try:
        db_groq = SiteSetting.query.get("API_KEY_GROQ")
        db_openai = SiteSetting.query.get("API_KEY_OPENAI")
        if db_groq and db_groq.value.strip():
            keys_list = [k.strip() for k in db_groq.value.split(",") if k.strip()]
            base_url = "https://api.groq.com/openai/v1"
        elif db_openai and db_openai.value.strip():
            keys_list = [k.strip() for k in db_openai.value.split(",") if k.strip()]
            base_url = None
    except Exception:
        pass

    if not keys_list:
        env_key = os.getenv("OPENAI_API_KEY", "").strip()
        if env_key:
            keys_list = [env_key]
        base_url = os.getenv("OPENAI_BASE_URL", "").strip() or None

    if not keys_list:
        return None

    cache_key = f"{','.join(keys_list)}|{base_url or ''}"
    if _cached_openai_client is None or _cached_openai_key != cache_key:
        clients = [OpenAI(api_key=k, base_url=base_url) for k in keys_list]
        _cached_openai_client = MultiKeyOpenAI(clients)
        _cached_openai_key = cache_key
        
    return _cached_openai_client


def translate_to_khmer(text: str) -> Optional[str]:
    try:
        # Check if user has Gemini API Key configured in their settings
        model_name = getattr(current_user, 'ai_model', 'original-ai') if current_user.is_authenticated else 'original-ai'
        if model_name != "original-ai" and current_user and current_user.is_authenticated and getattr(current_user, 'ai_api_key', None) and genai:
            keys = [k.strip() for k in current_user.ai_api_key.split(',') if k.strip()]
            if keys:
                import random
                client = genai.Client(api_key=random.choice(keys))
                prompt = (
                "Translate the user's text into Khmer. "
                "Preserve technical terms and crop/disease names if they are already Khmer. "
                "Return only the translated text.\\n\\n"
                f"Text to translate:\\n{text}"
            )
            response = client.models.generate_content(model=model_name, contents=prompt)
            if response and response.text:
                return response.text.strip()
    except Exception as e:
        logging.warning(f"Gemini translation failed: {e}")

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

def translate_audio_to_khmer(file_path: str) -> Optional[str]:
    """Translates an audio file to Khmer using Gemini API."""
    try:
        model_name = getattr(current_user, 'ai_model', 'original-ai') if current_user.is_authenticated else 'original-ai'
        if model_name != "original-ai" and current_user and current_user.is_authenticated and getattr(current_user, 'ai_api_key', None) and genai:
            keys = [k.strip() for k in current_user.ai_api_key.split(',') if k.strip()]
            if not keys:
                return None
            import random
            client = genai.Client(api_key=random.choice(keys))
            
            # gemini-1.0-pro does not support audio well, fallback to 1.5-flash
            if model_name == "gemini-1.0-pro":
                model_name = "gemini-1.5-flash"
                
            audio_file = client.files.upload(file=file_path)
            
            while audio_file.state.name == 'PROCESSING':
                time.sleep(1)
                audio_file = client.files.get(name=audio_file.name)
                
            prompt = "Listen to this audio and translate what is being said into Khmer language. Only provide the Khmer text translation, no extra explanations."
            
            response = client.models.generate_content(
                model=model_name,
                contents=[audio_file, prompt]
            )
            
            client.files.delete(name=audio_file.name)
            
            if response and response.text:
                return response.text.strip()
    except Exception as e:
        logging.warning(f"Gemini audio translation failed: {e}")
        
    return None
