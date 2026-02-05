# app/services/openai_assistant.py

import os
import re
from functools import lru_cache
from typing import Optional, Tuple

from openai import OpenAI
from sqlalchemy.orm import joinedload

from app.models.crop import Crop
from app.models.disease import Disease
from app.models.rule import Rule
from app.utils.i18n import get_current_language


DEFAULT_MODEL = "gpt-4o-mini"


def _normalize(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]+", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


@lru_cache(maxsize=1)
def _get_client() -> Optional[OpenAI]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    return OpenAI(api_key=api_key)


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
            pattern = r"\b" + re.escape(_normalize(candidate)) + r"\b"
            if re.search(pattern, message_norm):
                return crop
    return None


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
            return fallback or ""
        if lang == "km":
            value = getattr(obj, f"{field}_kh", None)
            if value:
                return value
        value = getattr(obj, field, None)
        return value if value else (fallback or "")

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
    Use OpenAI to generate a response based on the DB knowledge base.
    Returns None if OpenAI is not configured or fails.
    """
    client = _get_client()
    if not client:
        return None

    model = os.getenv("OPENAI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    context, crop = _build_kb_context(user_message)
    lang = get_current_language()

    system_prompt = (
        "You are an agricultural expert assistant. "
        "Answer ONLY using the provided knowledge base context. "
        "If the answer is not in the context, say you don't have it yet "
        "and ask a clarifying question."
    )
    if lang == "km":
        system_prompt += " Respond in Khmer."

    user_prompt = (
        f"User message:\n{user_message}\n\n"
        f"Knowledge base context:\n{context}\n\n"
        "Respond in a friendly, concise way."
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
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
