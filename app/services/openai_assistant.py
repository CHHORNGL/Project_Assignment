# app/services/openai_assistant.py

import base64
import json
import os
import re
from typing import Optional, Tuple

try:
    from google import genai
    from google.genai import types
except Exception:
    genai = None
    types = None
try:
    from openai import OpenAI
except Exception:
    OpenAI = None

from flask import current_app
from flask_login import current_user
from sqlalchemy.orm import joinedload

from app.models.crop import Crop
from app.models.disease import Disease
from app.models.rule import Rule
from app.utils.i18n import get_current_language, normalize_display_text


DEFAULT_MODEL = "gpt-4o-mini"


def _get_openai_model():
    from app.models.site_setting import SiteSetting
    try:
        db_model = SiteSetting.query.get("OPENAI_MODEL")
        if db_model and db_model.value.strip():
            return db_model.value.strip()
    except Exception:
        pass
    return os.getenv("OPENAI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL



def _normalize(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]+", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


from app.models.site_setting import SiteSetting

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

_cached_openai_client = None
_cached_openai_key = ""

def _get_openai_client():
    global _cached_openai_client, _cached_openai_key
    if OpenAI is None:
        return None

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

def _get_client():
    if not genai:
        return None
        
    if current_user and current_user.is_authenticated:
        user_key = getattr(current_user, 'ai_api_key', None)
        if user_key:
            keys = [k.strip() for k in user_key.split(',') if k.strip()]
            if keys:
                import random
                return genai.Client(api_key=random.choice(keys))
        

    api_key = ""
    try:
        db_gemini = SiteSetting.query.get("API_KEY_GEMINI")
        if db_gemini and db_gemini.value.strip():
            api_key = db_gemini.value.strip()
    except Exception:
        pass

    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        
    if api_key:
        return genai.Client(api_key=api_key)
    return None

def _get_model_name():
    if current_user and current_user.is_authenticated and getattr(current_user, 'ai_model', None):
        return current_user.ai_model
    return os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip()


def _match_crop(message: str) -> Optional[Crop]:
    message_norm = _normalize(message)
    crops = Crop.query.order_by(Crop.name.asc()).all()
    if not crops:
        return None
    for crop in sorted(crops, key=lambda c: len(c.name), reverse=True):
        candidates = [crop.name, getattr(crop, "name_kh", None)]
        for candidate in candidates:
            if not candidate:
                continue
            pattern = r"\b" + re.escape(_normalize(normalize_display_text(candidate, lang="km"))) + r"\b"
            if re.search(pattern, message_norm):
                return crop
    return None


def _extract_json_object(raw_text: str) -> Optional[dict]:
    text = (raw_text or "").strip()
    if not text:
        return None
    try:
        loaded = json.loads(text)
        if isinstance(loaded, dict):
            return loaded
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        loaded = json.loads(text[start : end + 1])
    except Exception:
        return None
    return loaded if isinstance(loaded, dict) else None


def suggest_symptoms_from_image(
    *,
    image_bytes: bytes,
    mime_type: str,
    crop_name: str,
    symptom_candidates: list[dict],
    max_suggestions: int = 8,
) -> Optional[dict]:
    """
    Use OpenAI vision to suggest visible symptoms.

    Parameters
    ----------
    image_bytes:
        Uploaded image binary.
    mime_type:
        MIME type of image.
    crop_name:
        Crop display name (context for model).
    symptom_candidates:
        List of dict rows with keys: id, name, name_kh.
    max_suggestions:
        Maximum returned matches.
    """
    client = _get_client()
    if not client:
        return None
    if not image_bytes or not symptom_candidates:
        return {"matched_symptoms": [], "notes": ""}

    cleaned_candidates: list[dict] = []
    alias_map: dict[str, dict] = {}
    for row in symptom_candidates:
        if not isinstance(row, dict):
            continue
        symptom_id = row.get("id")
        if symptom_id is None:
            continue
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        name_kh = str(row.get("name_kh") or "").strip()
        prepared = {
            "id": symptom_id,
            "name": name,
            "name_kh": name_kh or None,
        }
        cleaned_candidates.append(prepared)

        for alias in (name, name_kh):
            norm = _normalize(alias or "")
            if norm and norm not in alias_map:
                alias_map[norm] = prepared

    if not cleaned_candidates:
        return {"matched_symptoms": [], "notes": ""}

    candidate_lines = []
    for item in cleaned_candidates[:220]:
        line = str(item["name"])
        if item.get("name_kh"):
            line = f"{line} | {item['name_kh']}"
        candidate_lines.append(f"- {line}")
    candidates_text = "\n".join(candidate_lines)

    model_name = _get_model_name()
    system_prompt = (
        "You are an agricultural vision assistant. "
        "From the image, choose only symptoms that are directly visible. "
        "Use ONLY entries from the provided candidate list."
    )
    user_prompt = (
        f"Crop: {crop_name}\n"
        f"Return strict JSON object with keys:\n"
        f"- matched_symptoms: array of symptom names from candidate list\n"
        f"- notes: one short sentence\n"
        f"- confidence: one of high|medium|low\n"
        f"Limit matched_symptoms to at most {max(1, int(max_suggestions))}.\n\n"
        f"Candidate symptoms:\n{candidates_text}"
    )

    if model_name == "original-ai":
        client = _get_openai_client()
        if not client:
            return {"matched_symptoms": [], "notes": ""}
        model = os.getenv("OPENAI_VISION_MODEL", "").strip() or _get_openai_model()
        image_data_url = "data:" + (mime_type or "image/jpeg") + ";base64," + base64.b64encode(image_bytes).decode("utf-8")
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {"type": "image_url", "image_url": {"url": image_data_url}},
                        ],
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=600,
            )
            raw_content = response.choices[0].message.content if response.choices and response.choices[0].message else ""
        except Exception:
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": user_prompt},
                                {"type": "image_url", "image_url": {"url": image_data_url}},
                            ],
                        },
                    ],
                    temperature=0.1,
                    max_tokens=600,
                )
                raw_content = response.choices[0].message.content if response.choices and response.choices[0].message else ""
            except Exception:
                return None
    else:
        client = _get_client()
        if not client:
            return {"matched_symptoms": [], "notes": ""}
        try:
            image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type or "image/jpeg")
            response = client.models.generate_content(
                model=model_name,
                contents=[system_prompt, user_prompt, image_part],
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=600,
                    response_mime_type="application/json"
                )
            )
            raw_content = response.text if response else ""
        except Exception:
            return None
    payload = _extract_json_object(raw_content or "")
    if payload is None:
        payload = {"matched_symptoms": [], "notes": str(raw_content or "").strip()}

    raw_matches = payload.get("matched_symptoms")
    if isinstance(raw_matches, str):
        raw_matches = [chunk.strip() for chunk in raw_matches.split(",") if chunk.strip()]
    elif not isinstance(raw_matches, list):
        raw_matches = []

    matched_rows: list[dict] = []
    seen_ids = set()
    max_items = max(1, int(max_suggestions))

    normalized_candidates = []
    for item in cleaned_candidates:
        normalized_candidates.append((item, _normalize(item.get("name") or ""), _normalize(item.get("name_kh") or "")))

    for item in raw_matches:
        if isinstance(item, dict):
            raw_name = str(item.get("name") or item.get("symptom") or "").strip()
        else:
            raw_name = str(item or "").strip()
        if not raw_name:
            continue

        norm = _normalize(raw_name)
        if not norm:
            continue

        picked = alias_map.get(norm)
        if not picked:
            for candidate, norm_en, norm_kh in normalized_candidates:
                if norm and (norm in norm_en or norm_en in norm or (norm_kh and (norm in norm_kh or norm_kh in norm))):
                    picked = candidate
                    break
        if not picked:
            continue

        symptom_id = picked.get("id")
        if symptom_id in seen_ids:
            continue
        seen_ids.add(symptom_id)
        matched_rows.append(picked)
        if len(matched_rows) >= max_items:
            break

    notes = str(payload.get("notes") or payload.get("reason") or "").strip()
    confidence = str(payload.get("confidence") or "").strip().lower()

    return {
        "matched_symptoms": matched_rows,
        "notes": notes,
        "confidence": confidence if confidence in {"high", "medium", "low"} else None,
    }


def _build_kb_context(message: str) -> Tuple[str, Optional[Crop]]:
    """
    Build a concise knowledge base context for the assistant.
    Returns (context_text, matched_crop).
    """
    crop = _match_crop(message)

    if crop:
        diseases = (
            Disease.query
            .filter_by(crop_id=crop.id)
            .order_by(Disease.name.asc())
            .all()
        )
    else:
        diseases = (
            Disease.query
            .order_by(Disease.name.asc())
            .limit(20)
            .all()
        )

    if not diseases:
        return "No diseases found in the knowledge base.", crop

    disease_ids = [d.id for d in diseases]
    rules = (
        Rule.query
        .options(joinedload(Rule.symptoms), joinedload(Rule.disease))
        .filter(Rule.disease_id.in_(disease_ids))
        .all()
    )

    rules_by_disease = {}
    for rule in rules:
        rules_by_disease.setdefault(rule.disease_id, []).append(rule)

    lang = get_current_language()
    def localize(obj, field, fallback=None):
        if not obj:
            return normalize_display_text(fallback or "", lang=lang)
        if lang == "km":
            value = getattr(obj, f"{field}_kh", None)
            if value:
                return normalize_display_text(value, lang=lang)
        value = getattr(obj, field, None)
        return normalize_display_text(value if value else (fallback or ""), lang=lang)

    lines = []
    if crop:
        lines.append(f"Crop: {localize(crop, 'name', crop.name)}")

    for disease in diseases:
        lines.append(f"- Disease: {localize(disease, 'name', disease.name)}")
        description = localize(disease, "description", disease.description or "")
        if description:
            lines.append(f"  Description: {description}")

        symptom_set = set()
        for rule in rules_by_disease.get(disease.id, []):
            for s in rule.symptoms:
                if s and s.name:
                    symptom_set.add(localize(s, "name", s.name))
        if symptom_set:
            lines.append(f"  Symptoms: {', '.join(sorted(symptom_set))}")

    return "\n".join(lines), crop


def generate_assistant_reply(user_message: str) -> Optional[str]:
    from app.extensions import db
    is_premium = getattr(current_user, 'is_premium', False)
    
    if current_user and current_user.is_authenticated and current_user.has_role('farmer') and not is_premium:
        from datetime import datetime, timedelta
        if current_user.last_credit_reset and (datetime.utcnow() - current_user.last_credit_reset) >= timedelta(days=1):
            current_user.ai_credits = 13000
            current_user.last_credit_reset = datetime.utcnow()
            try:
                db.session.commit()
            except:
                db.session.rollback()

        if current_user.ai_credits <= 0:
            lang = get_current_language()
            if lang == "km":
                return "សុំទោស! អ្នកបានអស់ចំនួន Token (Credits) សម្រាប់ប្រើប្រាស់ AI ហើយ។ សូមដំឡើងទៅគណនី Premium ដើម្បីប្រើប្រាស់ដោយគ្មានដែនកំណត់។"
            else:
                return "Sorry! You have run out of AI Credits (Tokens). Please upgrade to a Premium account for unlimited AI chat."

    kb_context, crop = _build_kb_context(user_message)
    lang = get_current_language()
    lang_name = "Khmer" if lang == "km" else "English"
    
    system_prompt = (
        f"You are a helpful agricultural expert assistant named 'AgriSystem AI', created by your Team Leader, Mao Seavik. "
        f"Respond in {lang_name}. "
        f"If the user asks who you are or who created you, proudly state your name and that you were created by Team Leader Mao Seavik. "
        f"Use the following knowledge base context to answer the user's question accurately.\n\n"
        f"Context:\n{kb_context}"
    )
    user_prompt = user_message
    
    model_name = _get_model_name()
    reply_content = None
    
    if model_name == "original-ai":
        client = _get_openai_client()
        if client:
            model = _get_openai_model()
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.3,
                    max_tokens=600,
                )
                reply_content = response.choices[0].message.content if response.choices and response.choices[0].message else ""
            except Exception:
                pass
    else:
        client = _get_client()
        if not client:
            client = _get_openai_client()
            if client:
                model = _get_openai_model()
                try:
                    response = client.chat.completions.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        temperature=0.3,
                        max_tokens=600,
                    )
                    reply_content = response.choices[0].message.content if response.choices and response.choices[0].message else ""
                except Exception as e:
                    current_app.logger.error(f"Error calling OpenAI API: {e}")
                    return f"⚠️ [System Diagnostic] OpenAI API Error in AWS: {str(e)}"
            else:
                return "⚠️ [System Diagnostic] No AI clients could be initialized. Please check that your API keys are saved in the Admin Settings panel on your AWS database."
        else:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[system_prompt, user_prompt],
                    config=types.GenerateContentConfig(
                        temperature=0.3,
                        max_output_tokens=600,
                    )
                )
                reply_content = response.text if response else ""
            except Exception as e:
                current_app.logger.error(f"Error calling Gemini API: {e}")
                return f"⚠️ [System Diagnostic] Gemini API Error in AWS: {str(e)}"

    if reply_content:
        reply_content = reply_content.strip()
        if current_user and current_user.is_authenticated and current_user.has_role('farmer') and not is_premium:
            tokens_used = (len(system_prompt) + len(user_prompt) + len(reply_content)) // 4
            current_user.ai_credits = max(0, current_user.ai_credits - tokens_used)
            try:
                from app.extensions import db
                db.session.commit()
            except:
                db.session.rollback()
        return reply_content
    return None
