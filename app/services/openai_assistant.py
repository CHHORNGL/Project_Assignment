# app/services/openai_assistant.py

import base64
import json
import os
import re
from typing import Optional, Tuple

try:
    from openai import OpenAI
except Exception:  # pragma: no cover - optional dependency for local/dev environments
    OpenAI = None
from sqlalchemy.orm import joinedload

from app.models.crop import Crop
from app.models.disease import Disease
from app.models.rule import Rule
from app.utils.i18n import get_current_language, normalize_display_text


DEFAULT_MODEL = "llama-3.3-70b-versatile"


def _normalize(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]+", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


_cached_client: Optional["OpenAI"] = None
_cached_client_key: str = ""


def _get_client() -> Optional["OpenAI"]:
    global _cached_client, _cached_client_key
    if OpenAI is None:
        return None

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    base_url = os.getenv("OPENAI_BASE_URL", "").strip() or None
    cache_key = f"{api_key}|{base_url or ''}"
    if _cached_client is None or _cached_client_key != cache_key:
        _cached_client = OpenAI(api_key=api_key, base_url=base_url)
        _cached_client_key = cache_key
    return _cached_client


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

    image_data_url = (
        "data:"
        + (mime_type or "image/jpeg")
        + ";base64,"
        + base64.b64encode(image_bytes).decode("utf-8")
    )

    model = os.getenv("OPENAI_VISION_MODEL", "").strip() or os.getenv("OPENAI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
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
        except Exception:
            return None

    if not response or not response.choices:
        return None

    raw_content = response.choices[0].message.content if response.choices[0].message else ""
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
    """
    Use AI to generate a smart agricultural expert response based on the DB knowledge base.
    Returns None if AI is not configured or fails.
    """
    client = _get_client()
    if not client:
        return None

    model = os.getenv("OPENAI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    context, crop = _build_kb_context(user_message)
    lang = get_current_language()

    system_prompt = (
        "You are an expert agricultural advisor specializing in Southeast Asian and Cambodian farming. "
        "Your role is to help farmers diagnose crop diseases, understand symptoms, plan treatments, "
        "and adopt best agricultural practices. \n\n"
        "EXPERTISE AREAS:\n"
        "- Rice, maize, vegetables, fruit trees, cassava, soybean and other crops grown in Cambodia/SE Asia\n"
        "- Fungal, bacterial, viral diseases and pest identification\n"
        "- Organic and chemical treatment recommendations with dosage guidance\n"
        "- Soil health, irrigation, fertilization, and crop rotation\n"
        "- Weather-related stress, nutrient deficiencies, and prevention strategies\n"
        "- Integrated Pest Management (IPM) and sustainable farming\n\n"
        "INSTRUCTIONS:\n"
        "1. Use the provided knowledge base context as primary reference for disease info.\n"
        "2. Supplement with your own deep agricultural expertise when needed.\n"
        "3. Give specific, actionable advice with clear steps.\n"
        "4. Mention disease causes, symptoms to watch for, and both short-term treatment and long-term prevention.\n"
        "5. If treatment involves chemicals, mention safe usage and alternatives.\n"
        "6. Be empathetic and encouraging toward farmers.\n"
        "7. If you are unsure, say so clearly and recommend consulting a local agricultural extension officer.\n"
        "8. Keep answers structured: use numbered steps or bullet points when listing actions."
    )
    if lang == "km":
        system_prompt += (
            "\n\nIMPORTANT: Always respond entirely in Khmer language (ភាសាខ្មែរ). "
            "Use clear, simple Khmer that farmers can easily understand."
        )

    user_prompt = (
        f"Farmer's question:\n{user_message}\n\n"
        f"Relevant knowledge base (diseases/symptoms in our system):\n{context}\n\n"
        "Please provide a detailed, practical, and helpful agricultural expert response."
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=2000,
        )
    except Exception:
        return None

    if not response or not response.choices:
        return None

    content = response.choices[0].message.content if response.choices[0].message else None
    return content.strip() if content else None
