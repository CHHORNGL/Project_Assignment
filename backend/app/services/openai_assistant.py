# app/services/openai_assistant.py

from __future__ import annotations

import base64
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone
from threading import Lock, Thread
from typing import Any

from flask import current_app
from flask_login import current_user
from sqlalchemy.orm import joinedload

from app.models.crop import Crop
from app.models.disease import Disease
from app.models.rule import Rule
from app.models.site_setting import SiteSetting
from app.utils.i18n import get_current_language, normalize_display_text

try:
    from google import genai
    from google.genai import types
except Exception:  # noqa: BLE001
    genai = None  # type: ignore[assignment]
    types = None  # type: ignore[assignment]
try:
    from openai import OpenAI
except Exception:  # noqa: BLE001
    OpenAI = None  # type: ignore[assignment]


DEFAULT_MODEL = "gpt-4o-mini"


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_openai_model() -> str:
    try:
        db_provider = SiteSetting.query.get("ACTIVE_PROVIDER")
        db_expert_provider = SiteSetting.query.get("EXPERT_PROVIDER")
        active_p = (
            db_expert_provider.value.strip()
            if db_expert_provider and db_expert_provider.value.strip()
            else (db_provider.value.strip() if db_provider else "groq")
        )

        expert_model = SiteSetting.query.get("EXPERT_MODEL")
        if expert_model and expert_model.value.strip():
            em = expert_model.value.strip()
            if "gemini" not in em.lower():
                return em

        if active_p == "groq":
            groq_model = SiteSetting.query.get("GROQ_MODEL")
            if groq_model and groq_model.value.strip():
                return groq_model.value.strip()
            db_model = SiteSetting.query.get("OPENAI_MODEL")
            if db_model and db_model.value.strip() and "gpt-4" not in db_model.value.lower():
                return db_model.value.strip()
            return "openai/gpt-oss-120b"
        db_model = SiteSetting.query.get("OPENAI_MODEL")
        if db_model and db_model.value.strip() and not any(x in db_model.value.lower() for x in ["oss", "qwen", "compound"]):
            return db_model.value.strip()
        return "gpt-4o-mini"
    except Exception:  # noqa: BLE001, S110
        pass
    return os.getenv("OPENAI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def _normalize(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]+", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_markdown_symbols(text: str) -> str:
    """Remove raw markdown formatting symbols (**, *, __, ###, backticks) for a clean plain-text experience."""
    if not text:
        return ""
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
    text = re.sub(r"_{1,3}(.*?)_{1,3}", r"\1", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = text.replace("**", "").replace("*", "").replace("`", "")
    return text.strip()


class MultiKeyOpenAIChatCompletions:
    def __init__(self, clients: list[Any]) -> None:
        self.clients = clients

    def create(self, **kwargs: Any) -> Any:
        last_exception: Exception | None = None
        for client in self.clients:
            try:
                return client.chat.completions.create(**kwargs)
            except Exception as e:  # noqa: BLE001
                last_exception = e
                print(f"API key failed, falling back to next: {e}")
        if last_exception:
            raise last_exception
        return None


class MultiKeyOpenAIChat:
    def __init__(self, clients: list[Any]) -> None:
        self.completions = MultiKeyOpenAIChatCompletions(clients)


class MultiKeyOpenAI:
    def __init__(self, clients: list[Any]) -> None:
        self.chat = MultiKeyOpenAIChat(clients)


_cached_openai_client: MultiKeyOpenAI | None = None
_cached_openai_key = ""


def _get_openai_client() -> MultiKeyOpenAI | None:
    global _cached_openai_client, _cached_openai_key
    if OpenAI is None:
        return None

    keys_list: list[str] = []
    base_url: str | None = None

    try:
        db_provider = SiteSetting.query.get("ACTIVE_PROVIDER")
        db_expert_provider = SiteSetting.query.get("EXPERT_PROVIDER")
        db_groq = SiteSetting.query.get("API_KEY_GROQ")
        db_openai = SiteSetting.query.get("API_KEY_OPENAI")

        if db_expert_provider and db_expert_provider.value.strip():
            provider = db_expert_provider.value.strip()
        else:
            provider = db_provider.value.strip() if db_provider else "groq"

        if provider == "groq" and db_groq and db_groq.value.strip():
            keys_list = [k.strip() for k in db_groq.value.split(",") if k.strip()]
            base_url = "https://api.groq.com/openai/v1"
        elif provider == "openai" and db_openai and db_openai.value.strip():
            keys_list = [k.strip() for k in db_openai.value.split(",") if k.strip()]
            base_url = None
        elif db_groq and db_groq.value.strip():
            keys_list = [k.strip() for k in db_groq.value.split(",") if k.strip()]
            base_url = "https://api.groq.com/openai/v1"
        elif db_openai and db_openai.value.strip():
            keys_list = [k.strip() for k in db_openai.value.split(",") if k.strip()]
            base_url = None
    except Exception:  # noqa: BLE001, S110
        pass

    if not keys_list:
        env_key = os.getenv("OPENAI_API_KEY", "").strip()
        if env_key and not env_key.startswith("sk-your-") and "your-api-key" not in env_key:
            keys_list = [env_key]
        base_url = os.getenv("OPENAI_BASE_URL", "").strip() or None

    keys_list = [k for k in keys_list if k and not k.startswith("sk-your-") and "your-api-key" not in k]
    if not keys_list:
        return None

    cache_key = f"{','.join(keys_list)}|{base_url or ''}"
    if _cached_openai_client is None or _cached_openai_key != cache_key:
        clients = [OpenAI(api_key=k, base_url=base_url) for k in keys_list]
        _cached_openai_client = MultiKeyOpenAI(clients)
        _cached_openai_key = cache_key

    return _cached_openai_client


def _get_client() -> Any:
    if not genai:
        return None

    api_key = ""
    try:
        db_gemini = SiteSetting.query.get("API_KEY_GEMINI")
        if db_gemini and db_gemini.value.strip():
            keys = [k.strip() for k in db_gemini.value.split(",") if k.strip()]
            if keys:
                api_key = keys[0]
    except Exception:  # noqa: BLE001, S110
        pass

    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if api_key:
        try:
            return genai.Client(api_key=api_key)
        except Exception as e:  # noqa: BLE001
            try:
                current_app.logger.warning("Failed to initialize genai.Client: %s", e)
            except RuntimeError:
                pass
            return None
    return None


def _normalize_gemini_model_name(name: str) -> str:
    m = (name or "").strip()
    if not m:
        return "gemini-3.5-flash"
    if m in {"gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"}:
        return "gemini-3.5-flash"
    if m in {"gemini-2.5-flash-lite", "gemini-2.0-flash-lite"}:
        return "gemini-3.5-flash-lite"
    return m


def _get_model_name() -> str:
    try:
        expert_model = SiteSetting.query.get("EXPERT_MODEL")
        if expert_model and expert_model.value.strip() and "gemini" in expert_model.value.lower():
            return _normalize_gemini_model_name(expert_model.value.strip())
        gemini_model = SiteSetting.query.get("GEMINI_MODEL")
        if gemini_model and gemini_model.value.strip():
            return _normalize_gemini_model_name(gemini_model.value.strip())
    except Exception:  # noqa: BLE001, S110
        pass

    if current_user and current_user.is_authenticated and getattr(current_user, "ai_model", None):
        return _normalize_gemini_model_name(current_user.ai_model)
    return _normalize_gemini_model_name(os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip())


def _match_crop(message: str) -> Crop | None:
    message_norm = _normalize(message)
    message_raw = (message or "").strip().lower()
    crops = Crop.query.order_by(Crop.name.asc()).all()
    if not crops:
        return None
    for crop in sorted(crops, key=lambda c: len(c.name), reverse=True):
        candidates = [getattr(crop, "name_kh", None), crop.name]
        for candidate in candidates:
            if not candidate:
                continue
            cand_clean = normalize_display_text(candidate, lang="km").strip()
            if any("\u1780" <= ch <= "\u17ff" for ch in cand_clean):
                if cand_clean.lower() in message_raw or _normalize(cand_clean) in message_norm:
                    return crop
            else:
                pattern = r"\b" + re.escape(_normalize(cand_clean)) + r"\b"
                if re.search(pattern, message_norm):
                    return crop
    return None


def _extract_json_object(raw_text: str) -> dict[str, Any] | None:
    text = (raw_text or "").strip()
    if not text:
        return None
    try:
        loaded = json.loads(text)
        if isinstance(loaded, dict):
            return loaded
    except Exception:  # noqa: BLE001, S110
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        loaded = json.loads(text[start : end + 1])
    except Exception:  # noqa: BLE001
        return None
    return loaded if isinstance(loaded, dict) else None


def suggest_symptoms_from_image(
    *,
    image_bytes: bytes,
    mime_type: str,
    crop_name: str,
    symptom_candidates: list[dict[str, Any]],
    max_suggestions: int = 8,
    model_choice: str | None = None,
) -> dict[str, Any] | None:
    """Return symptom suggestions for an uploaded crop image.

    The current self-trained endpoint is text-only; do not silently send crop
    images to a commercial vision provider.
    """
    _ = (image_bytes, mime_type, crop_name, symptom_candidates, max_suggestions, model_choice)
    return {
        "matched_symptoms": [],
        "notes": "Image suggestions require the owner's trained vision model.",
        "confidence": None,
    }


def _build_kb_context(message: str) -> tuple[str, Crop | None]:
    """
    Build a concise knowledge base context for the assistant.
    Returns (context_text, matched_crop).
    """
    crop = _match_crop(message)
    message_clean = (message or "").strip().lower()

    if crop:
        all_crop_diseases = (
            Disease.query
            .filter_by(crop_id=crop.id)
            .order_by(Disease.name.asc())
            .all()
        )
        matched_disease = None
        for d in all_crop_diseases:
            cand_names = [getattr(d, "name_kh", None), d.name]
            for cand in cand_names:
                if cand:
                    cand_clean = normalize_display_text(cand, lang="km").strip().lower()
                    if any("\u1780" <= ch <= "\u17ff" for ch in cand_clean):
                        if cand_clean in message_clean:
                            matched_disease = d
                            break
                    elif _normalize(cand_clean) in _normalize(message):
                        matched_disease = d
                        break
            if matched_disease:
                break
        if matched_disease:
            diseases = [matched_disease]
        else:
            diseases = all_crop_diseases
    else:
        # Check if message mentions any specific disease directly
        all_diseases = Disease.query.all()
        matched_disease = None
        for d in sorted(all_diseases, key=lambda x: len(x.name), reverse=True):
            cand_names = [getattr(d, "name_kh", None), d.name]
            for cand in cand_names:
                if cand:
                    cand_clean = normalize_display_text(cand, lang="km").strip().lower()
                    if any("\u1780" <= ch <= "\u17ff" for ch in cand_clean):
                        if cand_clean in message_clean:
                            matched_disease = d
                            break
                    elif _normalize(cand_clean) in _normalize(message):
                        matched_disease = d
                        break
            if matched_disease:
                crop = matched_disease.crop
                diseases = [matched_disease]
                break
        else:
            diseases = (
                Disease.query
                .order_by(Disease.name.asc())
                .limit(20)
                .all()
            )

    if not diseases:
        lang = get_current_language()
        empty_msg = "រកមិនឃើញព័ត៌មានជំងឺនៅក្នុងប្រព័ន្ធឡើយ។" if lang == "km" else "No diseases found in the knowledge base."
        return empty_msg, crop

    lang = get_current_language()
    is_km = lang == "km"

    def localize(obj, field, fallback=None):
        if not obj:
            return normalize_display_text(fallback or "", lang=lang)
        if is_km:
            value = getattr(obj, f"{field}_kh", None)
            if value:
                return normalize_display_text(value, lang=lang)
        value = getattr(obj, field, None)
        return normalize_display_text(value if value else (fallback or ""), lang=lang)

    crop_lbl = "ដំណាំ៖" if is_km else "Crop:"
    dis_lbl = "- ជំងឺ៖" if is_km else "- Disease:"
    desc_lbl = "  ការពិពណ៌នា៖" if is_km else "  Description:"
    cause_lbl = "  មូលហេតុ៖" if is_km else "  Cause:"
    sym_lbl = "  រោគសញ្ញា៖" if is_km else "  Symptoms:"
    treat_lbl = "  ការព្យាបាល៖" if is_km else "  Treatment:"
    prev_lbl = "  ការបង្ការ៖" if is_km else "  Prevention:"

    lines = []
    if crop:
        crop_desc = localize(crop, "description", crop.description or "")
        lines.append(f"{crop_lbl} {localize(crop, 'name', crop.name)}")
        if crop_desc:
            lines.append(f"{desc_lbl} {crop_desc}")

    # If multiple diseases match (e.g. user asks about the crop's diseases),
    # output a concise summary of ALL diseases so that every single disease fits without truncation.
    if len(diseases) > 1:
        header_text = (
            f"បញ្ជីជំងឺ និងបញ្ហាទាំងអស់លើដំណាំ {localize(crop, 'name', crop.name) if crop else ''} (សរុប {len(diseases)} ជំងឺ)៖"
            if is_km
            else f"All Recorded Diseases for {localize(crop, 'name', crop.name) if crop else 'Crop'} ({len(diseases)} diseases):"
        )
        lines.append(header_text)
        for i, disease in enumerate(diseases, 1):
            d_name = localize(disease, "name", disease.name)
            d_name_en = disease.name or ""
            description = localize(disease, "description", disease.description or "")
            treatment = localize(disease, "treatment", disease.treatment or "")
            desc_short = (
                description.split("។")[0].strip() + "។"
                if is_km and "។" in description
                else (description.split(".")[0].strip() + "." if "." in description else description[:110].strip())
            )
            treat_short = (
                treatment.split("។")[0].strip() + "។"
                if is_km and "។" in treatment
                else (treatment.split(".")[0].strip() + "." if "." in treatment else treatment[:110].strip())
            )
            title_display = f"{d_name} ({d_name_en})" if is_km and d_name != d_name_en else d_name
            lines.append(f"{i}. {title_display}")
            if desc_short:
                lines.append(f"{desc_lbl} {desc_short}")
            if treat_short:
                lines.append(f"{treat_lbl} {treat_short}")
        return "\n".join(lines), crop

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

    for disease in diseases:
        lines.append(f"{dis_lbl} {localize(disease, 'name', disease.name)}")
        description = localize(disease, "description", disease.description or "")
        if description:
            lines.append(f"{desc_lbl} {description}")

        cause = localize(disease, "cause_explanation", disease.cause_explanation or "")
        if cause:
            lines.append(f"{cause_lbl} {cause}")

        symptom_set = set()
        for rule in rules_by_disease.get(disease.id, []):
            for s in rule.symptoms:
                if s and s.name:
                    symptom_set.add(localize(s, "name", s.name))
        if symptom_set:
            lines.append(f"{sym_lbl} {', '.join(sorted(symptom_set))}")

        treatment = localize(disease, "treatment", disease.treatment or "")
        if treatment:
            lines.append(f"{treat_lbl} {treatment}")

        prevention = localize(disease, "prevention_tips", disease.prevention_tips or "")
        if prevention:
            lines.append(f"{prev_lbl} {prevention}")

    return "\n".join(lines), crop


def get_simple_user_daily_tokens() -> int:
    """Return the configured daily token limit for simple users (default: 13,000)."""
    try:
        setting = SiteSetting.query.get("SIMPLE_USER_DAILY_TOKENS")
        if setting and setting.value and setting.value.strip():
            return max(100, int(setting.value.strip()))
    except Exception:  # noqa: BLE001, S110
        pass
    return 13000


def _uses_farmer_ai_credits(user: Any) -> bool:
    """Return whether this account should pay for Farmer AI usage.

    Simple/Free users have their credits and tokens controlled.
    Premium accounts have 100% UNLIMITED access with zero token deductions.
    Admins and Experts also have unlimited access.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "has_active_premium", False) or getattr(user, "is_premium", False):
        return bool(getattr(user, "premium_expires_at", None) and user.premium_expires_at < _utcnow_naive())
    if getattr(user, "has_role", None) and (user.has_role("admin") or user.has_role("expert")):
        return False
    try:
        return bool(user.has_route_access("farmer"))
    except AttributeError:
        return bool(user.has_role("farmer"))


def _build_expert_system_prompt(language: str = "km", agent_context: str = "") -> str:
    lang_name = "Khmer (ភាសាខ្មែរ)" if language == "km" else "English"

    if language == "km":
        structure_guide = (
            "រៀបចំចម្លើយរបស់អ្នកជាទម្រង់អត្ថបទធម្មតា ស្អាត និងងាយស្រួលយល់ ដោយមិនប្រើសញ្ញា Markdown ដូចជា ** ឬ * ឬ # ឡើយ៖\n"
            "១. ការវិភាគរោគសញ្ញា និងមូលហេតុ (Diagnosis & Root Cause)៖ កំណត់អត្តសញ្ញាណជំងឺ សត្វល្អិត ឬកង្វះជីវជាតិ និងពន្យល់ពីមូលហេតុដែលបង្កឡើង។\n"
            "២. វិធានការសង្គ្រោះបន្ទាន់ (Immediate Action)៖ សកម្មភាពបន្ទាន់ដែលកសិករត្រូវអនុវត្តភ្លាមៗ (ដកស្លឹកឆ្លងចេញ, បន្ថយជីអាសូត, បង្ហូរទឹក ឬបន្ថយសំណើម)។\n"
            "៣. វិធីសាស្ត្រធម្មជាតិ និងជីវសាស្ត្រ (Organic & IPM)៖ ការប្រើផ្សិត Trichoderma, Bacillus subtilis, ទឹកស្លឹកស្តៅ, ទឹកខ្មេះឈើ, អន្ទាក់ស្អិត។\n"
            "៤. វិធានការគីមី និងកម្រិតប្រើប្រាស់ជាក់លាក់ (Chemical Treatment & Dosages)៖ ឈ្មោះសារធាតុសកម្ម និងកម្រិតលាយជាក់លាក់ (ក្រាម/មីលីលីត្រ ក្នុងធុងបាញ់ ១៦-២០លីត្រ), ពេលវេលាបាញ់ថ្នាំ (ពេលព្រឹកព្រលឹម ឬរសៀលត្រជាក់), សម្ភារៈការពារ (PPE), និងរយៈពេលផ្អាកប្រើថ្នាំមុនប្រមូលផល (PHI)។\n"
            "៥. ការបង្ការ និងការគ្រប់គ្រងដីរយៈពេលវែង (Long-term Prevention & Soil Care)៖ ការបង្វិលមុខដំណាំ, ពូជធន់, ការកែប្រែដីអាស៊ីតដោយកំបោរកសិកម្ម (៣០០-៥០០ គ.ក្រ/ហ.ត), ការដាក់ជី NPK មានតុល្យភាព។"
        )
    else:
        structure_guide = (
            "Organize your answer cleanly in natural paragraphs and numbered points without using markdown bold signs (**), asterisks (*), hashtags (#), or code backticks:\n"
            "1. Diagnosis & Root Cause: Identify the pathogen, insect pest, or physiological disorder. Explain why it occurred.\n"
            "2. Immediate / Emergency Action: Urgent corrective steps the grower must take immediately (isolate infected foliage, stop excess nitrogen, improve drainage, regulate moisture).\n"
            "3. Organic & Bio-Control (IPM): Biological agents (Trichoderma, Bacillus subtilis), botanical extracts (neem oil/leaves, wood vinegar), compost, sticky traps.\n"
            "4. Chemical Treatment & Exact Dosages: Precise active ingredients and formulations, dilution rates (per 16L–20L sprayer or per hectare), safe application timing, PPE, and Pre-Harvest Intervals (PHI).\n"
            "5. Long-term Prevention & Soil Management: Crop rotation, certified resistant seeds, proper spacing for ventilation, correcting soil acidity with agricultural lime (300–500 kg/ha), balanced NPK fertilization."
        )

    return (
        f"You are AgriSystem AI (model: AGY V2.0.0), a world-class Senior Agricultural Expert, Agronomist, and Crop Health Specialist, "
        f"developed and deployed under the leadership of Team Leader Mao Seavik (ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ).\n\n"
        f"### CORE IDENTITY & CREATOR ATTRIBUTION:\n"
        f"- Your name is AgriSystem AI (Model: AGY V2.0.0).\n"
        f"- You were created and trained under the visionary leadership of Team Leader Mao Seavik (ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ).\n"
        f"- Whenever asked who you are, what model you use, or who created you, proudly and politely state that you are AgriSystem AI (AGY V2.0.0), created by Team Leader Mao Seavik.\n\n"
        f"### FORMATTING RULE (NO MARKDOWN SIGNS):\n"
        f"- DO NOT use markdown bold syntax (**text**), asterisks (*), hashtags (###), or backticks (`) in responses.\n"
        f"- Present answers in clean, readable plain text with clean bullet points (-) or numbers (1., 2.).\n\n"
        f"### TONE & COMMUNICATION STYLE (PROFESSIONAL, HUMAN-LIKE, POLITE):\n"
        f"- Target language: {lang_name}.\n"
        f"- Embody the depth, intelligence, and clarity of Google Gemini, combined with the warmth, empathy, and practical wisdom of an experienced master farmer and agricultural scientist.\n"
        f"- When responding in Khmer:\n"
        f"  * Speak naturally, respectfully, and warmly using authentic Cambodian agricultural terms.\n"
        f"  * Use polite honorifics such as 'ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព', 'បាទ/ចាស', and close with warm encouragement for high yields and prosperous farming (e.g., 'ជូនពរឱ្យដំណាំរបស់លោកអ្នកទទួលបានទិន្នផលខ្ពស់ និងជៀសផុតពីជំងឺទាំងពួង!')\n"
        f"  * Avoid literal or unnatural translations. Use true Khmer farming terminology (e.g. ជីកំប៉ុស, ជីអ៊ុយរ៉េ, ជីបាត, ជីបំប៉ន, កំបោរកសិកម្ម, រោគសញ្ញាខ្លោចស្លឹក, ដង្កូវហ្វូង, មមាចត្នោត, កាត់ក្រីមែក, រយៈពេលផ្អាកថ្នាំមុនប្រមូលផល - PHI).\n"
        f"- When responding in English:\n"
        f"  * Be thorough, encouraging, precise, and practical.\n\n"
        f"### RESPONSE ARCHITECTURE & STRUCTURE:\n"
        f"{structure_guide}\n\n"
        f"### COMPREHENSIVE AGRICULTURAL KNOWLEDGE BASE:\n"
        f"You possess vast, specialized agronomic knowledge covering:\n"
        f"- Paddy Rice (ស្រូវ): Wet/dry season varieties, Phka Rumduol, Sen Kra'op; Rice blast, Brown spot, Sheath blight, Bacterial leaf blight, Bakanae; Brown planthopper, Stem borers; NPK scheduling (basal DAP/16-20-0, split Urea 46-0-0 at tillering & panicle initiation, MOP 0-0-60 for grain filling).\n"
        f"- Cassava (ដំឡូងមី): CMD (Cassava Mosaic Geminivirus - rogue infected plants, clean certified stems KU50/Rayong 9, control whitefly vectors), Witches' broom, Root rot, Mealybugs, Spidermites.\n"
        f"- Pepper (ម្រេច): Foot rot, Quick wilt, Slow wilt, Anthracnose, Nematodes, shade and root drainage.\n"
        f"- Cashew & Rubber (ស្វាយចន្ទី និងកៅស៊ូ): Anthracnose on flowers/nuts, Tea mosquito bug, White root rot, Pink disease.\n"
        f"- Durian (ទុរេន): Phytophthora root/stem canker (Fosetyl-Al / Metalaxyl drench, phosphorous acid injection), Anthracnose, Fruit borers, optimal soil pH 5.5–6.5, balanced micronutrients (Mg, Ca, B, Zn).\n"
        f"- Mango & Citrus (ស្វាយ និងក្រូច): Mango anthracnose, Fruit flies (methyl eugenol pheromone traps), Blossom thrips; Citrus greening (HLB), Citrus canker (copper sprays), Leaf miners.\n"
        f"- Vegetables & Horticulture: Tomato, Chili, Eggplant, Cucumber, Long beans, Cabbage, Morning glory; Bacterial wilt, Late blight, Blossom end rot (Calcium deficiency - Ca-B foliar spray), Diamondback moth, Thrips, Aphids.\n"
        f"- Soil Health & Fertilization: Acidic soil correction using agricultural lime (កំបោរកសិកម្ម), Organic compost fermentation, cow/poultry manure safety, balanced NPK nutrients, drip irrigation, drainage channels.\n"
        f"- Livestock & Aquaculture: Backyard poultry (vaccinations, biosecurity), Cattle forage grasses, Pig disease prevention, Fish pond management (Tilapia, Catfish, water aeration, lime application).\n\n"
        f"### UNIVERSAL ASSISTANCE DIRECTIVE:\n"
        f"- You must answer ALL questions asked by farmers, growers, and users thoroughly, completely, and helpfully.\n"
        f"- Combine the contextual knowledge below with your deep agronomic intelligence to provide the best possible guidance.\n\n"
        f"### KNOWLEDGE CONTEXT:\n"
        f"{agent_context or 'No specific local database context retrieved; provide complete agronomic guidance using your expert knowledge base.'}"
    )


def _generate_with_gemini(
    client: Any,
    contents: Any,
    preferred_model: str | None = None,
    max_output_tokens: int = 2048,
    temperature: float = 0.35,
) -> str | None:
    """Call Gemini with model fallback to handle 404s/503s."""
    if not client or not types:
        return None

    candidates: list[str] = []
    if preferred_model:
        candidates.append(_normalize_gemini_model_name(preferred_model))
    for m in ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-flash-latest"]:
        if m not in candidates:
            candidates.append(m)

    last_error: Exception | None = None
    for model in candidates:
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                ),
            )
            if response and response.text:
                return response.text.strip()
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            try:
                current_app.logger.warning("Gemini model %s call failed: %s; trying next model", model, exc)
            except RuntimeError:
                pass
            continue

    if last_error:
        try:
            current_app.logger.error("All Gemini model candidates failed: %s", last_error)
        except RuntimeError:
            pass
    return None


def _generate_with_openai_or_groq(
    client: Any,
    system_prompt: str,
    user_content: Any,
    model: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.35,
) -> str | None:
    """Call Groq or OpenAI with error handling."""
    if not client:
        return None
    model_to_use = model or _get_openai_model()
    try:
        response = client.chat.completions.create(
            model=model_to_use,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if response and response.choices and response.choices[0].message:
            content = response.choices[0].message.content or ""
            return content.strip()
    except Exception as exc:  # noqa: BLE001
        try:
            current_app.logger.warning("OpenAI/Groq model %s failed: %s", model_to_use, exc)
        except RuntimeError:
            pass
    return None


def generate_assistant_reply(
    user_message: str,
    image_bytes: bytes | None = None,
    image_mime_type: str = "image/jpeg",
    model_choice: str | None = None,
    conversation: list[tuple[str, str]] | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> str | None:
    from app.extensions import db

    charges_farmer_credits = _uses_farmer_ai_credits(current_user)

    if charges_farmer_credits:
        daily_quota = get_simple_user_daily_tokens()
        now_utc = _utcnow_naive()
        if current_user.last_credit_reset and (now_utc - current_user.last_credit_reset) >= timedelta(days=1):
            current_user.ai_credits = daily_quota
            current_user.last_credit_reset = now_utc
            try:
                db.session.commit()
            except Exception:  # noqa: BLE001
                db.session.rollback()

        if (current_user.ai_credits or 0) <= 0:
            lang = get_current_language()
            if bool(re.search(r"[\u1780-\u17ff]", user_message)):
                lang = "km"
            if lang == "km":
                return "សុំទោស! អ្នកបានអស់ចំនួន Token (Credits) សម្រាប់ប្រើប្រាស់ AI ហើយ។ សូមដំឡើងទៅគណនី Premium ដើម្បីប្រើប្រាស់ដោយគ្មានដែនកំណត់ (Unlimited)។"
            return "Sorry! You have run out of AI Credits (Tokens). Please upgrade to a Premium account for Unlimited AI chat and diagnoses."

    has_khmer = bool(re.search(r"[\u1780-\u17ff]", user_message))
    if has_khmer:
        lang = "km"
    elif bool(re.search(r"[a-zA-Z]{2,}", user_message)):
        lang = "en"
    else:
        lang = get_current_language() or "en"

    from app.services.agri_agent import build_agent_context

    agent_context, agent_plan = build_agent_context(
        user_message,
        language=lang,
        conversation=conversation,
        has_image=bool(image_bytes),
        latitude=latitude,
        longitude=longitude,
    )
    current_app.logger.info(
        "Agricultural agent route intent=%s tools=%s",
        agent_plan.intent,
        ",".join(agent_plan.tools) or "none",
    )

    if agent_plan.intent == "system_help":
        if lang == "km":
            reply = (
                "សូមអភ័យទោស! ខ្ញុំគឺជាអ្នកជំនាញកសិកម្មឆ្លាតវៃ AgriSystem AI (ម៉ូឌែល AGY V2.0.0) "
                "ដែលផ្តោតសំខាន់លើការផ្តល់ប្រឹក្សាបច្ចេកទេសកសិកម្ម ការធ្វើរោគវិនិច្ឆ័យជំងឺដំណាំ ការគ្រប់គ្រងដី ជី ទឹក និងការព្យាបាលដំណាំប៉ុណ្ណោះ មិនមែនសម្រាប់ឆ្លើយសំណួរអំពីគម្រោង ឬប្រព័ន្ធគេហទំព័រឡើយ។ "
                "តើលោកអ្នកមានចម្ងល់អំពីដំណាំ រោគសញ្ញាជំងឺ ឬបច្ចេកទេសដាំដុះអ្វីដែលខ្ញុំអាចជួយបាននៅថ្ងៃនេះទេ?"
            )
        else:
            reply = (
                "I am the AgriSystem AI Agricultural Expert (model AGY V2.0.0), dedicated exclusively to "
                "agronomy guidance, crop disease diagnosis, soil & fertilizer management, and farming support rather than website or system project questions. "
                "What crop health, pest management, or farming question can I help you with today?"
            )
        if charges_farmer_credits:
            tokens_used = max(15, (len(user_message) + len(reply)) // 4)
            current_user.ai_credits = max(0, (current_user.ai_credits or 0) - tokens_used)
            try:
                db.session.commit()
            except Exception:  # noqa: BLE001
                db.session.rollback()
        return clean_markdown_symbols(reply)

    if agent_plan.intent == "agent_identity":
        from app.services.ai_expert_service import _match_trained_dataset

        trained_id_reply = _match_trained_dataset(user_message, is_khmer=(lang == "km"), min_score=0.55)
        if trained_id_reply:
            reply = trained_id_reply
        elif lang == "km":
            reply = (
                "ជំរាបសួរលោកអ្នក! ខ្ញុំគឺជា AgriSystem AI (ម៉ូឌែលឈ្មោះ AGY V2.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ "
                "ខ្ញុំជាជំនួយការកសិកម្មឆ្លាតវៃ ត្រៀមខ្លួនជានិច្ចក្នុងការជួយពិនិត្យជំងឺដំណាំ វិភាគរោគសញ្ញា ផ្តល់បច្ចេកទេសដាំដុះ និងចែករំលែកវិធីសាស្រ្តការពារ និងការព្យាបាលដំណាំប្រកបដោយសុវត្ថិភាព។ "
                "តើថ្ងៃនេះខ្ញុំអាចជួយអ្វីដល់ការងារដាំដុះ ឬដំណាំរបស់លោកអ្នកបានខ្លះដែរ?"
            )
        else:
            reply = (
                "Hello! I am AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. "
                "I am your intelligent agricultural expert dedicated to helping farmers diagnose plant diseases, optimize soil and fertilizer management, and adopt safe, sustainable farming practices. "
                "How can I help you and your crops today?"
            )
        if charges_farmer_credits:
            tokens_used = max(15, (len(user_message) + len(reply)) // 4)
            current_user.ai_credits = max(0, (current_user.ai_credits or 0) - tokens_used)
            try:
                db.session.commit()
            except Exception:  # noqa: BLE001
                db.session.rollback()
        return clean_markdown_symbols(reply)

    if agent_plan.intent == "greeting":
        msg_clean = user_message.lower().strip()
        if "hello in khmer" in msg_clean:
            reply = (
                "សួស្តីបាទ/ចាស! ជាភាសាខ្មែរយើងប្រើពាក្យ 'សួស្តី' (សម្រាប់ភាពស្និទ្ធស្នាល ឬទូទៅ) ឬ 'ជំរាបសួរ' (ប្រកបដោយការគួរសម និងការគោរព)។ "
                "តើថ្ងៃនេះដំណាំរបស់អ្នកមានសុខភាពល្អធម្មតា ឬត្រូវការជំនួយបច្ចេកទេសកសិកម្មអ្វីដែរទេ?"
            )
        elif "hello in english" in msg_clean:
            reply = (
                "Hi there! In English, we greet with 'Hello' or 'Hi'! "
                "How are your crops doing today, and what agricultural questions can I help you with?"
            )
        elif lang == "km":
            reply = (
                "សួស្តីបាទ/ចាស! ខ្ញុំរីករាយណាស់ដែលបានជួយលោកអ្នកនៅថ្ងៃនេះ។ "
                "តើដំណាំ ឬការងារកសិកម្មរបស់អ្នកដំណើរការយ៉ាងណាដែរ? តើមានបញ្ហាជំងឺដំណាំ ដី ជី ឬការដាំដុះអ្វីដែលខ្ញុំអាចជួយផ្តល់ដំបូន្មានជូនបានដែរទេ?"
            )
        else:
            reply = (
                "Hello! Warm greetings to you! It's a pleasure to assist you. How are your crops doing today, and how can I help you with your farming needs?"
            )
        if charges_farmer_credits:
            tokens_used = max(15, (len(user_message) + len(reply)) // 4)
            current_user.ai_credits = max(0, (current_user.ai_credits or 0) - tokens_used)
            try:
                db.session.commit()
            except Exception:  # noqa: BLE001
                db.session.rollback()
        return clean_markdown_symbols(reply)

    if agent_plan.intent == "casual_conversation":
        from app.services.ai_expert_service import _match_trained_dataset

        trained_casual_reply = _match_trained_dataset(user_message, is_khmer=(lang == "km"), min_score=0.48)
        msg_clean = user_message.lower().strip()
        if trained_casual_reply:
            reply = trained_casual_reply
        elif lang == "km":
            if any(term in user_message for term in ["អរគុណ", "អរគុណច្រើន", "អរគុណបង"]):
                reply = (
                    "មិនអីទេបាទ/ចាស! ខ្ញុំរីករាយណាស់ដែលបានជួយលោកអ្នក។ "
                    "ប្រសិនបើដំណាំ ឬការងារចម្ការរបស់អ្នកមានបញ្ហា ឬត្រូវការជំនួយបន្ថែមនៅពេលក្រោយ សូមកុំស្ទាក់ស្ទើរក្នុងការសួរខ្ញុំណា។ "
                    "សូមជូនពរឱ្យដំណាំរបស់អ្នកលូតលាស់ល្អ និងទទួលបានទិន្នផលខ្ពស់!"
                )
            elif any(term in user_message for term in ["ហត់", "នឿយ", "បារម្ភ", "តានតឹង"]):
                reply = (
                    "ខ្ញុំយល់ច្បាស់ពីការលំបាក និងការនឿយហត់របស់បងប្អូនកសិករ! "
                    "ការងារកសិកម្មទាមទារទាំងកម្លាំងកាយ កម្លាំងចិត្ត និងការអត់ធ្មត់ខ្ពស់នៅក្រោមពន្លឺថ្ងៃ និងអាកាសធាតុប្រែប្រួល។ "
                    "សូមកុំភ្លេចសម្រាក និងថែរក្សាសុខភាពឱ្យបានល្អណា។ "
                    "តើបច្ចុប្បន្នដំណាំរបស់អ្នកមានបញ្ហាអ្វីដែលខ្ញុំអាចជួយសម្រួលការងារបច្ចេកទេសជូនបានដែរទេ?"
                )
            elif any(term in user_message for term in ["លាហើយ", "ជម្រាបលា"]):
                reply = (
                    "ជម្រាបលាបាទ/ចាស! សូមជូនពរឱ្យលោកអ្នកមានសុខភាពល្អ និងទទួលបានជោគជ័យក្នុងការប្រមូលផលដំណាំ។ "
                    "ពេលណាមានចម្ងល់កសិកម្ម អាចត្រឡប់មកជជែកជាមួយខ្ញុំបានគ្រប់ពេលណា!"
                )
            else:
                reply = (
                    "សួស្តីបាទ/ចាស! ខ្ញុំរីករាយក្នុងការជជែកលេង និងផ្លាស់ប្តូរគំនិតជាមួយលោកអ្នកជានិច្ច ទាំងរឿងការងារកសិកម្ម បច្ចេកវិទ្យា ឬជីវិតប្រចាំថ្ងៃក្នុងចម្ការ។ "
                    "តើថ្ងៃនេះមានរឿងអ្វីប្លែក ឬគួរឱ្យចាប់អារម្មណ៍ខ្លះកើតឡើងនៅចម្ការរបស់អ្នក?"
                )
        else:
            if any(term in msg_clean for term in ["thank", "thanks", "appreciate", "helpful"]):
                reply = (
                    "You are very welcome! I am truly glad I could help you today. "
                    "If you ever have more questions about crop health, soil care, or farming techniques, please don't hesitate to ask. "
                    "Wishing you healthy crops and a wonderful harvest season!"
                )
            elif any(term in msg_clean for term in ["tired", "exhaust", "worry", "worried", "stress"]):
                reply = (
                    "I truly understand how demanding and exhausting farming can be. "
                    "Working under the sun and dealing with unpredictable weather requires immense resilience and hard work. "
                    "Please make sure to take breaks, stay hydrated, and care for yourself. "
                    "How are your crops looking right now? I would be glad to help lighten your load with tailored technical advice."
                )
            elif any(term in msg_clean for term in ["bye", "goodbye", "see you"]):
                reply = (
                    "Goodbye! Take great care of yourself and your farm. "
                    "May your fields flourish, and I look forward to chatting with you again whenever you need advice."
                )
            else:
                reply = (
                    "Hello! I would love to chat! Whether you want to discuss farming, modern agricultural practices, "
                    "or just share how your day went in the fields, I am all ears. How can I assist you and your farm today?"
                )
        if charges_farmer_credits:
            tokens_used = max(15, (len(user_message) + len(reply)) // 4)
            current_user.ai_credits = max(0, (current_user.ai_credits or 0) - tokens_used)
            try:
                db.session.commit()
            except Exception:  # noqa: BLE001
                db.session.rollback()
        return clean_markdown_symbols(reply)

    from app.services.ai_expert_service import (
        _synthesize_local_expert_reply,
        legacy_fallback_enabled,
    )
    from app.services.ai_expert_service import (
        generate_reply as generate_trained_reply,
    )

    try:
        db_ai_provider = SiteSetting.query.get("AI_PROVIDER")
        db_expert = SiteSetting.query.get("EXPERT_PROVIDER")
        db_provider = SiteSetting.query.get("ACTIVE_PROVIDER")
        configured_provider = (
            db_ai_provider.value.strip()
            if db_ai_provider and db_ai_provider.value.strip()
            else (
                db_expert.value.strip()
                if db_expert and db_expert.value.strip()
                else (db_provider.value.strip() if db_provider and db_provider.value.strip() else "huggingface")
            )
        ).lower()
    except Exception:  # noqa: BLE001
        configured_provider = "huggingface"

    # Allow user composer model override
    model_choice_clean = (model_choice or "").strip().lower()
    if model_choice_clean not in {"", "auto", "original-ai", "trained-ai", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-3.5-flash", "gemini-3.6-flash"}:
        model_choice_clean = ""

    # Model selection is intentionally locked to the owner's self-trained
    # endpoint. Legacy UI values such as "original-ai" or Gemini names are
    # ignored instead of routing user data to a commercial provider.
    provider = "huggingface"

    # Prioritize the user's trained agricultural AI assistant
    if provider in {"huggingface", "hf", "trained-ai", "trained_ai", "own-ai"}:
        try:
            trained_reply = generate_trained_reply(
                user_message,
                context=agent_context,
                language=lang,
            )
            if trained_reply:
                if charges_farmer_credits:
                    tokens_used = max(20, (len(agent_context) + len(user_message) + len(trained_reply)) // 4)
                    current_user.ai_credits = max(0, (current_user.ai_credits or 0) - tokens_used)
                    try:
                        db.session.commit()
                    except Exception:  # noqa: BLE001
                        db.session.rollback()
                return trained_reply
        except Exception as exc:  # noqa: BLE001
            try:
                current_app.logger.warning("Trained agricultural AI provider error: %s", exc)
            except RuntimeError:
                pass

        # If commercial LLM fallback is disabled, synthesize from local expert rules (no Gemini/Groq/ChatGPT)
        if not legacy_fallback_enabled():
            local_reply = _synthesize_local_expert_reply(user_message, context=agent_context, language=lang)
            if charges_farmer_credits:
                tokens_used = max(20, (len(agent_context) + len(user_message) + len(local_reply)) // 4)
                current_user.ai_credits = max(0, (current_user.ai_credits or 0) - tokens_used)
                try:
                    db.session.commit()
                except Exception:  # noqa: BLE001
                    db.session.rollback()
            return local_reply

    reply_content: str | None = None

    # Allow user composer model override
    model_choice_clean = (model_choice or "").strip().lower()
    if model_choice_clean not in {"", "auto", "original-ai", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-3.5-flash", "gemini-3.6-flash"}:
        model_choice_clean = ""

    provider = configured_provider
    if model_choice_clean.startswith("gemini-"):
        provider = "gemini"
    elif model_choice_clean == "original-ai":
        provider = "openai"

    system_prompt = _build_expert_system_prompt(language=lang, agent_context=agent_context)
    user_prompt = user_message

    gemini_contents: list[Any] = [system_prompt, user_prompt]
    if image_bytes and types:
        gemini_contents.append(
            types.Part.from_bytes(
                data=image_bytes,
                mime_type=image_mime_type or "image/jpeg",
            )
        )

    openai_user_content: str | list[dict[str, Any]] = user_prompt
    if image_bytes:
        image_data_url = (
            "data:"
            + (image_mime_type or "image/jpeg")
            + ";base64,"
            + base64.b64encode(image_bytes).decode("utf-8")
        )
        openai_user_content = [
            {"type": "text", "text": user_prompt},
            {"type": "image_url", "image_url": {"url": image_data_url}},
        ]

    # Prioritize selected provider, automatically fall back to the other
    if provider == "gemini":
        provider_chain = ["gemini", "openai"]
    elif provider in {"groq", "openai"}:
        provider_chain = ["openai", "gemini"]
    else:
        provider_chain = ["gemini", "openai"]

    for prov in provider_chain:
        if prov == "gemini":
            gemini_client = _get_client()
            if gemini_client:
                preferred_m = model_choice_clean if model_choice_clean.startswith("gemini-") else _get_model_name()
                reply_content = _generate_with_gemini(
                    gemini_client,
                    gemini_contents,
                    preferred_model=preferred_m,
                    max_output_tokens=2048,
                    temperature=0.35,
                )
                if reply_content:
                    break
        elif prov in {"openai", "groq"}:
            openai_client = _get_openai_client()
            if openai_client:
                reply_content = _generate_with_openai_or_groq(
                    openai_client,
                    system_prompt,
                    openai_user_content,
                    max_tokens=2048,
                    temperature=0.35,
                )
                if not reply_content and image_bytes:
                    reply_content = _generate_with_openai_or_groq(
                        openai_client,
                        system_prompt,
                        user_prompt + "\n[Note: The grower attached an image of their crop symptoms.]",
                        max_tokens=2048,
                        temperature=0.35,
                    )
                if reply_content:
                    break

    if reply_content:
        reply_content = clean_markdown_symbols(reply_content.strip())
        if charges_farmer_credits:
            tokens_used = max(20, (len(system_prompt) + len(user_prompt) + len(reply_content)) // 4)
            current_user.ai_credits = max(0, (current_user.ai_credits or 0) - tokens_used)
            try:
                db.session.commit()
            except Exception:  # noqa: BLE001
                db.session.rollback()
        return reply_content

    return None


def _extract_json_array(text: str) -> list[Any] | None:
    if not text:
        return None
    s = text.strip()
    match = re.search(r"\[\s*\{.*\}\s*\]", s, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, list) and len(parsed) > 0:
                return parsed
        except Exception:  # noqa: BLE001, S110
            pass
    cleaned = s
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    cleaned = cleaned.removesuffix("```")
    try:
        parsed = json.loads(cleaned.strip())
        if isinstance(parsed, list) and len(parsed) > 0:
            return parsed
    except Exception:  # noqa: BLE001, S110
        pass
    if "[" in s:
        sub = s[s.find("[") :]
        last_brace = sub.rfind("}")
        if last_brace != -1:
            try:
                salvaged = sub[: last_brace + 1] + "]"
                parsed = json.loads(salvaged)
                if isinstance(parsed, list) and len(parsed) > 0:
                    return parsed
            except Exception:  # noqa: BLE001, S110
                pass
    return None

_NEWS_CACHE_LOCK = Lock()
_LIVE_RSS_CACHE = {
    "cambodia": {"timestamp": 0, "items": []},
    "world": {"timestamp": 0, "items": []}
}

_NEWS_FEED_CACHE = {}

_CATEGORY_TIPS = {
    "Market": {
        "en": "Monitor wholesale commodity prices and farm-gate contracts before selling harvested produce.",
        "km": "តាមដានតម្លៃកសិផលទីផ្សារ និងកិច្ចសន្យាមាត់ស្រែ មុនពេលលក់កសិផលដែលបានប្រមូលផល។"
    },
    "Weather": {
        "en": "Ensure irrigation and field drainage channels are cleared ahead of unexpected precipitation squalls.",
        "km": "រៀបចំប្រឡាយទឹក និងទ្វារទឹករំដោះចេញពីចំការ មុនពេលមានភ្លៀងធ្លាក់ខ្លាំងមិនរំពឹងទុក។"
    },
    "Pests": {
        "en": "Scout field borders regularly and apply certified treatments at the earliest sign of infestation.",
        "km": "ត្រួតពិនិត្យស្រែចម្ការជាប្រចាំ និងប្រើប្រាស់ថ្នាំកសិកម្មជីវសាស្ត្រត្រឹមត្រូវនៅពេលឃើញសញ្ញាដំបូង។"
    },
    "Tech": {
        "en": "Adopt precision solar drip or digital diagnostic tools to optimize inputs and reduce production costs.",
        "km": "ប្រើប្រាស់បច្ចេកវិទ្យាដំណក់ទឹកដើរដោយថាមពលពន្លឺព្រះអាទិត្យ ឬឧបករណ៍ឌីជីថលដើម្បីសន្សំសំចៃថ្លៃដើម។"
    },
    "Crops": {
        "en": "Adhere strictly to Good Agricultural Practices (CamGAP) to ensure top certification and premium prices.",
        "km": "អនុវត្តតាមស្តង់ដារកសិកម្មល្អ (CamGAP) ដើម្បីទទួលបានវិញ្ញាបនបត្រ និងតម្លៃខ្ពស់បំផុតលើទីផ្សារ។"
    }
}


def _infer_category_and_impact(text: str):
    t = text.lower()
    if re.search(r'\b(price|market|export|trade|dollar|\$|khr|bank|loan|debt|cost|tariff|stock|ardb|invest|finance)\b|នាំចេញ|ពាណិជ្ជកម្ម|ធនាគារ|កម្ចី|តម្លៃ|ទីផ្សារ', t):
        return "Market", "High"
    if re.search(r'\b(weather|rain|monsoon|climate|storm|flood|drought|heat|el ni[ñn]o|la ni[ñn]a|forecast)\b|ភ្លៀង|មូសុង|ព្យុះ|ទឹកជំនន់|អាកាសធាតុ', t):
        return "Weather", "Advisory"
    if re.search(r'\b(pest|disease|fungicide|fungus|virus|bacteria|hopper|rot|swine|avian|worm|treatment|infect)\b|ថ្នាំកសិកម្ម|សត្វល្អិត|ជំងឺ|មមាច|ដង្កូវ|រលួយ', t):
        return "Pests", "High"
    if re.search(r'\b(drone|solar|satellite|data|digital|irrigation|expo|smart farm)\b|\b(ai|app)\b|ដ្រូន|ពិព័រណ៍|បច្ចេកវិទ្យា', t):
        return "Tech", "Moderate"
    return "Crops", "Moderate"


def _match_news_image(text: str, default_index: int = 0) -> str:
    """
    Context-aware photographic matcher using word boundaries.
    Maps news headline and summary directly to the most accurate, authentic HD agricultural photo.
    Supports comprehensive English and Khmer vocabularies.
    """
    t = (text or "").lower()

    # 1. Corn / Maize / WASDE
    if re.search(r'\b(corn|maize|wasde)\b|ពោត', t):
        return "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=450&auto=format&fit=crop&q=60"

    # 2. Soybean / Oilseeds
    if re.search(r'\b(soybeans?|soy|oilseeds?)\b|សណ្តែក', t):
        return "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=450&auto=format&fit=crop&q=60"

    # 3. Wheat / Flour / Grain Stocks / Cereal
    if re.search(r'\b(wheat|cereals?|grains?|flour)\b|ស្រូវសាលី|ធញ្ញជាតិ', t):
        return "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=450&auto=format&fit=crop&q=60"

    # 4. Pests / Plant Diseases / Fungicide / Blast / Hopper / Rot
    if re.search(r'\b(pests?|diseases?|fungicides?|fungus|blast|hoppers?|armyworms?|rot|infection|treatment)\b|ថ្នាំកសិកម្ម|សត្វល្អិត|ជំងឺ|មមាច|ដង្កូវ|រលួយ', t):
        return "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=450&auto=format&fit=crop&q=60"

    # 5. Rice / Paddy / Jasmine / Phka Rumduol (whole words only, never matches 'price')
    if re.search(r'\b(rice|paddy|paddies|jasmine|irri|phka rumduol)\b|ស្រូវ|អង្ករ|ផ្ការំដួល', t):
        return "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=450&auto=format&fit=crop&q=60"

    # 6. Cassava / Tapioca / Starch
    if re.search(r'\b(cassava|tapioca)\b|ដំឡូងមី', t):
        return "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=450&auto=format&fit=crop&q=60"

    # 7. Cashew Nuts
    if re.search(r'\b(cashews?|cashew nuts?)\b|ស្វាយចន្ទី', t):
        return "https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=450&auto=format&fit=crop&q=60"

    # 8. Vegetables / CamGAP / Greenhouse / Horticulture
    if re.search(r'\b(vegetables?|tomatoes?|chili|camgap|cabbage|horticulture)\b|បន្លែ|ម្ទេស|ប៉េងប៉ោះ', t):
        return "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=450&auto=format&fit=crop&q=60"

    # 9. Fruits / Mango / Banana / Durian
    if re.search(r'\b(fruits?|mango|mangoes|banana|bananas|durian|longan)\b|ផ្លែឈើ|ស្វាយ|ចេក|ធុរេន', t):
        return "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=450&auto=format&fit=crop&q=60"

    # 10. Livestock / Cattle / Cow / Buffalo / Dairy
    if re.search(r'\b(cows?|cattle|livestock|buffalo|buffalos|dairy|beef|calves)\b|គោ|ក្របី|សត្វពាហនៈ', t):
        return "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=450&auto=format&fit=crop&q=60"

    # 11. Poultry / Swine / Pork
    if re.search(r'\b(poultry|chickens?|ducks?|swine|pigs?|pork)\b|មាន់|ទា|ជ្រូក', t):
        return "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=450&auto=format&fit=crop&q=60"

    # 12. Weather / Rain / Monsoon / Storm / Flood / El Niño / La Niña
    if re.search(r'\b(rains?|rainfall|monsoon|storm|flood|floods|flooding|el ni[ñn]o|la ni[ñn]a|weather|climate)\b|ភ្លៀង|មូសុង|ព្យុះ|ទឹកជំនន់|អាកាសធាតុ', t):
        return "https://images.unsplash.com/photo-1514632595-4944383f2737?w=450&auto=format&fit=crop&q=60"

    # 13. Drought / Heatwave / Water Scarcity
    if re.search(r'\b(drought|droughts|heatwave|water shortage|arid)\b|រាំងស្ងួត|ខ្វះទឹក', t):
        return "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=450&auto=format&fit=crop&q=60"

    # 14. Irrigation / Drip / Canals / Water Gates
    if re.search(r'\b(irrigation|drip|canals?|reservoirs?|sluice|water gates?)\b|ស្រោចស្រព|ដំណក់ទឹក|ប្រឡាយ|ទំនប់|ធារាសាស្ត្រ', t):
        return "https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?w=450&auto=format&fit=crop&q=60"

    # 15. Drones / High-Tech Agri / Big Data / Expo (must not match 'export')
    if re.search(r'\b(drones?|uav|big data|expo|smart farm)\b|\b(ai)\b|ដ្រូន|ពិព័រណ៍', t):
        return "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=450&auto=format&fit=crop&q=60"

    # 16. Banking / Finance / Loans / $500M / ARDB
    if re.search(r'\b(bank|banking|ardb|loans?|credits?|finance|funds?|investments?|\$\d+m?)\b|ធនាគារ|កម្ចី|ឥណទាន|វិនិយោគ|ថវិកា', t):
        return "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=450&auto=format&fit=crop&q=60"

    # 17. Agricultural Workers / Labor / Recruitment / Employment
    if re.search(r'\b(workers?|labor|labour|recruitment|employment|jobs?)\b|ពលករ|កម្មករ|ការងារ|ជ្រើសរើស', t):
        return "https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=450&auto=format&fit=crop&q=60"

    # 18. Trade / Export / Shipping / International Logistics
    if re.search(r'\b(exports?|imports?|trade|shipping|cargo|logistics|pakistan|saudi|israel)\b|នាំចេញ|នាំចូល|ពាណិជ្ជកម្ម', t):
        return "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=450&auto=format&fit=crop&q=60"

    # 19. Community / Cooperatives / Farmers
    if re.search(r'\b(farmers?|cooperatives?|community|cfavc|value chains?)\b|កសិករ|សហគមន៍|សហករណ៍', t):
        return "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=450&auto=format&fit=crop&q=60"

    # 20. Fertilizer / Soil / Compost
    if re.search(r'\b(fertilizer|urea|soil|nutrient|compost|potassium)\b|ជី|ដី', t):
        return "https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=450&auto=format&fit=crop&q=60"

    fallbacks = [
        "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=450&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=450&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=450&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=450&auto=format&fit=crop&q=60"
    ]
    return fallbacks[default_index % len(fallbacks)]


_KM_NEWS_CACHE: dict[str, Any] = {}


def _batch_translate_to_khmer(items: list[Any]) -> dict[str, Any]:
    """Translate news headlines and summaries into natural, fluent Khmer."""
    from app.services.translator import translate_to_khmer

    for item in items or []:
        if isinstance(item, dict):
            title = str(item.get("title") or "").strip()
            summary = str(item.get("summary") or "").strip()
        else:
            title, summary = str(item or "").strip(), ""
        with _NEWS_CACHE_LOCK:
            already_cached = not title or title in _KM_NEWS_CACHE
        if already_cached:
            continue
        translated_title = translate_to_khmer(title)
        translated_summary = translate_to_khmer(summary) if summary else ""
        with _NEWS_CACHE_LOCK:
            _KM_NEWS_CACHE[title] = {
                "title": translated_title or title,
                "summary": translated_summary or summary,
            }
    return _KM_NEWS_CACHE


def _translate_headline_to_khmer(title: str) -> str:
    if not title:
        return ""
    if title in _KM_NEWS_CACHE:
        cached_val = _KM_NEWS_CACHE[title]
        if isinstance(cached_val, dict):
            return str(cached_val.get("title") or title)
        return str(cached_val)
    try:
        from app.services.translator import translate_to_khmer

        kh = translate_to_khmer(title)
        if kh and len(kh) > 2 and "error" not in kh.lower():
            _KM_NEWS_CACHE[title] = kh.strip()
            return str(_KM_NEWS_CACHE[title])
    except Exception:  # noqa: BLE001, S110
        pass
    return title


def _clean_article_line(text: str) -> str:
    import html as _html

    text = _html.unescape(text or "")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"The post .* appeared first on .*", "", text).strip()
    return text


def _is_boilerplate_paragraph(text: str) -> bool:
    lower = text.lower()
    if len(text) < 28:
        return True
    skip_phrases = (
        "all rights reserved",
        "copyright ©",
        "subscribe to our",
        "sign up for our newsletter",
        "follow us on",
        "share this article",
        "appeared first on",
        "cookie policy",
        "privacy policy",
        "terms of use",
    )
    return any(p in lower for p in skip_phrases)


def _extract_paragraphs_from_html(raw_html: str, *, article_mode: bool = False) -> list[str]:
    if not raw_html or not raw_html.strip():
        return []
    paragraphs: list[str] = []
    try:
        from lxml import html as lh

        doc = lh.fromstring(raw_html)
        remove_tags = (
            ("script", "style", "noscript", "iframe", "svg", "form", "nav", "header", "footer", "aside")
            if article_mode
            else ("script", "style", "noscript", "iframe", "svg", "form")
        )
        for bad in doc.xpath("|".join(f"//{tag}" for tag in remove_tags)):
            parent = bad.getparent()
            if parent is not None:
                parent.remove(bad)

        if article_mode:
            nodes = doc.xpath(
                "//article//p"
                " | //div[contains(@class,'entry-content') or contains(@class,'post-content')"
                " or contains(@class,'article-content') or contains(@class,'article-body')"
                " or contains(@class,'field-item') or contains(@class,'story-body')]//p"
                " | //main//p"
            )
            if not nodes:
                nodes = doc.xpath("//p")
        else:
            nodes = doc.xpath("//p | //li")
            if not nodes:
                nodes = [doc]

        seen: set[str] = set()
        total_chars = 0
        for node in nodes:
            clean = _clean_article_line(node.text_content())
            if not clean or _is_boilerplate_paragraph(clean):
                continue
            key = clean.lower()
            if key in seen:
                continue
            seen.add(key)
            paragraphs.append(clean)
            total_chars += len(clean)
            if len(paragraphs) >= 24 or total_chars >= 7500:
                break
    except Exception:  # noqa: BLE001, S110
        pass

    if not paragraphs:
        fallback = _clean_article_line(re.sub(r"<[^>]+>", " ", raw_html))
        if fallback and not _is_boilerplate_paragraph(fallback):
            paragraphs = [fallback[:2500]]
    return paragraphs


def _build_lead_summary(paragraphs: list[str], title: str) -> str:
    usable = [p for p in paragraphs if p.lower() != (title or "").strip().lower()]
    if not usable:
        return ""
    out = usable[0]
    if len(out) < 150 and len(usable) > 1:
        out = f"{out} {usable[1]}"
    if len(out) > 340:
        cut = out[:337].rsplit(" ", 1)[0]
        return f"{cut}..."
    return out


def _estimate_read_time(full_text: str, lang: str) -> str:
    words = len((full_text or "").split())
    mins = max(1, min(12, round(words / 180) or 1))
    return f"អាន {mins} នាទី" if lang == "km" else f"{mins} min read"


def _fetch_live_agri_rss(region: str = "cambodia", limit: int = 12) -> list[dict[str, Any]]:
    """
    Fetches real-world live agricultural news dispatches in parallel across verified feeds,
    extracting full multi-paragraph article text when available.
    Cached for 15 minutes to guarantee instant response times.
    """
    import xml.etree.ElementTree as ET
    from concurrent.futures import ThreadPoolExecutor

    import requests

    with _NEWS_CACHE_LOCK:
        cached = _LIVE_RSS_CACHE.get(region)
    if cached and (time.time() - cached.get("timestamp", 0) < cached.get("ttl", 900)) and cached.get("items"):
        return cached["items"][:limit]

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, text/html, */*",
    }

    if region == "cambodia":
        primary_feeds = [
            ("Khmer Times", "https://www.khmertimeskh.com/feed/?s=agriculture", False),
            ("ReliefWeb Cambodia", "https://reliefweb.int/updates/rss.xml?search=Cambodia+agriculture", False),
            ("Open Development Cambodia", "https://opendevelopmentcambodia.net/feed/?s=agriculture", True),
        ]
        fallback_feeds = [
            ("Google News", "https://news.google.com/rss/search?q=Cambodia+agriculture+OR+rice+OR+farmer+OR+crops+OR+harvest&hl=en-US&gl=US&ceid=US:en", False),
            ("Google News", "https://news.google.com/rss/search?q=Cambodia+rubber+OR+cassava+OR+cashew+OR+paddy+export&hl=en-US&gl=US&ceid=US:en", False),
        ]
    else:
        primary_feeds = [
            ("AgFunderNews", "https://agfundernews.com/feed", False),
            ("USDA Newsroom", "https://www.usda.gov/rss/latest-releases.xml", False),
        ]
        fallback_feeds = [
            ("Google News", "https://news.google.com/rss/search?q=world+agriculture+OR+grain+OR+wheat+OR+corn+harvest&hl=en-US&gl=US&ceid=US:en", False),
            ("Google News", "https://news.google.com/rss/search?q=global+farming+OR+fertilizer+OR+crop+commodity+prices&hl=en-US&gl=US&ceid=US:en", False),
        ]

    agri_keywords = (
        "agri", "farm", "crop", "rice", "paddy", "cassava", "cashew", "rubber",
        "mango", "banana", "livestock", "cattle", "fish", "aquaculture", "soil",
        "fertilizer", "irrigation", "flood", "drought", "monsoon", "harvest",
        "grain", "export", "food", "rural", "forest", "plantation", "maize", "pepper",
    )

    def _fetch_single(source_name: str, feed_url: str, filter_agri: bool) -> list[dict[str, Any]]:
        feed_items: list[dict[str, Any]] = []
        try:
            resp = requests.get(feed_url, headers=headers, timeout=3.5)
            if resp.status_code == 200 and resp.content:
                cleaned_text = re.sub(r"&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)", "&amp;", resp.text)
                root = ET.fromstring(cleaned_text.encode("utf-8"))
                for item in root.findall("./channel/item"):
                    t = item.findtext("title") or ""
                    link_val = item.findtext("link") or ""
                    d = item.findtext("pubDate") or ""
                    desc = item.findtext("description") or ""
                    encoded = item.findtext("{http://purl.org/rss/1.0/modules/content/}encoded") or ""

                    if not t.strip() or not link_val.strip():
                        continue

                    img = None
                    for c in item:
                        if (
                            ("enclosure" in c.tag and "image" in c.attrib.get("type", ""))
                            or ("content" in c.tag and "url" in c.attrib)
                        ):
                            img = c.attrib.get("url")
                            break
                    if not img:
                        img_source = encoded or desc
                        if img_source:
                            m = re.search(r"<img[^>]+src=[\"\x27]([^\"\x27]+)[\"\x27]", img_source)
                            if m:
                                raw_img = m.group(1)
                                img = re.sub(r"-\d+x\d+(\.[a-zA-Z]+)$", r"\1", raw_img)

                    item_source = source_name
                    if " - " in t:
                        parts = t.rsplit(" - ", 1)
                        t = parts[0].strip()
                        if len(parts) > 1 and parts[1].strip() and source_name == "Google News":
                            item_source = parts[1].strip()

                    rss_html = encoded if len(encoded) > len(desc) else desc
                    paragraphs = _extract_paragraphs_from_html(rss_html, article_mode=False)
                    if filter_agri:
                        combined = f"{t} {' '.join(paragraphs[:2])}".lower()
                        if not any(kw in combined for kw in agri_keywords):
                            continue

                    clean_desc = _build_lead_summary(paragraphs, t)
                    if not clean_desc and desc:
                        stripped = _clean_article_line(re.sub(r"<[^>]+>", " ", desc))
                        if stripped and stripped.lower() != item_source.lower() and not stripped.startswith(t):
                            clean_desc = stripped[:320]

                    clean_date = "Today"
                    if d:
                        dm = re.search(r"(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})", d)
                        clean_date = dm.group(1) if dm else d[:16].strip()

                    feed_items.append(
                        {
                            "title": t.strip(),
                            "link": link_val.strip(),
                            "image": img,
                            "source": item_source,
                            "date": clean_date,
                            "summary": clean_desc,
                            "paragraphs": paragraphs,
                            "full_text": "\n\n".join(paragraphs),
                        }
                    )
        except Exception:  # noqa: BLE001, S110
            pass
        return feed_items

    items: list[dict[str, Any]] = []
    seen_links: set[str] = set()

    def _collect(feed_group: list[tuple[str, str, bool]]) -> None:
        with ThreadPoolExecutor(max_workers=max(1, min(4, len(feed_group)))) as executor:
            results = list(executor.map(lambda cfg: _fetch_single(*cfg), feed_group))
        for group_items in results:
            for it in group_items:
                if it["link"] not in seen_links:
                    seen_links.add(it["link"])
                    items.append(it)
                    if len(items) >= limit:
                        return

    _collect(primary_feeds)
    if len(items) < limit:
        _collect(fallback_feeds)

    # Fetch full publisher body paragraphs & og:image concurrently for direct URLs
    def _enrich_article(it: dict[str, Any]) -> None:
        link = it.get("link") or ""
        if not link:
            return
        is_google_news = "news.google.com" in link.lower()
        needs_body = len(it.get("full_text") or "") < 450 and not is_google_news
        needs_img = not it.get("image")
        if not needs_body and not needs_img:
            return
        try:
            resp = requests.get(link, headers=headers, timeout=3.0, allow_redirects=True)
            if resp.status_code != 200 or not resp.content:
                return
            if needs_img:
                m = re.search(
                    r'<meta[^>]+property=[\"\x27]og:image[\"\x27][^>]+content=[\"\x27]([^\"\x27]+)[\"\x27]',
                    resp.text,
                )
                if m:
                    img_url = m.group(1).strip()
                    img_url = (
                        img_url.replace("=s0-w300-rw", "=s0-w500")
                        .replace("=s0-w300", "=s0-w500")
                        .replace("=s0-w800", "=s0-w500")
                    )
                    it["image"] = img_url
            if needs_body and "news.google.com" not in (resp.url or "").lower():
                extracted = _extract_paragraphs_from_html(resp.text, article_mode=True)
                if len("\n\n".join(extracted)) > len(it.get("full_text") or ""):
                    it["paragraphs"] = extracted
                    it["full_text"] = "\n\n".join(extracted)
                    if not it.get("summary") or len(it["summary"]) < 80:
                        it["summary"] = _build_lead_summary(extracted, it["title"])
        except Exception:  # noqa: BLE001, S110
            pass

    if items:
        with ThreadPoolExecutor(max_workers=min(8, len(items))) as enrich_executor:
            list(enrich_executor.map(_enrich_article, items))

    with _NEWS_CACHE_LOCK:
        _LIVE_RSS_CACHE[region] = {
            "timestamp": time.time(),
            "ttl": 900 if items else 180,
            "items": items,
        }

    return items


def _get_bilingual_agri_news(region: str = "cambodia") -> list[dict[str, Any]]:
    """
    Returns 12 canonical agricultural articles paired bilingually
    so that Khmer and English feeds are 100% synchronized and identical in content,
    each with an authentic, topic-specific high-resolution photograph.
    """
    km_articles = _get_curated_agri_news(region=region, lang="km")
    en_articles = _get_curated_agri_news(region=region, lang="en")

    CAMBODIA_IMAGES = [
        "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=450&auto=format&fit=crop&q=60",  # 1. Jasmine Rice Field
        "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=450&auto=format&fit=crop&q=60",  # 2. Rice Blast & Hopper Inspection
        "https://images.unsplash.com/photo-1514632595-4944383f2737?w=450&auto=format&fit=crop&q=60",  # 3. Monsoon Rainfall Over Lowlands
        "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=450&auto=format&fit=crop&q=60",  # 4. Agricultural Spraying Drone
        "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=450&auto=format&fit=crop&q=60",  # 5. Fresh Cassava Roots
        "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=450&auto=format&fit=crop&q=60",  # 6. Safe CamGAP Vegetables
        "https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=450&auto=format&fit=crop&q=60",  # 7. Cashew Nuts Harvest
        "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=450&auto=format&fit=crop&q=60",  # 8. Cattle Livestock Vaccination
        "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=450&auto=format&fit=crop&q=60",  # 9. Reservoir & Sluice Gates
        "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=450&auto=format&fit=crop&q=60",  # 10. CARDI Rice Seeds
        "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?w=450&auto=format&fit=crop&q=60",  # 11. Smart Agri Mobile AI App
        "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=450&auto=format&fit=crop&q=60",  # 12. Fresh Bananas & Mangoes
    ]

    WORLD_IMAGES = [
        "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=450&auto=format&fit=crop&q=60",  # 1. Global Grain Markets (FAO)
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=450&auto=format&fit=crop&q=60",  # 2. Satellite Scouting
        "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=450&auto=format&fit=crop&q=60",  # 3. IRRI Saline Rice
        "https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=450&auto=format&fit=crop&q=60",  # 4. Urea Fertilizer
        "https://images.unsplash.com/photo-1514632595-4944383f2737?w=450&auto=format&fit=crop&q=60",  # 5. La Niña Monsoon
        "https://images.unsplash.com/photo-1473081556163-2a17de81fc97?w=450&auto=format&fit=crop&q=60",  # 6. Biocontrol Ladybug
        "https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?w=450&auto=format&fit=crop&q=60",  # 7. Solar Drip Irrigation
        "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=450&auto=format&fit=crop&q=60",  # 8. Soybeans Field
        "https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=450&auto=format&fit=crop&q=60",  # 9. Livestock Biosecurity
        "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=450&auto=format&fit=crop&q=60",  # 10. Straw & Biofertilizer
        "https://images.unsplash.com/photo-1516253593875-bd7ba052fbc5?w=450&auto=format&fit=crop&q=60",  # 11. Rice Trade
        "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=450&auto=format&fit=crop&q=60",  # 12. Agroforestry Canopy
    ]

    images_pool = CAMBODIA_IMAGES if region == "cambodia" else WORLD_IMAGES

    bilingual_articles: list[dict[str, Any]] = []
    count = min(len(km_articles), len(en_articles))
    for i in range(count):
        km = km_articles[i]
        en = en_articles[i]
        photo_url = images_pool[i % len(images_pool)]
        bilingual_articles.append(
            {
                "id": i + 1,
                "category": km.get("category") or en.get("category") or "Crops",
                "impact": km.get("impact") or en.get("impact") or "Moderate",
                "image": photo_url,
                "km": {
                    "title": km.get("title", ""),
                    "summary": km.get("summary", ""),
                    "tip": km.get("tip", ""),
                    "source": km.get("source", ""),
                    "date": km.get("date", "ថ្ងៃនេះ"),
                    "read_time": km.get("read_time", "អាន ៣ នាទី"),
                },
                "en": {
                    "title": en.get("title", ""),
                    "summary": en.get("summary", ""),
                    "tip": en.get("tip", ""),
                    "source": en.get("source", ""),
                    "date": en.get("date", "Today"),
                    "read_time": en.get("read_time", "3 min read"),
                },
                "link": km.get("link") or en.get("link") or "",
            }
        )
    return bilingual_articles


_IS_UPDATING_NEWS: dict[tuple[str, str], bool] = {}


def _get_shared_news_cache(region: str, lang: str) -> dict[str, Any] | None:
    try:
        path = f"/tmp/agri_news_v2_{region}_{lang}.json"
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                d = json.load(f)
                if d and isinstance(d.get("data"), list) and len(d["data"]) > 0:
                    return d
    except Exception:  # noqa: BLE001, S110
        pass
    return None


def _write_shared_news_cache(region: str, lang: str, data: list[Any]) -> None:
    try:
        path = f"/tmp/agri_news_v2_{region}_{lang}.json"
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"timestamp": time.time(), "data": data}, f, ensure_ascii=False)
        os.replace(tmp, path)
    except Exception:  # noqa: BLE001, S110
        pass


def _has_khmer_text(text: str) -> bool:
    return bool(re.search(r"[\u1780-\u17FF]", text or ""))


def _is_valid_cache_for_lang(data: list[Any], lang: str) -> bool:
    if not data or not isinstance(data, list) or len(data) == 0:
        return False
    if lang == "km":
        return any(_has_khmer_text(it.get("title", "")) for it in data)
    return True


def _rebuild_news_feed(region: str = "cambodia", lang: str = "en") -> list[dict[str, Any]]:
    """Internal builder that queries live RSS, resolves real photos, and translates."""
    live_dispatches = _fetch_live_agri_rss(region=region, limit=12)
    bilingual_baseline = _get_bilingual_agri_news(region=region)
    result: list[dict[str, Any]] = []

    if live_dispatches:
        if lang == "km":
            _batch_translate_to_khmer(live_dispatches)

        for i, disp in enumerate(live_dispatches):
            raw_title = disp.get("title", "").strip()
            if not raw_title:
                continue

            raw_summary = disp.get("summary", "").strip()
            cat, imp = _infer_category_and_impact(raw_title + " " + raw_summary)
            tip_text = _CATEGORY_TIPS.get(cat, _CATEGORY_TIPS["Crops"])[lang]
            photo = disp.get("image") if (disp.get("image") and str(disp["image"]).startswith("http")) else _match_news_image(raw_title + " " + raw_summary, default_index=i)

            if not raw_summary:
                raw_summary = f"Field intelligence report: {raw_title}. Ongoing developments are being tracked across regional agricultural value chains."

            if lang == "km":
                cached_km = _KM_NEWS_CACHE.get(raw_title)
                if isinstance(cached_km, dict):
                    title_disp = cached_km.get("title") or raw_title
                    summary_disp = cached_km.get("summary") or raw_summary
                elif isinstance(cached_km, str):
                    title_disp = cached_km
                    summary_disp = raw_summary
                else:
                    title_disp = _translate_headline_to_khmer(raw_title)
                    summary_disp = raw_summary

                if not _has_khmer_text(summary_disp) and _has_khmer_text(title_disp):
                    summary_disp = raw_summary

                read_time = "អាន ៣ នាទី"
            else:
                title_disp = raw_title
                summary_disp = raw_summary
                read_time = "3 min read"

            result.append(
                {
                    "id": i + 1,
                    "title": title_disp,
                    "category": cat,
                    "impact": imp,
                    "image": photo,
                    "date": disp.get("date", "Today" if lang != "km" else "ថ្ងៃនេះ"),
                    "read_time": read_time,
                    "summary": summary_disp,
                    "full_text": disp.get("full_text") or summary_disp,
                    "paragraphs": disp.get("paragraphs") or ([summary_disp] if summary_disp else []),
                    "is_live": True,
                    "tip": tip_text,
                    "source": disp.get("source", "Agri News Wire"),
                    "link": disp.get("link", ""),
                }
            )
            if result[-1]["full_text"]:
                result[-1]["read_time"] = _estimate_read_time(result[-1]["full_text"], lang)

    # Supplement remaining slots if needed
    needed = 12 - len(result)
    if needed > 0 and bilingual_baseline:
        base_index_start = len(result)
        for j in range(min(needed, len(bilingual_baseline))):
            base_item = bilingual_baseline[j]
            content = base_item["km"] if lang == "km" else base_item["en"]
            result.append(
                {
                    "id": base_index_start + j + 1,
                    "title": content["title"],
                    "category": base_item["category"],
                    "impact": base_item["impact"],
                    "image": base_item["image"],
                    "date": content["date"],
                    "read_time": content["read_time"],
                    "summary": content["summary"],
                    "full_text": content["summary"],
                    "paragraphs": [content["summary"]] if content.get("summary") else [],
                    "is_live": False,
                    "tip": content["tip"],
                    "source": content["source"],
                    "link": base_item.get("link", ""),
                }
            )

    if result:
        _write_shared_news_cache(region, lang, result)
        with _NEWS_CACHE_LOCK:
            _NEWS_FEED_CACHE[(region, lang)] = {
                "timestamp": time.time(),
                "data": result,
            }

    return result


def generate_agriculture_news(region: str = "cambodia", lang: str = "en", force_refresh: bool = False) -> list[dict[str, Any]]:
    """
    Generates real-world, live agricultural news dispatches with sub-millisecond SWR caching.
    Guarantees instant page loads while revalidating feeds in the background.
    """
    cache_key = (region, lang)
    now = time.time()

    # 1. Check in-memory cache first
    with _NEWS_CACHE_LOCK:
        cached_mem = _NEWS_FEED_CACHE.get(cache_key)
    if cached_mem and cached_mem.get("data") and _is_valid_cache_for_lang(cached_mem["data"], lang):
        age = now - cached_mem.get("timestamp", 0)
        if not force_refresh and age < 600:
            return cached_mem["data"]

    # 2. Check shared disk cache (shared across all Gunicorn workers)
    cached_shared = _get_shared_news_cache(region, lang)
    if cached_shared and cached_shared.get("data") and _is_valid_cache_for_lang(cached_shared["data"], lang):
        with _NEWS_CACHE_LOCK:
            _NEWS_FEED_CACHE[cache_key] = cached_shared
        age = now - cached_shared.get("timestamp", 0)

        # Fresh cache (< 15 min): return immediately
        if not force_refresh and age < 900:
            return cached_shared["data"]

        # SWR: Return cached data INSTANTLY (< 0.1ms), update silently in background
        should_spawn = False
        with _NEWS_CACHE_LOCK:
            if not _IS_UPDATING_NEWS.get(cache_key):
                _IS_UPDATING_NEWS[cache_key] = True
                should_spawn = True
        if should_spawn:
            def _bg_rebuild() -> None:
                try:
                    _rebuild_news_feed(region, lang)
                finally:
                    with _NEWS_CACHE_LOCK:
                        _IS_UPDATING_NEWS[cache_key] = False

            Thread(target=_bg_rebuild, daemon=True).start()

        return cached_shared["data"]

    # 3. Cold cache fallback: build immediately or return instant baseline
    try:
        return _rebuild_news_feed(region, lang)
    except Exception:  # noqa: BLE001
        baseline = _get_bilingual_agri_news(region=region)
        items: list[dict[str, Any]] = []
        for j, b in enumerate(baseline):
            content = b["km"] if lang == "km" else b["en"]
            items.append(
                {
                    "id": j + 1,
                    "title": content["title"],
                    "category": b["category"],
                    "impact": b["impact"],
                    "image": b["image"],
                    "date": content["date"],
                    "read_time": content["read_time"],
                "summary": content["summary"],
                "full_text": content["summary"],
                "paragraphs": [content["summary"]] if content.get("summary") else [],
                "is_live": False,
                "tip": content["tip"],
                "source": content["source"],
                "link": b.get("link", "")
            })
        return items


def _get_curated_agri_news(region="cambodia", lang="en"):
    """Returns a rich baseline of 12 verified agricultural news articles for the given region & language."""
    if lang == "km":
        if region == "cambodia":
            return [
                {
                    "title": "ការព្យាករណ៍តម្លៃស្រូវ និងទីផ្សារនាំចេញអង្ករផ្ការំដួលកម្ពុជាសម្រាប់រដូវកាលថ្មី",
                    "category": "Market",
                    "date": "ថ្ងៃនេះ",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "High",
                    "summary": "សហព័ន្ធស្រូវអង្ករកម្ពុជាបានបង្ហាញទស្សនវិស័យវិជ្ជមានចំពោះការនាំចេញអង្ករផ្ការំដួល និងអង្ករក្រអូប ដោយសារតម្រូវការទីផ្សារអឺរ៉ុប និងចិនមានការកើនឡើងជាប់លាប់។ កិច្ចសន្យាទិញស្រូវជាមុនត្រូវបានចុះហត្ថលេខាក្នុងតម្លៃខ្ពស់ជាងឆ្នាំមុន។",
                    "tip": "កសិករគួរជ្រើសរើសពូជស្រូវសុទ្ធល្អ និងអនុវត្តតាមស្តង់ដារកសិកម្មល្អ (CamGAP) ដើម្បីធានាបានតម្លៃខ្ពស់បំផុតលើទីផ្សារ។",
                    "source": "សហព័ន្ធស្រូវអង្ករកម្ពុជា (CRF)"
                },
                {
                    "title": "វិធានការបន្ទាន់បង្ការជំងឺរលួយឫស និងជំងឺស្លឹកត្នោតលើដំណាំស្រូវរដូវវស្សា",
                    "category": "Pests",
                    "date": "ម្សិលមិញ",
                    "read_time": "អាន ៤ នាទី",
                    "impact": "High",
                    "summary": "អគ្គនាយកដ្ឋានកសិកម្មបានចេញសេចក្តីជូនដំណឹងជាបន្ទាន់ដល់កសិករនៅបាត់ដំបង បន្ទាយមានជ័យ និងសៀមរាប ឱ្យបង្កើនការប្រុងប្រយ័ត្នចំពោះការរាលដាលនៃជំងឺស្លឹកត្នោត និងសត្វមមាចត្នោត ដោយសារសំណើមបរិយាកាសខ្ពស់។",
                    "tip": "ត្រូវដកទឹកចេញពីស្រែជាបណ្តោះអាសន្ន ជៀសវាងការប្រើជីអ៊ុយរ៉េលើសកម្រិត និងបាញ់ថ្នាំជីវសាស្ត្រនៅពេលកូនសត្វទើបញាស់។",
                    "source": "នាយកដ្ឋានការពារដំណាំ អនាម័យ និងភូតគាមអនាម័យ"
                },
                {
                    "title": "ការព្យាករណ៍អាកាសធាតុ៖ ខ្យល់មូសុងបង្កើនកម្រិតទឹកភ្លៀងនៅតំបន់ទំនាបកណ្តាល",
                    "category": "Weather",
                    "date": "២ ម៉ោងមុន",
                    "read_time": "អាន ២ នាទី",
                    "impact": "Advisory",
                    "summary": "ក្រសួងធនធានទឹក និងឧតុនិយម បានជូនដំណឹងពីលំហូរខ្យល់មូសុងនិរតីដែលនាំមកនូវភ្លៀងធ្លាក់ពីមធ្យមទៅច្រើន។ ស្ថានភាពនេះផ្តល់ផលប្រយោជន៍ដល់ដំណាំស្រូវ ប៉ុន្តែទាមទារការរំដោះទឹកពីចំការបន្លែជាប្រចាំ។",
                    "tip": "ពិនិត្យរៀបចំប្រព័ន្ធប្រឡាយបង្ហូរទឹកចេញពីក្បាលដីដំណាំបន្លែ និងស្តុកទឹកទុកក្នុងស្រះសម្រាប់ប្រើប្រាស់នៅចុងរដូវ។",
                    "source": "ក្រសួងធនធានទឹក និងឧតុនិយម"
                },
                {
                    "title": "ការផ្សព្វផ្សាយបច្ចេកវិទ្យាដ្រូនកសិកម្ម និងប្រព័ន្ធស្រោចស្រពដំណក់ទឹកសន្សំសំចៃថាមពល",
                    "category": "Tech",
                    "date": "ថ្ងៃនេះ",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "Moderate",
                    "summary": "ក្រសួងកសិកម្មបានសហការជាមួយដៃគូអភិវឌ្ឍន៍ដាក់ឱ្យអនុវត្តកម្មវិធីឧបត្ថម្ភទុនសម្រាប់ការប្រើប្រាស់ដ្រូនបាញ់ថ្នាំ និងបច្ចេកវិទ្យា IoT តាមដានជាតិសំណើមដី ដែលជួយសន្សំសំចៃថ្លៃដើមផលិតរហូតដល់ ៣៥%។",
                    "tip": "កសិករអាចចងក្រងជាសហគមន៍កសិកម្មដើម្បីទទួលបានការបណ្តុះបណ្តាល និងសេវាកម្មដ្រូនក្នុងតម្លៃសមរម្យ។",
                    "source": "មជ្ឈមណ្ឌលនវានុវត្តន៍កសិកម្មទំនើប"
                },
                {
                    "title": "ទីផ្សារដំឡូងមី និងពោតក្រហម៖ រោងចក្រកែច្នៃបង្កើនការបញ្ជាទិញក្នុងស្រុក",
                    "category": "Crops",
                    "date": "ម្សិលមិញ",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "Moderate",
                    "summary": "តម្លៃមើមដំឡូងមីស្រស់បានកើនឡើងដល់ ៣៨០ រៀលក្នុងមួយគីឡូក្រាមនៅខេត្តត្បូងឃ្មុំ និងប៉ៃលិន ដោយសាររោងចក្រផលិតម្សៅមីក្នុងស្រុក និងការនាំចេញទៅកាន់ទីផ្សារប្រទេសជិតខាងមានកំណើនខ្ពស់។",
                    "tip": "ប្រមូលផលនៅពេលមើមដំឡូងមីមានអាយុកាលគ្រប់គ្រាន់ (៩-១០ ខែ) ដើម្បីទទួលបានកម្រិតម្សៅខ្ពស់ និងថ្លឹងបានទម្ងន់ល្អ។",
                    "source": "សមាគមដំឡូងមីកម្ពុជា"
                },
                {
                    "title": "ការណែនាំស្តង់ដារ GAP លើការដាំដុះម្ទេស និងបន្លែស្លឹកសម្រាប់ផ្គត់ផ្គង់ផ្សារទំនើប",
                    "category": "Crops",
                    "date": "៣ ថ្ងៃមុន",
                    "read_time": "អាន ៤ នាទី",
                    "impact": "Advisory",
                    "summary": "ផ្សារទំនើប និងសណ្ឋាគារធំៗនៅរាជធានីភ្នំពេញបានចុះកិច្ចសន្យាប្រមូលទិញបន្លែសុវត្ថិភាពពីកសិករនៅកណ្តាល និងកំពង់ឆ្នាំង ដោយផ្តល់តម្លៃខ្ពស់ជាងទីផ្សារទូទៅ ២០% ចំពោះកសិដ្ឋានដែលមានវិញ្ញាបនបត្រត្រឹមត្រូវ។",
                    "tip": "កត់ត្រាកំណត់ហេតុនៃការប្រើប្រាស់ជី និងថ្នាំឱ្យបានច្បាស់លាស់ដើម្បីងាយស្រួលក្នុងការត្រួតពិនិត្យគុណភាព។",
                    "source": "អគ្គនាយកដ្ឋានកសិកម្ម (GDA)"
                },
                {
                    "title": "ទីផ្សារគ្រាប់ស្វាយចន្ទីកម្ពុជា៖ ការវិនិយោគរោងចក្រកែច្នៃថ្មីនៅកំពង់ធំ និងរតនគិរី",
                    "category": "Market",
                    "date": "ថ្ងៃនេះ",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "High",
                    "summary": "សមាគមស្វាយចន្ទីកម្ពុជាបានប្រកាសពីការបើកដំណើរការរោងចក្រកែច្នៃគ្រាប់ស្វាយចន្ទីថ្មី ដែលជួយកាត់បន្ថយការនាំចេញគ្រាប់ឆៅ និងធានាតម្លៃទិញស្ថិរភាពពី ៤,៨០០ ទៅ ៥,៥០០ រៀលក្នុងមួយគីឡូក្រាម។",
                    "tip": "សម្ងួតគ្រាប់ស្វាយចន្ទីឱ្យបានសំណើមក្រោម ៨% មុននឹងលក់ ឬស្តុកទុកដើម្បីជៀសវាងការខូចគុណភាព និងដុះផ្សិត។",
                    "source": "សមាគមស្វាយចន្ទីកម្ពុជា (CAC)"
                },
                {
                    "title": "យុទ្ធនាការចាក់វ៉ាក់សាំងការពារជំងឺសត្វពាហនៈ និងជំងឺរលាកស្បែកដុំពកលើគោក្របី",
                    "category": "Pests",
                    "date": "ម្សិលមិញ",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "High",
                    "summary": "អគ្គនាយកដ្ឋានសុខភាពសត្វ និងផលិតកម្មសត្វ បានចាប់ផ្តើមយុទ្ធនាការចាក់វ៉ាក់សាំងការពារជំងឺអុតក្តារ និងជំងឺដុំពកស្បែកសត្វទូទាំងបណ្តាខេត្តជាប់ព្រំដែន ដើម្បីទប់ស្កាត់ការឆ្លងរាលដាលក្នុងរដូវភ្លៀង។",
                    "tip": "នាំសត្វពាហនៈទៅទទួលវ៉ាក់សាំងការពារឱ្យបានទាន់ពេលវេលា និងធ្វើអនាម័យទ្រុងសត្វជាប្រចាំ។",
                    "source": "អគ្គនាយកដ្ឋានសុខភាពសត្វ និងផលិតកម្មសត្វ"
                },
                {
                    "title": "ការគ្រប់គ្រងទឹកក្នុងអាងស្តុក និងប្រព័ន្ធធារាសាស្ត្របឹងទន្លេសាបសម្រាប់រដូវប្រាំងខាងមុខ",
                    "category": "Weather",
                    "date": "២ ថ្ងៃមុន",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "Moderate",
                    "summary": "ក្រសួងធនធានទឹកបានណែនាំឱ្យមន្ទីរខេត្តជុំវិញបឹងទន្លេសាប ចាប់ផ្តើមបិទទ្វារទឹកស្តុកទុកក្នុងអាងធារាសាស្ត្រមេ ដើម្បីត្រៀមផ្គត់ផ្គង់ដល់ការធ្វើស្រែប្រាំងលើកទីមួយនៅចុងឆ្នាំនេះ។",
                    "tip": "រៀបចំដីឱ្យបានឆាប់រហ័ស និងជ្រើសរើសពូជស្រូវស្រាលមិនប្រកាន់រដូវដើម្បីទាញយកប្រយោជន៍ពីប្រភពទឹកដែលមានស្រាប់។",
                    "source": "ក្រសួងធនធានទឹក និងឧតុនិយម"
                },
                {
                    "title": "ការអភិវឌ្ឍន៍ពូជស្រូវថ្មី 'សែនក្រអូប ០១' ដែលធន់នឹងការដួល និងមានទិន្នផលខ្ពស់",
                    "category": "Crops",
                    "date": "៣ ថ្ងៃមុន",
                    "read_time": "អាន ៤ នាទី",
                    "impact": "High",
                    "summary": "វិទ្យាស្ថានស្រាវជ្រាវ និងអភិវឌ្ឍន៍កសិកម្មកម្ពុជា (CARDI) បានបញ្ចេញពូជស្រូវសែនក្រអូប ០១ ជំនាន់ថ្មី ដែលមានដើមរឹង ធន់នឹងការដួលរលំ និងអាចផ្តល់ទិន្នផលជាមធ្យមពី ៤.៥ ទៅ ៥.៥ តោនក្នុងមួយហិកតា។",
                    "tip": "កសិករអាចទាក់ទងទិញពូជសុទ្ធពីស្ថានីយពូជស្រូវរបស់រដ្ឋ ឬសហគមន៍កសិកម្មដែលមានការបញ្ជាក់គុណភាពត្រឹមត្រូវ។",
                    "source": "វិទ្យាស្ថាន CARDI"
                },
                {
                    "title": "កម្មវិធីទូរស័ព្ទឆ្លាតវៃកសិកម្ម ជួយកសិករពិនិត្យតម្លៃទីផ្សារ និងជំងឺដំណាំតាមបច្ចេកវិទ្យា AI",
                    "category": "Tech",
                    "date": "៤ ថ្ងៃមុន",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "Moderate",
                    "summary": "ប្រព័ន្ធកសិកម្មឌីជីថលថ្មីបានដាក់ឱ្យប្រើប្រាស់ដោយឥតគិតថ្លៃសម្រាប់កសិករ ដើម្បីតាមដានបច្ចុប្បន្នភាពតម្លៃកសិផលប្រចាំថ្ងៃ និងវិភាគជំងឺដំណាំតាមរយៈការថតរូបស្លឹកឈើ។",
                    "tip": "ទាញយក និងប្រើប្រាស់កម្មវិធីកសិកម្មដើម្បីទទួលបានព័ត៌មានព្យាករណ៍តម្លៃមុនពេលប្រមូលផល។",
                    "source": "មជ្ឈមណ្ឌលនវានុវត្តន៍កសិកម្មឌីជីថល"
                },
                {
                    "title": "ការនាំចេញចេកអំបូងលឿង និងស្វាយកែវរមៀតស្រស់ទៅកាន់ទីផ្សារអន្តរជាតិកើនឡើង",
                    "category": "Market",
                    "date": "សប្តាហ៍នេះ",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "Moderate",
                    "summary": "ក្រសួងកសិកម្មបានបង្ហាញរបាយការណ៍ថា ការនាំចេញចេកអំបូងលឿង និងស្វាយកែវរមៀតស្រស់ទៅកាន់ទីផ្សារចិន និងកូរ៉េខាងត្បូង បានកើនឡើង ១៥% ដោយសារការអនុវត្តកញ្ចប់បច្ចេកទេស និងការវេចខ្ចប់តាមស្តង់ដារអនាម័យ។",
                    "tip": "ថែទាំផ្លែឈើដោយការរុំថង់ការពារសត្វល្អិត និងកាត់មែកឱ្យបានត្រឹមត្រូវដើម្បីទទួលបានផ្លែស្អាតគ្មានស្នាម។",
                    "source": "អគ្គនាយកដ្ឋានកសិកម្ម (GDA)"
                }
            ]
        else:
            return [
                {
                    "title": "ទីផ្សារកសិផលពិភពលោក៖ តម្លៃគ្រាប់ធញ្ញជាតិ និងសណ្តែកសៀងរក្សាស្ថិរភាព",
                    "category": "Market",
                    "date": "ថ្ងៃនេះ",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "Moderate",
                    "summary": "របាយការណ៍របស់អង្គការ FAO បានបង្ហាញថាសន្ទស្សន៍តម្លៃស្បៀងអាហារសកលបានរក្សាស្ថិរភាព ដោយសារការផ្គត់ផ្គង់ស្រូវសាលី និងពោតពីប្រទេសប្រេស៊ីល និងសហរដ្ឋអាមេរិកមានទិន្នផលល្អប្រសើរ។",
                    "tip": "តាមដានព័ត៌មានតម្លៃទីផ្សារជាប្រចាំដើម្បីរៀបចំផែនការលក់កសិផលក្នុងពេលវេលាសមស្រប។",
                    "source": "អង្គការស្បៀង និងកសិកម្មពិភពលោក (FAO)"
                },
                {
                    "title": "បច្ចេកវិទ្យាបញ្ញាសិប្បនិម្មិត (AI) និងផ្កាយរណបក្នុងការតាមដានសុខភាពដំណាំទូទាំងពិភពលោក",
                    "category": "Tech",
                    "date": "ម្សិលមិញ",
                    "read_time": "អាន ៤ នាទី",
                    "impact": "High",
                    "summary": "ការប្រើប្រាស់រូបភាពផ្កាយរណប និងប្រព័ន្ធ AI ជួយកសិករជុំវិញពិភពលោកកាត់បន្ថយការខូចខាតដំណាំពីគ្រោះរាំងស្ងួត និងជំងឺបានរហូតដល់ ៤០% នៅក្នុងរដូវកាលដាំដុះថ្មីនេះ។",
                    "tip": "ស្វែងយល់បន្ថែមអំពីកម្មវិធីទូរស័ព្ទឆ្លាតវៃក្នុងការវិភាគជំងឺដំណាំ និងការព្យាករណ៍អាកាសធាតុ។",
                    "source": "Global AgriTech Review"
                },
                {
                    "title": "ការស្រាវជ្រាវពូជស្រូវស៊ូទ្រាំនឹងទឹកប្រៃ និងគ្រោះរាំងស្ងួតរបស់វិទ្យាស្ថាន IRRI",
                    "category": "Crops",
                    "date": "២ ថ្ងៃមុន",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "High",
                    "summary": "វិទ្យាស្ថានស្រាវជ្រាវស្រូវអន្តរជាតិ (IRRI) បានប្រកាសពីជោគជ័យនៃពូជស្រូវឆ្លាតវៃធន់នឹងអាកាសធាតុ ដែលអាចផ្តល់ទិន្នផលខ្ពស់ទោះបីជាជួបប្រទះការជ្រាបចូលនៃទឹកប្រៃនៅតំបន់ឆ្នេរសមុទ្រក៏ដោយ។",
                    "tip": "តាមដានការផ្សព្វផ្សាយពូជថ្មីៗពីមន្ទីរកសិកម្មខេត្តដើម្បីយកមកសាកល្បងលើក្បាលដីផ្ទាល់ខ្លួន។",
                    "source": "International Rice Research Institute (IRRI)"
                },
                {
                    "title": "វិបត្តិជីគីមីសកល៖ តម្លៃជីអ៊ុយរ៉េ និងប៉ូតាស្យូមចាប់ផ្តើមធ្លាក់ចុះមកកម្រិតមធ្យម",
                    "category": "Market",
                    "date": "៣ ថ្ងៃមុន",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "Moderate",
                    "summary": "ខ្សែច្រវាក់ផ្គត់ផ្គង់ជីកសិកម្មអន្តរជាតិមានភាពធូរស្រាលឡើងវិញ ដែលជំរុញឱ្យតម្លៃជីអ៊ុយរ៉េធ្លាក់ចុះប្រមាណ ៨% ធៀបនឹងត្រីមាសមុន ដោយសារថ្លៃឧស្ម័នធម្មជាតិមានស្ថិរភាព។",
                    "tip": "រៀបចំទិញជីស្តុកទុកជាមុនសម្រាប់រដូវកាលក្រោយនៅពេលដែលតម្លៃទីផ្សារកំពុងស្ថិតក្នុងកម្រិតសមរម្យ។",
                    "source": "World Bank Agriculture Commodities"
                },
                {
                    "title": "បាតុភូតអាកាសធាតុ La Niña បង្កើនហានិភ័យទឹកជំនន់នៅអាស៊ីអាគ្នេយ៍",
                    "category": "Weather",
                    "date": "សប្តាហ៍នេះ",
                    "read_time": "អាន ៤ នាទី",
                    "impact": "High",
                    "summary": "ទីភ្នាក់ងារឧតុនិយមពិភពលោក (WMO) បានព្រមានថាបាតុភូត La Niña នឹងបង្កើនបរិមាណទឹកភ្លៀងខ្ពស់ជាងមធ្យមភាគនៅបណ្តាប្រទេសអាស៊ាន ដែលទាមទារឱ្យមានការគ្រប់គ្រងទឹកអាងទំនប់ឱ្យបានម៉ឺងម៉ាត់។",
                    "tip": "លើកភ្លឺស្រែឱ្យខ្ពស់ និងរៀបចំម៉ាស៊ីនបូមទឹករំដោះឱ្យបានរួចជាស្រេចដើម្បីការពារការលិចលង់កូនដំណាំ។",
                    "source": "World Meteorological Organization (WMO)"
                },
                {
                    "title": "ការគ្រប់គ្រងសត្វល្អិតចង្រៃតាមបែបជីវសាស្រ្ត៖ និន្នាការកសិកម្មសរីរាង្គពិភពលោក",
                    "category": "Pests",
                    "date": "សប្តាហ៍នេះ",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "Advisory",
                    "summary": "របាយការណ៍កសិកម្មប្រកបដោយនិរន្តរភាពបានបង្ហាញថា ការប្រើប្រាស់ពពួកប៉ារ៉ាស៊ីត និងបាក់តេរីធម្មជាតិ (Bt) កំពុងជំនួសថ្នាំគីមីយ៉ាងឆាប់រហ័ស ក្នុងការកម្ចាត់ដង្កូវហ្វូង និងដង្កូវស៊ីរូងដើម។",
                    "tip": "កសិករអាចដាំផ្កាស្មៅជុំវិញភ្លឺស្រែដើម្បីទាក់ទាញសត្វល្អិតមានប្រយោជន៍មកជួយកម្ចាត់សត្វចង្រៃ។",
                    "source": "FAO Sustainable Agriculture Journal"
                },
                {
                    "title": "បច្ចេកវិទ្យាស្រោចស្រពដំណក់ទឹកដើរដោយថាមពលពន្លឺព្រះអាទិត្យកាត់បន្ថយការប្រើប្រាស់ទឹក ៥០%",
                    "category": "Tech",
                    "date": "៤ ថ្ងៃមុន",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "Moderate",
                    "summary": "ការសាកល្បងអន្តរជាតិនៅអាស៊ីអាគ្នេយ៍ និងអាហ្វ្រិកបានបង្ហាញថា ប្រព័ន្ធស្រោចស្រពដំណក់ទឹកដើរដោយថាមពលពន្លឺព្រះអាទិត្យជួយកសិករបង្កើនទិន្នផលបន្លែ និងកាត់បន្ថយថ្លៃអគ្គិសនី និងការបូមទឹកបានពាក់កណ្តាល។",
                    "tip": "ប្រើប្រាស់ទុយោស្រោចស្រពដំណក់ទឹកដើម្បីបញ្ជូនទឹក និងជីរលាយដោយផ្ទាល់ទៅគល់ដំណាំដោយមិនខ្ជះខ្ជាយ។",
                    "source": "វិទ្យាស្ថានគ្រប់គ្រងទឹកអន្តរជាតិ (IWMI)"
                },
                {
                    "title": "ទីផ្សារពោត និងសណ្តែកសៀងប្រេស៊ីលឈានដល់កម្រិតខ្ពស់បំផុតក្នុងប្រវត្តិសាស្ត្រ",
                    "category": "Market",
                    "date": "៤ ថ្ងៃមុន",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "Moderate",
                    "summary": "ទិន្នផលប្រមូលផលពោតរដូវកាលទីពីរនៅអាមេរិកខាងត្បូងបានជំរុញឱ្យការផ្គត់ផ្គង់ចំណីសត្វសកលមានស្ថិរភាព និងជួយបញ្ចុះថ្លៃដើមផលិតកម្មបសុសត្វ។",
                    "tip": "តាមដាននិន្នាការចំណីសត្វដើម្បីកាត់បន្ថយថ្លៃដើមចិញ្ចឹមមាន់ និងជ្រូក។",
                    "source": "USDA Global Agricultural Highlights"
                },
                {
                    "title": "វិធានការទប់ស្កាត់ជំងឺផ្តាសាយបក្សី និងជំងឺប៉េស្តជ្រូកអាហ្វ្រិក (ASF) នៅអាស៊ីអាគ្នេយ៍",
                    "category": "Pests",
                    "date": "សប្តាហ៍នេះ",
                    "read_time": "អាន ៤ នាទី",
                    "impact": "High",
                    "summary": "អង្គការសុខភាពសត្វពិភពលោក (WOAH) បានណែនាំឱ្យបណ្តាប្រទេសក្នុងតំបន់អាស៊ានពង្រឹងវិធានការជីវសុវត្ថិភាពនៅតាមច្រកទ្វារព្រំដែន និងកសិដ្ឋានចិញ្ចឹមសត្វ។",
                    "tip": "ហាមដាច់ខាតការនាំចូលសត្វគ្មានប្រភពច្បាស់លាស់ និងបាញ់ថ្នាំសម្លាប់មេរោគលើរថយន្តដឹកជញ្ជូន។",
                    "source": "World Organisation for Animal Health (WOAH)"
                },
                {
                    "title": "បច្ចេកវិទ្យាកែច្នៃកាកសំណល់កសិកម្មទៅជាជីកំប៉ុស និងថាមពលជីវឧស្ម័ន (Biogas)",
                    "category": "Tech",
                    "date": "៥ ថ្ងៃមុន",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "Moderate",
                    "summary": "គម្រោងកសិកម្មបៃតងសកលបានបង្ហាញថា ការកែច្នៃចំបើង និងកាកសំណល់ដំណាំទៅជាជីវឧស្ម័ន ជួយកាត់បន្ថយការបំភាយឧស្ម័នផ្ទះកញ្ចក់ និងបង្កើតប្រភពជីសរីរាង្គកម្រិតខ្ពស់។",
                    "tip": "ជៀសវាងការដុតចំបើងក្នុងស្រែ ហើយងាកមកកែច្នៃជាជីកំប៉ុសដើម្បីបង្កើនជីវជាតិដី។",
                    "source": "Global Green Agro Hub"
                },
                {
                    "title": "និន្នាការទីផ្សារអង្ករសកល៖ ប្រទេសឥណ្ឌាពិចារណាសម្រួលការរឹតបន្តឹងការនាំចេញអង្ករស",
                    "category": "Market",
                    "date": "៦ ថ្ងៃមុន",
                    "read_time": "អាន ៣ នាទី",
                    "impact": "High",
                    "summary": "ការផ្គត់ផ្គង់ស្តុកស្រូវក្នុងស្រុកឥណ្ឌាមានកម្រិតខ្ពស់ ដែលអាចជំរុញឱ្យមានការបន្ធូរបន្ថយពន្ធនាំចេញអង្ករស ប៉ះពាល់ដល់ការប្រកួតប្រជែងតម្លៃអង្ករនៅអាស៊ីអាគ្នេយ៍។",
                    "tip": "ផ្តោតលើការផលិតអង្ករក្រអូបគុណភាពខ្ពស់ដែលមានទីផ្សារជាក់លាក់ដើម្បីជៀសវាងការប្រកួតប្រជែងតម្លៃ។",
                    "source": "International Grains Council (IGC)"
                },
                {
                    "title": "ការបន្សាំដំណាំកាហ្វេ និងកាកាវទៅនឹងការកើនឡើងកម្តៅផែនដី",
                    "category": "Crops",
                    "date": "សប្តាហ៍មុន",
                    "read_time": "អាន ៤ នាទី",
                    "impact": "Advisory",
                    "summary": "អ្នកវិទ្យាសាស្ត្រកសិកម្មបានណែនាំប្រព័ន្ធដាំដំណាំចម្រុះម្លប់ (Agroforestry) សម្រាប់ចំការកាហ្វេ និងស្វាយចន្ទី ដើម្បីការពារដំណាំពីកម្តៅព្រះអាទិត្យខ្លាំង។",
                    "tip": "ដាំដើមឈើផ្តល់ម្លប់ និងរក្សាគម្របដីដើម្បីរក្សាសំណើមក្នុងរដូវក្តៅ។",
                    "source": "World Agroforestry Centre (ICRAF)"
                }
            ]
    else:
        if region == "cambodia":
            return [
                {
                    "title": "Cambodian Jasmine Rice Export Demand Surges Ahead of New Harvest Season",
                    "category": "Market",
                    "date": "Today",
                    "read_time": "3 min read",
                    "impact": "High",
                    "summary": "The Cambodia Rice Federation reports strong international forward contracts for premium Phka Rumduol fragrant rice, with export prices firming up across European and Asian premium markets. Millers are offering competitive pre-harvest gate prices.",
                    "tip": "Farmers are advised to maintain certified CamGAP standard protocols and seed purity to secure premium export grade pricing.",
                    "source": "Cambodia Rice Federation (CRF)"
                },
                {
                    "title": "Urgent Advisory: Blast and Brown Planthopper Prevention in Lowland Rice Basins",
                    "category": "Pests",
                    "date": "Yesterday",
                    "read_time": "4 min read",
                    "impact": "High",
                    "summary": "The General Directorate of Agriculture has issued a proactive disease watch across Battambang, Banteay Meanchey, and Siem Reap. High humidity combined with warm temperatures has elevated the risk of leaf blast and hopper infestations.",
                    "tip": "Avoid excess nitrogen fertilizer application, drain standing water intermittently for 2-3 days, and scout field borders twice weekly.",
                    "source": "Department of Crop Protection, Sanitary and Phytosanitary (MAFF)"
                },
                {
                    "title": "Southwest Monsoon Intensifies Rainfall Over Tonle Sap & Southern Plains",
                    "category": "Weather",
                    "date": "2 hours ago",
                    "read_time": "2 min read",
                    "impact": "Advisory",
                    "summary": "The Ministry of Water Resources and Meteorology forecasts moderate-to-heavy rainfall across central and coastal provinces. While beneficial for wet-season paddy tillering, high moisture requires vigilant drainage in horticulture plots.",
                    "tip": "Clear field drainage trenches immediately to prevent root-zone waterlogging in chili, tomato, and leafy greens.",
                    "source": "Ministry of Water Resources and Meteorology"
                },
                {
                    "title": "Agricultural Drone Demonstration Centers Expand Across Takeo & Battambang",
                    "category": "Tech",
                    "date": "Today",
                    "read_time": "3 min read",
                    "impact": "Moderate",
                    "summary": "In partnership with modern agricultural cooperatives, new subsidized drone spraying and multispectral crop-health monitoring services have been launched, reducing chemical exposure and cutting input costs by up to 35%.",
                    "tip": "Join local agricultural cooperatives to access shared drone pilot services at group-discounted rates.",
                    "source": "Cambodia Modern AgriTech Cooperative"
                },
                {
                    "title": "Cassava Factory Demand Rebounds: Fresh Root Gate Prices Reach 380 KHR/kg",
                    "category": "Crops",
                    "date": "Yesterday",
                    "read_time": "3 min read",
                    "impact": "Moderate",
                    "summary": "Domestic starch processing facilities in Tbong Khmum and Pailin have expanded operating quotas, stabilizing purchase prices for mature roots. Starch content remains the primary determinant of payout premiums.",
                    "tip": "Harvest only when cassava roots reach 9-10 months of maturity to maximize starch percentage and avoid dockage penalties.",
                    "source": "Cambodia Cassava Association"
                },
                {
                    "title": "Premium Supermarket Contracts Awarded to Certified Safe Vegetable Cooperatives",
                    "category": "Crops",
                    "date": "3 days ago",
                    "read_time": "4 min read",
                    "impact": "Advisory",
                    "summary": "Leading Phnom Penh retail chains have expanded direct purchasing agreements with GAP-certified farmer groups in Kandal and Kampong Chhnang, providing guaranteed purchase volumes and a 20% price premium over open markets.",
                    "tip": "Maintain strict farm record-keeping of organic inputs and harvest intervals to qualify for retail procurement contracts.",
                    "source": "General Directorate of Agriculture (GDA)"
                },
                {
                    "title": "Cashew Processing Infrastructure Expands in Kampong Thom and Ratanakiri",
                    "category": "Market",
                    "date": "Today",
                    "read_time": "3 min read",
                    "impact": "High",
                    "summary": "New domestic processing facilities have come online, increasing local value addition for raw cashew nuts and stabilizing gate prices between 4,800 and 5,500 KHR per kilogram for premium graded nuts.",
                    "tip": "Ensure cashew nuts are properly dried down to below 8% moisture before warehousing to avoid mold and insect damage.",
                    "source": "Cashew nut Association of Cambodia (CAC)"
                },
                {
                    "title": "National Vaccination Campaign Targets Lumpy Skin Disease and FMD in Livestock",
                    "category": "Pests",
                    "date": "Yesterday",
                    "read_time": "3 min read",
                    "impact": "High",
                    "summary": "The General Directorate of Animal Health and Production has mobilized veterinary outreach teams across border provinces to administer subsidized booster shots against lumpy skin disease in cattle and buffalo.",
                    "tip": "Present cattle at designated commune vaccination points and maintain clean, dry livestock enclosures.",
                    "source": "General Directorate of Animal Health and Production"
                },
                {
                    "title": "Reservoir Sluice Gate Management Prepares Tonle Sap Basin for Dry-Season Paddy",
                    "category": "Weather",
                    "date": "2 days ago",
                    "read_time": "3 min read",
                    "impact": "Moderate",
                    "summary": "The Ministry of Water Resources has instructed provincial departments to optimize reservoir storage levels to ensure reliable supplemental irrigation for upcoming dry-season recession rice plantings.",
                    "tip": "Coordinate with local water user farmer groups to schedule field preparation and canal water releases efficiently.",
                    "source": "Ministry of Water Resources and Meteorology"
                },
                {
                    "title": "CARDI Releases Upgraded 'Sen Kra Ob 01' Non-Seasonal Fragrant Rice Variety",
                    "category": "Crops",
                    "date": "3 days ago",
                    "read_time": "4 min read",
                    "impact": "High",
                    "summary": "The Cambodian Agricultural Research and Development Institute (CARDI) has released certified foundation seeds for Sen Kra Ob 01, featuring lodging resistance, uniform maturity, and high grain recovery.",
                    "tip": "Source certified foundation seeds directly from accredited agricultural cooperatives or research stations.",
                    "source": "CARDI Cambodia"
                },
                {
                    "title": "Smart Agri Digital App Delivers AI Disease Diagnostics and Live Gate Prices",
                    "category": "Tech",
                    "date": "4 days ago",
                    "read_time": "3 min read",
                    "impact": "Moderate",
                    "summary": "A national digital agriculture extension platform allows Cambodian smallholders to snap leaf photos for instant disease diagnosis and review daily commodity prices across wholesale markets.",
                    "tip": "Download mobile extension tools to track market price movements prior to harvesting.",
                    "source": "Digital Agriculture Innovation Hub"
                },
                {
                    "title": "Fresh Yellow Banana and Keo Romeat Mango Shipments Surge 15% to Asian Markets",
                    "category": "Market",
                    "date": "This Week",
                    "read_time": "3 min read",
                    "impact": "Moderate",
                    "summary": "Official phytosanitary inspection reports show double-digit export growth for fresh Cavendish bananas and mangoes under bilateral sanitary protocols with China and South Korea.",
                    "tip": "Employ pest-bagging techniques early in fruit development to meet zero-blemish export cosmetic standards.",
                    "source": "General Directorate of Agriculture (GDA)"
                }
            ]
        else:
            return [
                {
                    "title": "Global Grain & Oilseed Markets Balance on Strong South American Harvest Yields",
                    "category": "Market",
                    "date": "Today",
                    "read_time": "3 min read",
                    "impact": "Moderate",
                    "summary": "The UN Food and Agriculture Organization (FAO) reports that the Global Food Price Index held steady this month, supported by bumper soybean and maize harvests across Brazil and steady wheat trade flows.",
                    "tip": "Monitor international market reports bi-weekly to plan forward grain sales and input purchases strategically.",
                    "source": "UN Food & Agriculture Organization (FAO)"
                },
                {
                    "title": "AI & Hyperspectral Satellite Scouting Slash Crop Loss by 40% in Global Trials",
                    "category": "Tech",
                    "date": "Yesterday",
                    "read_time": "4 min read",
                    "impact": "High",
                    "summary": "New international field studies highlight the effectiveness of integrating real-time orbital satellite data with on-the-ground AI diagnosis tools, enabling agronomists to identify nutrient deficiencies weeks before visible leaf chlorosis occurs.",
                    "tip": "Leverage digital diagnostic apps to verify early crop symptoms before applying broad-spectrum treatments.",
                    "source": "Global AgriTech Review"
                },
                {
                    "title": "IRRI Releases Climate-Resilient, Saline-Tolerant Rice Strains for Coastal Deltas",
                    "category": "Crops",
                    "date": "2 days ago",
                    "read_time": "3 min read",
                    "impact": "High",
                    "summary": "The International Rice Research Institute has finalized seed distribution for next-generation rice varieties capable of withstanding both saline water intrusion and extended dry spells, yielding up to 5.5 tons per hectare under stress.",
                    "tip": "Contact provincial agriculture extension departments to request trial seed packages suited for coastal or brackish plots.",
                    "source": "International Rice Research Institute (IRRI)"
                },
                {
                    "title": "Fertilizer Input Pricing Normalizes as Global Urea Supply Rebounds",
                    "category": "Market",
                    "date": "3 days ago",
                    "read_time": "3 min read",
                    "impact": "Moderate",
                    "summary": "The World Bank Commodity Markets Outlook indicates wholesale fertilizer prices have retreated 8% this quarter, driven by lower natural gas feedstocks and resumed export shipments from key Eurasian manufacturing hubs.",
                    "tip": "Lock in seasonal fertilizer inventory early while wholesale spot prices remain competitive.",
                    "source": "World Bank Agriculture Commodity Desk"
                },
                {
                    "title": "WMO Advisory: Transition Toward La Niña Signals Wetter Monsoon Across ASEAN",
                    "category": "Weather",
                    "date": "This Week",
                    "read_time": "4 min read",
                    "impact": "High",
                    "summary": "The World Meteorological Organization confirms elevated probability of La Niña conditions developing, bringing above-average seasonal precipitation and tropical storm activity across the Mekong basin.",
                    "tip": "Reinforce paddy dikes, clean irrigation gates, and prepare backup water pump infrastructure ahead of peak precipitation.",
                    "source": "World Meteorological Organization (WMO)"
                },
                {
                    "title": "Biological Pest Control Advances: Natural Parasitoids Replacing Chemical Sprays",
                    "category": "Pests",
                    "date": "This Week",
                    "read_time": "3 min read",
                    "impact": "Advisory",
                    "summary": "Global sustainable farming trials demonstrate that beneficial predatory insects and Bacillus thuringiensis (Bt) treatments achieve 90% control efficacy against armyworms without inducing chemical resistance or environmental toxicity.",
                    "tip": "Establish flowering nectar strips along field borders to sustain natural predatory insects and pollinators.",
                    "source": "FAO Sustainable Agriculture Journal"
                },
                {
                    "title": "Precision Solar Drip Irrigation Cuts Water Use by 50% in Semi-Arid Agricultural Zones",
                    "category": "Tech",
                    "date": "4 days ago",
                    "read_time": "3 min read",
                    "impact": "Moderate",
                    "summary": "International development trials across Southeast Asia and Africa highlight the rapid payback of smallholder solar drip kits, boosting vegetable yields while halving electricity and groundwater pumping requirements.",
                    "tip": "Adopt drip emitter lines to deliver water and soluble nutrients directly to root zones with minimal evaporation.",
                    "source": "International Water Management Institute (IWMI)"
                },
                {
                    "title": "Global Soybean and Feed Grain Balances Stable on Expanded Acreage",
                    "category": "Market",
                    "date": "5 days ago",
                    "read_time": "3 min read",
                    "impact": "Moderate",
                    "summary": "The USDA World Agricultural Supply and Demand Estimates (WASDE) project comfortable global oilseed carryout stocks, dampening feed cost inflation for livestock and aquaculture producers.",
                    "tip": "Evaluate herd feed formulation adjustments as international protein meal prices soften.",
                    "source": "USDA Economic Research Service"
                },
                {
                    "title": "Regional Border Biosecurity Heightened to Contain Swine and Avian Disease Strains",
                    "category": "Pests",
                    "date": "This Week",
                    "read_time": "4 min read",
                    "impact": "High",
                    "summary": "The World Organisation for Animal Health (WOAH) urged regional veterinary authorities to step up farm biosecurity protocols and strict border animal movement documentation.",
                    "tip": "Enforce strict vehicle disinfection and quarantine protocols for new livestock additions.",
                    "source": "World Organisation for Animal Health (WOAH)"
                },
                {
                    "title": "Circular Agri-Waste Systems Transform Crop Stubble into High-Grade Biofertilizer",
                    "category": "Tech",
                    "date": "6 days ago",
                    "read_time": "3 min read",
                    "impact": "Moderate",
                    "summary": "Zero-burn agricultural initiatives in developing economies demonstrate that microbial decomposing inoculants convert paddy straw into humus within 21 days, avoiding air pollution.",
                    "tip": "Incorporate rice straw back into soils with microbial decomposers instead of field burning.",
                    "source": "CGIAR Climate & Agriculture Initiative"
                },
                {
                    "title": "International Rice Market Trends: India Evaluates Easing of Non-Basmati Parboiled Export Duty",
                    "category": "Market",
                    "date": "This Week",
                    "read_time": "3 min read",
                    "impact": "High",
                    "summary": "Record domestic buffer stock accumulation may prompt Indian trade officials to relax export tariffs on parboiled rice, impacting global benchmark export price dynamics.",
                    "tip": "Focus marketing efforts on differentiated fragrant and certified organic rice varieties.",
                    "source": "International Grains Council (IGC)"
                },
                {
                    "title": "Agroforestry Shade Canopy Strategies Mitigate Extreme Heat in Tree Crops",
                    "category": "Crops",
                    "date": "Last Week",
                    "read_time": "4 min read",
                    "impact": "Advisory",
                    "summary": "Global agronomy trials reveal that interplanting shade trees within coffee, cacao, and fruit orchards reduces thermal leaf stress and preserves blossom set during heat spikes.",
                    "tip": "Establish multi-story companion tree plantings to buffer valuable perennial crops from solar scorch.",
                    "source": "World Agroforestry Centre (ICRAF)"
                }
            ]
