"""Remote inference client for the trained agricultural assistant.

The Flask process never loads model weights directly. It connects to the
user's fine-tuned Hugging Face Space / inference endpoint (AGY V2.0.0), performs
rigorous response cleaning, and provides offline local agronomic synthesis as
a fail-safe to guarantee smart, professional, human-like responses without
requiring external LLMs (Gemini, Groq, ChatGPT).
"""

from __future__ import annotations

import os
import json
import re
from collections import Counter
from typing import Any, Optional
from urllib.parse import urlparse

import requests
from flask import current_app


DEFAULT_TIMEOUT_SECONDS = 30.0
DEFAULT_SPACE_ENDPOINT = "https://maoseavik-agrisystem-agricultural-assistant.hf.space"
MAX_CONTEXT_CHARS = 8_000
MAX_MESSAGE_CHARS = 4_000

EMOJI_PATTERN = re.compile(
    r"["
    r"\U00010000-\U0010ffff"
    r"\u2600-\u27bf"
    r"\u2300-\u23ff"
    r"\u2b50\u2b55\u200d\ufe0f\u3030\u303d\u00a9\u00ae\u2122"
    r"]+",
    flags=re.UNICODE,
)


def clean_professional_text(text: str) -> str:
    """Normalize text into clean, readable language with flexible formatting."""
    if not text:
        return ""
    # Clean up double spaces within lines while preserving natural paragraphs
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


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
    """Read runtime settings, preferring the protected admin configuration."""
    # Provider selection is not user-switchable anymore.  Older installations
    # can still have ACTIVE_PROVIDER/AI_PROVIDER rows containing ``groq`` or
    # ``openai``; never let those stale values route a request away from the
    # owner's trained endpoint.
    if name == "AI_PROVIDER":
        return "own-ai"

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
            "AI_PROVIDER": ("AI_PROVIDER",),
            "HF_INFERENCE_URL": ("HF_INFERENCE_URL", "HUGGINGFACE_INFERENCE_URL"),
            "HF_TOKEN": ("HF_API_KEY", "HF_TOKEN"),
            "HUGGINGFACEHUB_API_TOKEN": ("HF_API_KEY", "HF_TOKEN"),
        }
        keys = aliases.get(name, (name,))
        for key in keys:
            saved = SiteSetting.query.get(key)
            if saved and saved.value and saved.value.strip():
                return saved.value.strip()
    except Exception:
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
    """Commercial-provider fallback is permanently disabled."""
    return False


def is_huggingface_provider() -> bool:
    return True


def is_valid_inference_endpoint(endpoint: str) -> bool:
    """Check if the inference endpoint URL is syntactically valid."""
    ep = (endpoint or "").strip()
    if not ep:
        return False
    if "agrisystem-agricultural-assistant" in ep or ".hf.space" in ep:
        return True
    parsed = urlparse(ep)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    return parsed.hostname not in {"huggingface.co", "www.huggingface.co"}


def is_gradio_endpoint(endpoint: str) -> bool:
    """Return whether an endpoint is a Gradio Space URL."""
    parsed = urlparse((endpoint or "").strip())
    hostname = (parsed.hostname or "").lower()
    path = parsed.path.rstrip("/")
    return hostname.endswith(".hf.space") or "/gradio_api/call/" in path or "/call/" in path


def is_configured() -> bool:
    provider = _setting("AI_PROVIDER", "").lower()
    endpoint = _setting("HF_INFERENCE_URL") or _setting("HUGGINGFACE_INFERENCE_URL")
    if not provider and os.getenv("AI_PROVIDER") != "":
        provider = "huggingface"
    if not endpoint and os.getenv("HF_INFERENCE_URL") != "":
        endpoint = DEFAULT_SPACE_ENDPOINT
    return (
        provider in {"huggingface", "hf", "hugging_face", "trained-ai", "trained_ai", "own-ai"}
        and is_valid_inference_endpoint(endpoint)
    )


def _endpoint() -> str:
    ep = _setting("HF_INFERENCE_URL") or _setting("HUGGINGFACE_INFERENCE_URL")
    return ep.strip() if ep and ep.strip() else DEFAULT_SPACE_ENDPOINT


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
            "សូមប្រើប្រាស់សំឡេង និងពាក្យពេចន៍បែបធម្មជាតិ រួសរាយ រាក់ទាក់ និងបត់បែនបានល្អ ដូចមនុស្សពិតប្រាកដ។ "
            "សូមឆ្លើយជាភាសាខ្មែរឱ្យបានត្រឹមត្រូវ ច្បាស់លាស់ រលូន និងមានលក្ខណៈវិជ្ជាជីវៈជានិច្ច។ "
            "សូមបញ្ជាក់អត្តសញ្ញាណថាជា AgriSystem AI និងបង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ តែនៅពេលណាដែលអ្នកប្រើប្រាស់សួរអំពីអត្តសញ្ញាណ ឬសួរអំពី AI ប៉ុណ្ណោះ។ "
            "សម្រាប់សំណើរកសិកម្ម ឬការស្វាគមន៍ សូមឆ្លើយតបចំគោលដៅដោយមិនបាច់ណែនាំខ្លួនឡើយ។ "
            "ប្រសិនបើកសិករសួរអំពីជំងឺទាំងអស់លើដំណាំ ឬសួរថាតើដំណាំមានជំងឺអ្វីខ្លះ សូមរៀបរាប់ឈ្មោះជំងឺទាំងអស់ដែលមានក្នុងបរិបទចំណេះដឹងជាចំណុចៗ ព្រមទាំងរោគសញ្ញាសង្ខេប និងវិធីព្យាបាលចម្បងៗដោយពេញលេញ។ "
            "ផ្តល់ដំបូន្មានជាក់ស្តែង រៀបចំជាចំណុច វិធីព្យាបាល និងវិធានការបង្ការប្រកបដោយសុវត្ថិភាព និងបត់បែនតាមបរិបទសំណួរ។\n\n"
            f"បរិបទចំណេះដឹងកសិកម្ម៖\n{bounded_context}\n\n"
            f"សំណួររបស់កសិករ៖\n{bounded_message}\n\n"
            "ចម្លើយ៖\n"
        )

    language_name = _language_name(language)
    bounded_context = (context or "No matching knowledge-base context was found.").strip()[:MAX_CONTEXT_CHARS]
    return (
        "You are AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. "
        "You are a professional, empathetic, and knowledgeable agricultural expert who communicates naturally and warmly like a human agronomist. "
        "Please use a natural, friendly, and flexible voice, like a real person. "
        f"Answer in {language_name}. Give complete, well-structured, practical advice regarding crop health, diagnosis, IPM, safe chemical treatment, and prevention. "
        "Only introduce yourself as AgriSystem AI created by Team Leader Mao Seavik if the user explicitly asks who you are, who created you, or about the AI. For agricultural queries, answer directly without self-introduction. "
        "If the farmer asks what diseases affect a crop or asks to list diseases, list all the diseases provided in the knowledge-base context with their names, brief symptoms, and primary treatments. "
        "Present your answers clearly, conversationally, and flexibly without unnecessary formatting restrictions so the explanation feels natural, supportive, and easy for any farmer to follow.\n\n"
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


def _clean_model_output(reply: str, user_message: str = "", language: Optional[str] = None) -> str:
    """Sanitize, normalize, and remove artifacts from raw model generations."""
    if not reply:
        return ""
    cleaned = reply.strip()

    # Remove prompt echo prefixes
    for marker in ("\nAnswer:\n", "\nចម្លើយ៖\n", "\nចម្លើយ:\n", "Answer:\n", "ចម្លើយ៖\n", "ចម្លើយ:\n"):
        if marker in cleaned:
            cleaned = cleaned.rsplit(marker, 1)[-1].strip()

    # Collapse degenerate repeating character loops (e.g. ០០០០០០០០ or .......)
    cleaned = re.sub(r"(.)\1{4,}", r"\1\1", cleaned)

    # Remove template placeholders (e.g. [List symptoms here], [Crop Name], [Action Plan here])
    cleaned = re.sub(r"\[(List|Action|Crop|Location|Your|Insert|Date)[^\]]*\]", "", cleaned, flags=re.IGNORECASE)

    # Convert to smooth, professional plain text (strips ###, **, and emojis)
    cleaned = clean_professional_text(cleaned)

    return cleaned


COMMON_KHMER_WORDS = {
    "ជា", "គឺ", "នៅ", "មាន", "និង", "ដែល", "បាន", "ដោយ", "ដើម្បី", "លើ", "ក្នុង", "ពី",
    "នេះ", "នោះ", "ដំណាំ", "ជំងឺ", "ស្លឹក", "ដើម", "ផ្លែ", "ឫស", "ឬស", "ព្យាបាល", "ថ្នាំ",
    "កសិកម្ម", "កសិករ", "ទឹក", "ដី", "បាញ់", "ការពារ", "បង្ការ", "ជំរាបសួរ", "សួស្តី",
    "សូម", "ប្រើ", "រោគសញ្ញា", "វិធានការ", "សុវត្ថិភាព", "ស្រោច", "ដាក់", "ជី", "កាត់",
    "មែក", "ផ្សិត", "បាក់តេរី", "សត្វល្អិត", "ចង្រៃ", "ទិន្នផល", "លូតលាស់", "ពូជ",
    "រដូវ", "ចម្ការ", "ស្រែ", "កម្រិត", "សរីរាង្គ", "គីមី", "បច្ចេកទេស", "ដំបូន្មាន",
    "ជួយ", "ដោះស្រាយ", "លោកអ្នក", "បងប្អូន", "ខ្ញុំ", "អ្នក", "ល្អ", "ខូច", "ស្ងួត",
    "រលួយ", "លឿង", "ខ្មៅ", "ក្រហម", "ត្នោត", "កំបោរ", "អ៊ុយរ៉េ",
}


def _is_valid_khmer_text(text: str) -> bool:
    if not text or len(text.strip()) < 10:
        return False
    # Reject template placeholders
    if "%%" in text or bool(re.search(r"\[(Crop|List|Action|Insert|Your)[^\]]*\]", text, re.IGNORECASE)):
        return False
    # Reject invalid/obsolete Khmer codepoints that LLMs hallucinate (\u17b4, \u17b5, \u17d8-\u17da, \u17dd)
    if bool(re.search(r"[\u17b4\u17b5\u17d8-\u17da\u17dd]", text)):
        return False
    # Reject stacked dependent vowels on a single consonant
    if bool(re.search(r"[\u17b6-\u17c5][\u17b6-\u17c5]", text)):
        return False
    # Reject Latin letters directly adjacent to Khmer characters (token corruption e.g. កសិkcម្ម)
    if bool(re.search(r"[\u1780-\u17a2\u17a3-\u17d2][a-zA-Z]|[a-zA-Z][\u1780-\u17a2\u17a3-\u17d2]", text)):
        return False
    # Reject foreign scripts (Thai, Japanese, Cyrillic, Chinese)
    if bool(re.search(r"[\u0e00-\u0e7f\u3040-\u30ff\u0400-\u04ff\u4e00-\u9fff]", text)):
        return False
    # Must contain Khmer script
    if not bool(re.search(r"[\u1780-\u17ff]", text)):
        return False
    # Check vocabulary density for longer texts
    found = [w for w in COMMON_KHMER_WORDS if w in text]
    if len(text) > 40 and len(found) < 3:
        return False
    return True


def _is_valid_reply(reply: str, user_message: str = "", language: Optional[str] = None) -> bool:
    """Validate that the model response is coherent, sufficiently long, and not a repetition loop."""
    if not reply or len(reply.strip()) < 10:
        return False
    cleaned = reply.strip()

    is_km = _is_khmer(language, user_message)
    if is_km:
        return _is_valid_khmer_text(cleaned)

    # Reject broken unicode replacement chars, raw template leftovers, and hybrid artifacts
    if "\ufffd" in cleaned or "example_video_id" in cleaned or "ជំ-ngឺ" in cleaned or "ngឺ" in cleaned:
        return False

    # Reject placeholders like %%Crop%% or [Crop Name]
    if "%%" in cleaned or bool(re.search(r"\[(Crop|List|Action|Insert|Your)[^\]]*\]", cleaned, flags=re.IGNORECASE)):
        return False

    # Reject Thai, Japanese kana, or Cyrillic characters
    if bool(re.search(r"[\u0e00-\u0e7f\u3040-\u30ff\u0400-\u04ff]", cleaned)):
        return False

    # Reject Chinese character leakage unless user actually wrote Chinese
    has_zh = bool(re.search(r"[\u4e00-\u9fff]", cleaned))
    user_zh = bool(re.search(r"[\u4e00-\u9fff]", user_message))
    if has_zh and not user_zh:
        return False

    # Check if a single character dominates >35% of the entire text
    counts = Counter(cleaned)
    if counts:
        most_common_char, count = counts.most_common(1)[0]
        if count / len(cleaned) > 0.35 and most_common_char not in {" ", "\n", "-", "*"}:
            return False

    return True


CAMBODIAN_AGRI_KB = [
    {
        "keywords": ["ជំងឺទុរេន", "ទុរេនមានជំងឺអ្វី", "ជំងឺលើទុរេន", "ជំងឺដំណាំទុរេន", "ទុរេនមានជំងឺ", "durian disease", "durian diseases", "diseases of durian", "diseases affect durian", "diseases affecting durian", "disease in durian", "diseases in durian"],
        "title_km": "បញ្ជីជំងឺសំខាន់ៗលើដំណាំទុរេន (Key Durian Diseases)",
        "title_en": "Common Diseases Affecting Durian",
        "crop_km": "ទុរេន",
        "crop_en": "Durian",
        "symptoms_km": (
            "១. ជំងឺរលួយឬស និងដើមទុរេន (Phytophthora palmivora)៖ ស្លឹកលឿង ហៀរជ័រពណ៌ត្នោត ឫសរលួយខ្មៅ។\n"
            "២. ជំងឺខ្លោចស្លឹកទុរេន (Rhizoctonia solani)៖ ស្លឹកមានស្នាមរលាកខ្លោច ជាប់គ្នាដូចសំណាញ់ពីងពាង។\n"
            "៣. ជំងឺអាន់ថ្រាកណូស ឬរលួយផ្លែ (Colletotrichum)៖ ស្នាមអុចខ្មៅមូលលើផ្លែ និងចុងស្លឹកស្ងួត។\n"
            "៤. ជំងឺផ្សិតផ្កាអំបោះពណ៌ផ្កាឈូក (Corticium salmonicolor)៖ សំបកមែកមានម្សៅផ្សិតពណ៌ផ្កាឈូក ធ្វើឱ្យមែកស្ងួតងាប់។\n"
            "៥. ជំងឺសារ៉ាយក្រហមលើស្លឹក (Cephaleuros virescens)៖ ស្នាមពកក្រហមដូចកម្ញីលើផ្ទៃស្លឹក។"
        ),
        "symptoms_en": (
            "1. Phytophthora Root Rot & Stem Canker (Phytophthora palmivora): Leaf yellowing, oozing trunk resin, decaying feeder roots.\n"
            "2. Rhizoctonia Leaf Blight: Water-soaked rotting leaves webbed together by fungal mycelium.\n"
            "3. Anthracnose Fruit & Leaf Spot (Colletotrichum): Sunken black lesions on fruits and necrotic leaf margins.\n"
            "4. Pink Disease (Corticium salmonicolor): Pink cobweb-like crust on branches causing twig dieback.\n"
            "5. Red Algal Spot (Cephaleuros virescens): Velvety orange-brown spots on upper leaf surfaces."
        ),
        "treatment_km": (
            "- ជំងឺរលួយឬស/ដើម៖ លាប Metalaxyl ឬ Copper Oxychloride លើដំបៅដើម ស្រោច Fosetyl-Al ឬ Phyto-Fos ជុំវិញគល់។\n"
            "- ជំងឺខ្លោចស្លឹក និងអាន់ថ្រាកណូស៖ បាញ់ថ្នាំ Azoxystrobin + Difenoconazole ឬ Propiconazole។\n"
            "- ជំងឺផ្សិតផ្កាអំបោះ៖ កាត់មែកងាប់ដុតចោល និងលាបថ្នាំ Copper Hydroxide។"
        ),
        "treatment_en": (
            "- Phytophthora: Scrape stem lesions and apply Metalaxyl paste; root drench with Fosetyl-Aluminium.\n"
            "- Leaf Blight & Anthracnose: Foliar spray Azoxystrobin + Difenoconazole or Propiconazole.\n"
            "- Pink Disease: Prune out dead twigs and apply Copper Hydroxide spray."
        ),
        "prevention_km": "ដាំលើរងខ្ពស់ បង្ហូរទឹកកុំឱ្យជាំ កែតម្រូវ pH ដីឱ្យបាន ៥.៥-៦.៥ ដោយកំបោរ Dolomite និងស្រោចផ្សិត Trichoderma រៀងរាល់ ២-៣ខែម្តង។",
        "prevention_en": "Plant on raised mounds, prevent waterlogging, maintain soil pH 5.5-6.5 with dolomite, and apply preventative Trichoderma biocontrol.",
    },
    {
        "keywords": ["ជំងឺម្រេច", "ម្រេចមានជំងឺអ្វី", "ជំងឺលើម្រេច", "ជំងឺដំណាំម្រេច", "ម្រេចមានជំងឺ", "pepper disease", "pepper diseases", "diseases of pepper", "diseases affect pepper", "diseases affecting pepper", "disease in pepper", "diseases in pepper"],
        "title_km": "បញ្ជីជំងឺសំខាន់ៗលើដំណាំម្រេច (Key Pepper Diseases)",
        "title_en": "Common Diseases Affecting Black Pepper",
        "crop_km": "ម្រេច",
        "crop_en": "Pepper",
        "symptoms_km": (
            "១. ជំងឺងាប់រហ័ស (Quick Wilt - Phytophthora capsici)៖ ស្លឹកស្រពោនជ្រុះលឿនក្នុង ២-៣ថ្ងៃ គល់និងឬសរលួយខ្មៅ។\n"
            "២. ជំងឺងាប់យឺត (Slow Wilt - Fusarium & Nematodes)៖ ស្លឹកលឿងបន្តិចម្តងៗ ដើមក្រិន ឫសមានដុំពកតូចៗ។\n"
            "៣. ជំងឺអាន់ថ្រាកណូស ឬកន្ទុយបារី (Anthracnose / Pollu Disease)៖ ស្នាមអុចខ្មៅលើស្លឹក កួរផ្លែស្វិតខ្មៅជ្រុះ។\n"
            "៤. ជំងឺវីរុសស្លឹកជ្រីវជ្រួញ (Pepper Yellow Mottle Virus)៖ ស្លឹកតូចៗរួញខូចទ្រង់ទ្រាយ ដើមក្រិនមិនចេញផ្លែ។"
        ),
        "symptoms_en": (
            "1. Quick Wilt / Foot Rot (Phytophthora capsici): Rapid foliar collapse and leaf drop within 2-3 days; black collar rot.\n"
            "2. Slow Wilt / Decline (Fusarium & Meloidogyne): Gradual yellowing, stunted growth, root-knot galls.\n"
            "3. Anthracnose / Pollu Disease (Colletotrichum gloeosporioides): Dark necrotic spots on leaves and spike drop.\n"
            "4. Yellow Mottle Virus: Mottled mosaic pattern and leaf deformation."
        ),
        "treatment_km": (
            "- ជំងឺងាប់រហ័ស៖ ដកដើមងាប់ដុតចោល ស្រោចគល់ដោយ Metalaxyl ឬ Bordeaux mixture 1%។\n"
            "- ជំងឺងាប់យឺត និងដង្កូវពកឫស៖ ប្រើថ្នាំជីវសាស្រ្ត Paecilomyces lilacinus ឬ Trichoderma លាយជីកំប៉ុស។\n"
            "- ជំងឺអាន់ថ្រាកណូស៖ បាញ់ថ្នាំ Carbendazim ឬ Mancozeb ពេលកួរផ្លែទើបចេញ។"
        ),
        "treatment_en": (
            "- Quick Wilt: Remove infected vines, drench soil with Metalaxyl or 1% Bordeaux mixture.\n"
            "- Slow Wilt: Apply Paecilomyces lilacinus biocontrol and mature organic compost.\n"
            "- Anthracnose: Spray Carbendazim or Mancozeb at early berry spike emergence."
        ),
        "prevention_km": "កាត់មែកទាបៗកុំឱ្យប៉ះដី ធ្វើប្រព័ន្ធបង្ហូរទឹកជុំវិញជួរម្រេច និងចៀសវាងយកកូនពូជពីចម្ការកើតជំងឺ។",
        "prevention_en": "Tie and prune lower runner vines away from soil contact, dig deep drainage channels between rows, and use certified healthy cuttings.",
    },
    {
        "keywords": ["durian root rot", "durian stem canker", "phytophthora palmivora", "រលួយឬសទុរេន", "រលួយដើមទុរេន", "ទុរេនរលួយឬស", "ទុរេនរលួយដើម", "ទុរេនហៀរជ័រ"],
        "title_km": "ជំងឺរលួយឫស និងគល់ទុរេន (Durian Root Rot & Stem Canker - Phytophthora palmivora)",
        "title_en": "Durian Root Rot & Stem Canker (Phytophthora palmivora)",
        "crop_km": "ទុរេន",
        "crop_en": "Durian",
        "symptoms_km": "ស្លឹកប្រែជាពណ៌លឿងស្រពោន ជ្រុះស្លឹក សំបកដើមប្រេះហៀរជ័រពណ៌ត្នោតចាស់ ឬខ្មៅ ឫសតូចៗរលួយខ្មៅស្អុយ។",
        "symptoms_en": "Yellowing and drop of foliage, stem oozing reddish-brown gum, rot of feeder roots.",
        "treatment_km": "កាត់ក្រីមែកខូច និងកោសសម្អាតដំបៅលើដើម រួចលាបថ្នាំ Metalaxyl ឬ Copper Oxychloride។ ស្រោចគល់ដោយ Fosetyl-Al (៣០-៤០ក្រាម/ទឹក ២០លីត្រ) ឬចាក់ថ្នាំ Phosphorous acid (Phyto-Fos) ចូលដើម។",
        "treatment_en": "Scrape stem lesions and apply Metalaxyl or Copper paste. Drench root zone with Fosetyl-Aluminium (30-40g/20L) or trunk injection with Phosphorous acid.",
        "prevention_km": "ដាំលើរងខ្ពស់រៀបចំប្រព័ន្ធបង្ហូរទឹកកុំឱ្យជាំទឹក កែតម្រូវកម្រិត pH ដីឱ្យបាន ៥.៥-៦.៥ ដោយប្រើកំបោរកសិកម្ម (Dolomite) និងប្រើផ្សិត Trichoderma ស្រោចការពារគល់រៀងរាល់ ២-៣ខែ។",
        "prevention_en": "Plant on raised mounds, ensure excellent field drainage, maintain soil pH 5.5-6.5 using agricultural lime, and apply Trichoderma as a preventative soil drench.",
    },
    {
        "keywords": ["rice blast", "neck blast", "magnaporthe oryzae", "blast disease", "ប្លាស់ស្រូវ", "ជំងឺប្លាស់ស្រូវ", "ជំងឺប្លាស់", "ស្រូវប្លាស់", "រលួយកួរស្រូវ"],
        "title_km": "ជំងឺប្លាស់ស្រូវ (Rice Blast - Magnaporthe oryzae)",
        "title_en": "Rice Blast Disease (Magnaporthe oryzae)",
        "crop_km": "ស្រូវ",
        "crop_en": "Rice",
        "symptoms_km": "ស្នាមដំបៅរាងដូចកូនទូក កណ្តាលពណ៌ប្រផេះ គែមពណ៌ត្នោតចាស់លើស្លឹក និងអាចរលួយកួរស្រូវ (Neck blast)។",
        "symptoms_en": "Spindle-shaped elliptical lesions with grey centers and brown margins on leaves; rotting of panicle neck.",
        "treatment_km": "បាញ់ថ្នាំ Tricyclazole 75% WP (១៥-២០ក្រាម/ធុង ២០លីត្រ) ឬ Azoxystrobin + Difenoconazole។ បញ្ឈប់ការដាក់ជីអ៊ុយរ៉េ (N) បន្ថែមជាបន្ទាន់។",
        "treatment_en": "Spray Tricyclazole 75% WP (15-20g per 20L water) or Azoxystrobin + Difenoconazole. Stop all nitrogen top-dressing immediately.",
        "prevention_km": "ប្រើពូជស្រូវធន់នឹងជំងឺ កុំសាបព្រោះញឹកពេក រក្សាកម្រិតទឹកក្នុងស្រែឱ្យបានត្រឹមត្រូវ និងដាក់ជី NPK ឱ្យមានតុល្យភាព (ជីបាត DAP, បំប៉ន Urea + Potassium)។",
        "prevention_en": "Use resistant rice varieties, avoid dense sowing, balance NPK fertilizers with split potassium, and maintain proper water levels.",
    },
    {
        "keywords": ["cassava mosaic", "cassava cmd", "mosaic disease", "whitefly on cassava", "ម៉ូសេកដំឡូងមី", "ជំងឺម៉ូសេកដំឡូងមី", "ដំឡូងមីម៉ូសេក", "ដំឡូងមីរួញស្លឹក"],
        "title_km": "ជំងឺម៉ូសេកដំឡូងមី (Cassava Mosaic Disease - CMD)",
        "title_en": "Cassava Mosaic Disease (CMD)",
        "crop_km": "ដំឡូងមី",
        "crop_en": "Cassava",
        "symptoms_km": "ស្លឹកមានស្នាមអុចពណ៌លឿងលាយបៃតង ស្លឹកកោងរួញខូចទ្រង់ទ្រាយ ដើមក្រិនទិន្នផលមើមថយចុះយ៉ាងខ្លាំង។",
        "symptoms_en": "Mottled yellow-green patches, asymmetric leaf curling, severe stunting, and root yield collapse.",
        "treatment_km": "គ្មានថ្នាំគីមីព្យាបាលមេរោគវីរុសនេះទេ។ ត្រូវដកដើមដែលកើតជំងឺដុតកម្ទេចចោលជាបន្ទាន់ និងបាញ់កម្ចាត់សត្វល្អិតមមាចស (Whitefly) ដែលជាភ្នាក់ងារចម្លងដោយប្រើ Dinotefuran ឬ Thiamethoxam។",
        "treatment_en": "No chemical cure exists for viral CMD. Rogue and burn infected plants immediately. Control whitefly insect vectors using Dinotefuran or Thiamethoxam.",
        "prevention_km": "ជ្រើសរើសដើមពូជស្អាតគ្មានមេរោគ (ដូចជា KU50, Rayong 9) និងមិនត្រូវកាត់ដើមពូជពីចម្ការដែលមានជំងឺមកដាំបន្តឡើយ។",
        "prevention_en": "Plant only certified virus-free stem cuttings (e.g. KU50, Rayong 9). Never take cuttings from infected fields.",
    },
    {
        "keywords": ["fall armyworm", "corn armyworm", "armyworm on corn", "armyworm in corn", "spodoptera frugiperda", "ដង្កូវហ្វូងពោត", "ដង្កូវហ្វូងលើពោត", "ដង្កូវចោះដើមពោត", "ដង្កូវហ្វូង"],
        "title_km": "ដង្កូវហ្វូងរដូវស្លឹកឈើជ្រុះលើពោត (Fall Armyworm - Spodoptera frugiperda)",
        "title_en": "Fall Armyworm in Corn (Spodoptera frugiperda)",
        "crop_km": "ពោត",
        "crop_en": "Corn",
        "symptoms_km": "ស្លឹកធ្លុះធ្លាយរហែកធំៗ មានកាកលាមកដូចកំទេចអាចម៍រណាលើត្រួយ និងដង្កូវស៊ីបំផ្លាញកួរពោតខ្ចី។",
        "symptoms_en": "Windowpane damage on young leaves, large ragged holes, heavy sawdust-like frass inside whorls, feeding on tassels and ears.",
        "treatment_km": "វិធានការជីវសាស្រ្ត៖ ប្រើបាក់តេរី Bacillus thuringiensis (Bt) ឬផ្សិត Beauveria bassiana។ វិធានការគីមី៖ បាញ់ថ្នាំ Emamectin benzoate (៥-១០ក្រាម/២០លីត្រ) ឬ Chlorantraniliprole ចូលត្រួយពោតនៅពេលល្ងាច។",
        "treatment_en": "Bio-control: Bacillus thuringiensis (Bt) or Beauveria bassiana. Chemical control: Spray Emamectin benzoate (5-10g/20L) or Chlorantraniliprole directly into whorls late in the afternoon.",
        "prevention_km": "ភ្ជួរដីហាលឱ្យបានយូរដើម្បីកម្ទេចដុកឌឿ ដាក់អន្ទាក់ស្អិត និងដាំដំណាំចម្រុះដើម្បីកាត់ផ្តាច់វដ្តជីវិតសត្វល្អិត។",
        "prevention_en": "Deep plowing to expose pupae, pheromone monitoring traps, and intercropping to break the pest cycle.",
    },
    {
        "keywords": ["pepper quick wilt", "pepper slow wilt", "foot rot pepper", "phytophthora capsici", "ងាប់រហ័សម្រេច", "ងាប់យឺតម្រេច", "ម្រេចងាប់រហ័ស", "ម្រេចងាប់យឺត"],
        "title_km": "ជំងឺងាប់រហ័សលើម្រេច (Pepper Quick Wilt - Phytophthora capsici)",
        "title_en": "Pepper Quick Wilt (Phytophthora capsici)",
        "crop_km": "ម្រេច",
        "crop_en": "Pepper",
        "symptoms_km": "ស្លឹកប្រែជាពណ៌បៃតងចាស់ ស្រពោន និងជ្រុះយ៉ាងលឿនក្នុងរយៈពេល ២-៣ថ្ងៃ ដើមនិងឬសប្រែពណ៌ខ្មៅរលួយ។",
        "symptoms_en": "Rapid wilting and drop of leaves within 2-3 days while retaining dark color; collar and underground roots rot black.",
        "treatment_km": "កាត់មែកដែលងាប់ចោល ដកដើមងាប់ដុតបំផ្លាញ ស្រោចថ្នាំ Metalaxyl ឬ Fosetyl-Al ជុំវិញគល់។",
        "treatment_en": "Prune and destroy infected branches; drench root zones with Metalaxyl or Fosetyl-Al immediately.",
        "prevention_km": "រៀបចំប្រព័ន្ធបង្ហូរទឹកកុំឱ្យដក់ជាំ កាត់ក្រីមែកទាបៗកុំឱ្យប៉ះដី និងស្រោចផ្សិត Trichoderma ជុំវិញគល់រៀងរាល់ ២-៣ខែម្តង។",
        "prevention_en": "Ensure rapid drainage away from vines, prune lower foliage off soil contact, and drench with Trichoderma bio-fungicide every 2-3 months.",
    },
    {
        "keywords": ["tomato late blight", "late blight on tomato", "phytophthora infestans", "ខ្លោចស្លឹកប៉េងប៉ោះ", "រលួយផ្លែប៉េងប៉ោះ", "ប៉េងប៉ោះខ្លោចស្លឹក"],
        "title_km": "ជំងឺខ្លោចស្លឹក និងរលួយផ្លែប៉េងប៉ោះ (Tomato Late Blight - Phytophthora infestans)",
        "title_en": "Tomato Late Blight (Phytophthora infestans)",
        "crop_km": "ប៉េងប៉ោះ",
        "crop_en": "Tomato",
        "symptoms_km": "ស្នាមជាំទឹកពណ៌បៃតងចាស់លើស្លឹក រីករាលដាលខ្លោចខ្មៅ និងមានស្នាមរលួយពណ៌ត្នោតរឹងលើផ្លែ។",
        "symptoms_en": "Water-soaked dark green lesions on leaves rapidly turning necrotic brown; firm brown rot on fruit.",
        "treatment_km": "បាញ់ថ្នាំ Mancozeb ឬ Metalaxyl-Mancozeb ឬ Difenoconazole។ កាត់ស្លឹកដែលឆ្លងជំងឺខ្លាំងដុតកម្ទេចចោល។",
        "treatment_en": "Apply Mancozeb or Metalaxyl-Mancozeb or Difenoconazole. Prune and destroy heavily infected lower foliage.",
        "prevention_km": "ចងទ្រើងប៉េងប៉ោះកុំឱ្យស្លឹកប៉ះដី ស្រោចទឹកនៅគល់កុំឱ្យសើមស្លឹក និងដាំលើរងគ្របប្លាស្ទិកកសិកម្ម។",
        "prevention_en": "Stake plants off ground, avoid overhead irrigation, and use plastic mulch to prevent splash infection.",
    },
    {
        "keywords": ["cucumber downy mildew", "cucumber powdery mildew", "ផ្សិតម្សៅត្រសក់", "ត្រសក់ផ្សិតម្សៅ", "រោមក្រោមស្លឹកត្រសក់"],
        "title_km": "ជំងឺផ្សិតម្សៅ និងខ្លោចស្លឹកត្រសក់ (Cucumber Downy & Powdery Mildew)",
        "title_en": "Cucumber Downy & Powdery Mildew",
        "crop_km": "ត្រសក់",
        "crop_en": "Cucumber",
        "symptoms_km": "ស្នាមអុចពណ៌លឿងរាងជ្រុងតាមទ្រនុងស្លឹក ផ្នែកខាងក្រោមស្លឹកមានម្សៅពណ៌ស្វាយ ឬស។",
        "symptoms_en": "Angular yellow spots bounded by leaf veins; purplish or white powdery down on leaf underside.",
        "treatment_km": "បាញ់ថ្នាំ Dimethomorph ឬ Metalaxyl ឬ Azoxystrobin នៅពេលព្រឹកព្រលឹម។",
        "treatment_en": "Spray Dimethomorph or Metalaxyl or Azoxystrobin in early morning hours.",
        "prevention_km": "ដាំចន្លោះគុម្ពឱ្យបានសមស្របដើម្បីឱ្យមានខ្យល់ចេញចូលល្អ បាញ់ថ្នាំការពារផ្សិតជីវសាស្រ្តជាប្រចាំ។",
        "prevention_en": "Maintain adequate row spacing for ventilation; apply bio-fungicide preventatively.",
    },
    {
        "keywords": ["chili anthracnose", "pepper anthracnose", "colletotrichum on chili", "កន្ទុយបារីម្ទេស", "រលួយផ្លែម្ទេស", "ម្ទេសកន្ទុយបារី"],
        "title_km": "ជំងឺផ្សិតកន្ទុយបារី និងរលួយផ្លែម្ទេស (Chili Anthracnose - Colletotrichum)",
        "title_en": "Chili Anthracnose (Colletotrichum spp.)",
        "crop_km": "ម្ទេស",
        "crop_en": "Chili Pepper",
        "symptoms_km": "ស្នាមដំបៅមូលស្រុតចុះលើផ្លែម្ទេស មានរង្វង់មូលជង់ៗគ្នា និងចំណុចខ្មៅៗលើផ្លែបណ្តាលឱ្យស្វិតជ្រុះ។",
        "symptoms_en": "Circular sunken lesions on fruit with concentric rings of dark acervuli, causing fruit rot and drop.",
        "treatment_km": "បាញ់ថ្នាំ Azoxystrobin + Difenoconazole ឬ Mancozeb ឆ្លាស់គ្នា។ ប្រមូលផ្លែរលួយដុតចោល។",
        "treatment_en": "Apply Azoxystrobin + Difenoconazole or Mancozeb in rotation. Collect and burn diseased fruits.",
        "prevention_km": "ជ្រើសរើសគ្រាប់ពូជស្អាត ត្រាំទឹកក្តៅ ៥០អង្សាសេ រយៈពេល ២៥នាទីមុនបណ្តុះ និងដាំលើរងខ្ពស់។",
        "prevention_en": "Soak seeds in 50°C hot water for 25 minutes prior to sowing; maintain well-drained raised beds.",
    },
    {
        "keywords": ["citrus canker", "lime canker", "xanthomonas on citrus", "ដំបៅក្រូច", "ដំបៅក្រូចឆ្មា", "ក្រូចកើតដំបៅ"],
        "title_km": "ជំងឺដំបៅក្រូច និងក្រូចឆ្មា (Citrus Canker - Xanthomonas axonopodis)",
        "title_en": "Citrus Canker (Xanthomonas axonopodis)",
        "crop_km": "ក្រូច",
        "crop_en": "Citrus",
        "symptoms_km": "ដំបៅពកពណ៌ត្នោតរដុប មានរង្វង់លឿងព័ទ្ធជុំវិញលើស្លឹក មែកខ្ចី និងសម្បកផ្លែ។",
        "symptoms_en": "Raised, corky brown lesions surrounded by oily water-soaked yellow halos on leaves, twigs, and fruit.",
        "treatment_km": "កាត់មែកកើតដំបៅចោល បាញ់ថ្នាំពពួកទង់ដែងដូចជា Copper Hydroxide ឬ Copper Oxychloride។",
        "treatment_en": "Prune out diseased shoots; spray preventative copper compounds such as Copper Hydroxide.",
        "prevention_km": "កម្ចាត់សត្វល្អិតមមាចស៊ីត្រួយ និងដង្កូវស៊ីញ៉ែកស្លឹកដែលជាភ្នាក់ងារចម្លងរបួស។",
        "prevention_en": "Control citrus leafminer insect pests that create entry wounds for the canker bacteria.",
    },
    {
        "keywords": ["កំបោរ", "lime", "ដីជូរ", "acidic soil", "pH", "ជីកំប៉ុស", "compost"],
        "title_km": "ការគ្រប់គ្រងដី និងកំបោរកសិកម្ម (Soil Management & Liming)",
        "title_en": "Soil Management & Agricultural Liming",
        "crop_km": "ដី និងកំបោរ",
        "crop_en": "Soil",
        "symptoms_km": "ដីជូរខ្លាំង (pH < 5.0) ដំណាំលូតលាស់យឺត ឫសមិនដើរ ស្លឹកលឿង និងខ្វះជីវជាតិ។",
        "symptoms_en": "Acidic soil (pH < 5.0), stunted root development, phosphorus tie-up, leaf chlorosis.",
        "treatment_km": "បាចកំបោរកសិកម្ម (Dolomite ឬ Calcite) ក្នុងកម្រិត ៥០០-១០០០គីឡូក្រាម/ហិកតា រួចភ្ជួរលុបមុនដាំដុះ ២-៣សប្តាហ៍។",
        "treatment_en": "Apply agricultural lime (Dolomite or Calcite) at 500-1000 kg/ha, incorporate into soil 2-3 weeks prior to planting.",
        "prevention_km": "បន្ថែមជីកំប៉ុស និងជីលាមកសត្វពុកផុយដើម្បីបង្កើនសារធាតុសរីរាង្គក្នុងដី និងធ្វើតេស្ត pH ដីជារៀងរាល់ឆ្នាំ។",
        "prevention_en": "Incorporate mature organic compost regularly to buffer soil pH and test soil acidity annually.",
    },
    {
        "keywords": ["ជី", "npk", "fertilizer", "ទិន្នផល", "yield", "អ៊ុយរ៉េ", "urea", "តុល្យភាពជី"],
        "title_km": "តុល្យភាពសមាមាត្រជី N-P-K និងការបង្កើនទិន្នផលដំណាំផ្អែកលើទិន្នន័យ",
        "title_en": "Data-Driven N-P-K Fertilizer Balancing & Yield Optimization",
        "crop_km": "ជី និងទិន្នផល",
        "crop_en": "Fertilizer & Yield",
        "symptoms_km": "ការដាក់ជីអ៊ុយរ៉េច្រើនហួសប្រមាណធ្វើឱ្យដើមនិងស្លឹកលូតលាស់ទន់ជ្រាយ ងាយរលំដួល និងទាក់ទាញជំងឺប្លាស់និងសត្វល្អិត។",
        "symptoms_en": "Excessive nitrogen causes thin fragile cell walls, severe crop lodging, and increased susceptibility to blast and sucking insects.",
        "treatment_km": "បំបែកការដាក់ជីជាដំណាក់កាល៖ ដាក់ជីទ្រាប់បាត (DAP + Potassium) ពេលរៀបដី និងបំប៉នជីអ៊ុយរ៉េ + ប៉ូតាស្យូមនៅវគ្គបែកគុម្ព និងចេញផ្កា។ ប្រើប៉ូតាស្យូមដើម្បីពង្រឹងកោសិកាឱ្យធន់នឹងជំងឺ។",
        "treatment_en": "Adopt split application: basal DAP and potassium at land preparation, then split-apply urea and potassium at tillering and booting. Increase potassium to thicken cell walls.",
        "prevention_km": "គណនាជីតាមតម្រូវការដកហូតជាក់ស្តែងនៃដំណាំក្នុងមួយតោនទិន្នផល និងប្រើជីសរីរាង្គកំប៉ុសរួមផ្សំដើម្បីកាត់បន្ថយថ្លៃដើម ២០-៣៥%។",
        "prevention_en": "Calculate crop nutrient removal per ton of expected yield and integrate organic compost to lower synthetic fertilizer costs by 20-35%.",
    },
    {
        "keywords": ["ប្តូរមុខដំណាំ", "crop rotation", "សណ្តែក", "legume", "ដីខូច", "ដង្កូវពកឫស"],
        "title_km": "អត្ថប្រយោជន៍វិទ្យាសាស្រ្តនៃការប្តូរមុខដំណាំជាមួយដំណាំសណ្តែក",
        "title_en": "Agronomic Data on Crop Rotation & Legume Nitrogen Fixation",
        "crop_km": "ការប្តូរមុខដំណាំ",
        "crop_en": "Crop Rotation",
        "symptoms_km": "ការដាំដំណាំដដែលៗច្រើនរដូវកាលជាប់គ្នាធ្វើឱ្យដីខ្សោះជីវជាតិ និងកើតមានដង្កូវពកឫសព្រមទាំងមេរោគផ្សិតក្នុងដីកាន់តែខ្លាំង។",
        "symptoms_en": "Continuous monoculture depletes specific root-zone nutrients, exacerbates root-knot nematode populations, and builds up soil pathogens.",
        "treatment_km": "ដាំដំណាំត្រកូលសណ្តែក (សណ្តែកបាយ សណ្តែកដី) បន្ទាប់ពីប្រមូលផលស្រូវ។ បាក់តេរី Rhizobium នៅលើឫសសណ្តែកជួយស្រូបយកអាសូតពីបរិយាកាសបញ្ចូលក្នុងដី ៣០-៥០ គីឡូក្រាម/ហិកតា។",
        "treatment_en": "Rotate with legumes (mung beans, peanuts) after grain harvests. Rhizobium root nodules fix 30-50 kg atmospheric Nitrogen/ha directly into the soil.",
        "prevention_km": "រៀបចំផែនការបង្វិលដំណាំប្រចាំឆ្នាំដើម្បីកាត់ផ្តាច់វដ្តជីវិតសត្វល្អិត និងកាត់បន្ថយការប្រើប្រាស់ជីគីមីរដូវបន្ទាប់បាន ២៥-៣០%។",
        "prevention_en": "Establish a multi-season rotation to break insect life cycles and reduce synthetic nitrogen fertilizer requirements for the next crop by 25-30%.",
    },
    {
        "keywords": ["ipm", "កម្រិតសេដ្ឋកិច្ច", "economic threshold", "គ្រប់គ្រងសត្វល្អិត", "អន្ទាក់"],
        "title_km": "ការគ្រប់គ្រងសត្វល្អិតចម្រុះ (IPM) និងទិន្នន័យកម្រិតសេដ្ឋកិច្ច",
        "title_en": "Integrated Pest Management (IPM) & Economic Threshold Data",
        "crop_km": "ការគ្រប់គ្រងសត្វល្អិត",
        "crop_en": "Pest Management",
        "symptoms_km": "ការប្រញាប់បាញ់ថ្នាំគីមីពេលឃើញសត្វល្អិតបន្តិចបន្តួច បណ្តាលឱ្យងាប់សត្វល្អិតមានប្រយោជន៍ និងធ្វើឱ្យសត្វល្អិតចង្រៃស៊ាំថ្នាំផ្ទុះឡើងខ្លាំង។",
        "symptoms_en": "Premature insecticide spraying kills beneficial predators (spiders, parasitoid wasps), causing pest resurgence and chemical resistance.",
        "treatment_km": "ចុះពិនិត្យចម្ការប្រចាំសប្តាហ៍។ ប្រសិនបើសត្វល្អិតនៅក្រោមកម្រិតសេដ្ឋកិច្ច (ឧ. ស្លឹកខូចក្រោម ៥-១០%) សូមប្រើភ្នាក់ងារជីវសាស្រ្ត (Bt, Beauveria) ឬអន្ទាក់ស្អិត។ ប្រើថ្នាំគីមីលុះត្រាតែកើនលើសកម្រិតទប់ទល់។",
        "treatment_en": "Conduct weekly scouting. If pests remain below economic thresholds (e.g. under 5-10% foliar damage), use biologicals (Bt, Beauveria bassiana) or sticky traps. Reserve chemicals for extreme outbreaks.",
        "prevention_km": "ដាំផ្កាជុំវិញភ្លឺស្រែដើម្បីបង្កើតជម្រកសម្រាប់សត្វល្អិតមានប្រយោជន៍ដែលជួយស៊ីសត្វល្អិតចង្រៃដោយឥតគិតថ្លៃ។",
        "prevention_en": "Plant flowering bund borders to shelter predatory beneficial insects that provide continuous free biological suppression.",
    },
]


def _format_crop_all_diseases_reply_km(crop: Any, diseases: list[Any]) -> str:
    crop_title = getattr(crop, "name_kh", None) or getattr(crop, "name", "ដំណាំ")
    total = len(diseases)
    items = []
    for i, d in enumerate(diseases, 1):
        d_name_km = (getattr(d, "name_kh", None) or getattr(d, "name", "") or "").strip()
        d_name_en = (getattr(d, "name", "") or "").strip()
        d_desc = (getattr(d, "description_kh", None) or getattr(d, "description", "") or "").strip()
        d_treat = (getattr(d, "treatment_kh", None) or getattr(d, "treatment", "") or "").strip()

        desc_short = d_desc.split("។")[0].strip() + "។" if "។" in d_desc else d_desc[:120].strip()
        treat_short = d_treat.split("។")[0].strip() + "។" if "។" in d_treat else d_treat[:120].strip()

        d_disp = d_name_km if (d_name_km.startswith("ជំងឺ") or d_name_km.startswith("ការ") or d_name_km.startswith("មេរោគ") or d_name_km.startswith("កង្វះ")) else f"ជំងឺ{d_name_km}"
        items.append(
            f"{i}. {d_disp} ({d_name_en})\n"
            f"- រោគសញ្ញាសម្គាល់៖ {desc_short}\n"
            f"- ការព្យាបាលចម្បង៖ {treat_short}"
        )
    body = "\n\n".join(items)
    return clean_professional_text(
        f"បញ្ជីជំងឺ និងបញ្ហាប្រឈមចម្បងៗលើដំណាំ {crop_title} (សរុប {total} ជំងឺ)៖\n\n"
        f"ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព! នៅក្នុងប្រព័ន្ធបណ្តុះបណ្តាលកសិកម្ម AgriSystem ដំណាំ {crop_title} មានកត់ត្រាជំងឺ និងសត្វល្អិតចម្បងៗដូចខាងក្រោម៖\n\n"
        f"{body}\n\n"
        f"ដំបូន្មានបច្ចេកទេស៖ ប្រសិនបើដំណាំ {crop_title} របស់អ្នកកំពុងមានរោគសញ្ញាជាក់លាក់ណាមួយ សូមរៀបរាប់អំពីរោគសញ្ញាលើស្លឹក ដើម ឬផ្លែ ដើម្បីឱ្យខ្ញុំជួយធ្វើរោគវិនិច្ឆ័យលម្អិត និងផ្តល់រូបមន្តព្យាបាលឱ្យចំគោលដៅបំផុត។"
    )


def _format_crop_all_diseases_reply_en(crop: Any, diseases: list[Any]) -> str:
    crop_title = getattr(crop, "name", "Crop")
    total = len(diseases)
    items = []
    for i, d in enumerate(diseases, 1):
        d_name_en = (getattr(d, "name", "") or "").strip()
        d_name_km = (getattr(d, "name_kh", None) or "").strip()
        d_desc = (getattr(d, "description", "") or "").strip()
        d_treat = (getattr(d, "treatment", "") or "").strip()

        desc_short = d_desc.split(".")[0].strip() + "." if "." in d_desc else d_desc[:120].strip()
        treat_short = d_treat.split(".")[0].strip() + "." if "." in d_treat else d_treat[:120].strip()

        title = f"{d_name_en} ({d_name_km})" if d_name_km else d_name_en
        items.append(
            f"{i}. {title}\n"
            f"- Observable Symptoms: {desc_short}\n"
            f"- Primary Treatment: {treat_short}"
        )
    body = "\n\n".join(items)
    return clean_professional_text(
        f"Key Diseases and Pathogens Affecting {crop_title} ({total} Diseases Recorded):\n\n"
        f"Greetings! The AgriSystem trained knowledge base includes the following key diseases and conditions affecting {crop_title}:\n\n"
        f"{body}\n\n"
        f"Agronomic Advice: If your {crop_title} is showing specific symptoms, please describe what you observe on the leaves, stems, or fruits so I can provide an exact diagnosis and tailored treatment plan."
    )


def _normalize_query(text: str) -> str:
    if not text:
        return ""
    t = text.lower()
    t = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", t)
    # Normalize Khmer orthography: ឬស <-> ឫស
    t = t.replace("\u17af\u179f", "\u17ac\u179f")
    # Normalize Khmer greeting Coeng: សួស្ដី <-> សួស្តី
    t = t.replace("\u179f\u17bd\u179f\u17d2\u178f\u17b8", "\u179f\u17bd\u179f\u17d2\u178a\u17b8")
    return t


def _synthesize_local_expert_reply(user_message: str, context: str = "", language: Optional[str] = None) -> str:
    """Offline, deterministic agronomic synthesizer prioritizing crop matching and local database records."""
    is_khmer = _is_khmer(language, user_message)

    matched_crop = None
    matched_disease = None
    matched_kb_item = None
    is_fertilizer_query = False
    is_listing_all_crop_diseases = False

    q_norm = _normalize_query(user_message)

    thanks_terms = ["អរគុណ", "អរគុណច្រើន", "អរគុណបង", "thank", "thanks", "appreciate", "helpful", "good job", "great job"]
    if any(k in q_norm for k in thanks_terms) and not any(k in q_norm for k in ["ជំងឺ", "disease", "រលួយ", "rot", "ថ្នាំ"]):
        if is_khmer:
            return clean_professional_text(
                "មិនអីទេបាទ/ចាស! ខ្ញុំរីករាយណាស់ដែលបានជួយលោកអ្នក។ "
                "ប្រសិនបើដំណាំ ឬការងារចម្ការរបស់អ្នកមានបញ្ហា ឬត្រូវការជំនួយបន្ថែមនៅពេលក្រោយ សូមកុំស្ទាក់ស្ទើរក្នុងការសួរខ្ញុំណា។ "
                "សូមជូនពរឱ្យដំណាំរបស់អ្នកលូតលាស់ល្អ និងទទួលបានទិន្នផលខ្ពស់!"
            )
        return clean_professional_text(
            "You are very welcome! I am truly glad I could help you today. "
            "If you ever have more questions about crop health, soil care, or farming techniques, please don't hesitate to ask. "
            "Wishing you healthy crops and a wonderful harvest season!"
        )

    empathy_terms = ["ហត់", "នឿយ", "បារម្ភ", "តានតឹង", "tired", "exhaust", "worried", "stress"]
    if any(k in q_norm for k in empathy_terms) and not any(k in q_norm for k in ["ជំងឺ", "disease", "រលួយ", "rot", "ថ្នាំ"]):
        if is_khmer:
            return clean_professional_text(
                "ខ្ញុំយល់ច្បាស់ពីការលំបាក និងការនឿយហត់របស់បងប្អូនកសិករ! "
                "ការងារកសិកម្មទាមទារទាំងកម្លាំងកាយ កម្លាំងចិត្ត និងការអត់ធ្មត់ខ្ពស់នៅក្រោមពន្លឺថ្ងៃ និងអាកាសធាតុប្រែប្រួល។ "
                "សូមកុំភ្លេចសម្រាក និងថែរក្សាសុខភាពឱ្យបានល្អណា។ "
                "តើបច្ចុប្បន្នដំណាំរបស់អ្នកមានបញ្ហាអ្វីដែលខ្ញុំអាចជួយសម្រួលការងារបច្ចេកទេសជូនបានដែរទេ?"
            )
        return clean_professional_text(
            "I truly understand how demanding and exhausting farming can be. "
            "Working under the sun and dealing with unpredictable weather requires immense resilience and hard work. "
            "Please make sure to take breaks, stay hydrated, and care for yourself. "
            "How are your crops looking right now? I would be glad to help lighten your load with tailored technical advice."
        )

    # Check if user is asking about fertilizers, soil, or nutrition
    fertilizer_keywords = ["ជី", "ជីគីមី", "ជីកំប៉ុស", "ដី", "កំបោរ", "លាមកសត្វ", "fertilizer", "npk", "urea", "compost", "soil", "nutrient", "nutrition"]
    is_fertilizer_query = any(k in q_norm for k in fertilizer_keywords)

    try:
        from app.models.disease import Disease
        from app.models.crop import Crop

        # 1. Match Crop from Database
        all_crops = Crop.query.all()
        for c in all_crops:
            c_en = (c.name or "").lower()
            c_km = (c.name_kh or "").lower()
            if (c_en and c_en in q_norm) or (c_km and c_km in q_norm):
                matched_crop = c
                break

        # 2. Match Disease within Crop (if crop matched)
        if matched_crop:
            crop_diseases = matched_crop.diseases or []
            disease_list_terms = [
                "ជំងឺអ្វីខ្លះ", "មានជំងឺអ្វីខ្លះ", "កើតជំងឺអ្វីខ្លះ",
                "ជំងឺណាខ្លះ", "រាយនាមជំងឺ", "ជំងឺទាំងអស់", "បញ្ជីជំងឺ",
                "what diseases", "which diseases", "what are the diseases", "list of diseases",
                "list diseases", "all diseases of", "catalog of diseases",
            ]
            is_disease_listing_query = any(k in q_norm for k in disease_list_terms)

            for d in crop_diseases:
                name_en = (d.name or "").lower()
                name_km = (d.name_kh or "").lower()
                if (name_en and name_en in q_norm) or (name_km and name_km in q_norm):
                    matched_disease = d
                    break

            if not matched_disease and not is_disease_listing_query:
                symptom_keywords = {
                    "រលួយ": ["rot", "root", "foot", "stem"],
                    "អុច": ["spot", "leaf"],
                    "ស្ពោត": ["wilt", "blight"],
                    "ក្រៀម": ["blight", "blast", "dry"],
                    "ចៃ": ["aphid", "mite", "thrip"],
                    "ក្រា": ["mite", "pest"],
                    "ដង្កូវ": ["worm", "borer", "armyworm", "caterpillar"],
                    "ផ្សិត": ["fungus", "mold", "mildew", "blast"],
                    "លឿង": ["yellow", "mosaic", "chlorosis"],
                }
                for kw_km, kw_en_list in symptom_keywords.items():
                    if kw_km in q_norm or any(ke in q_norm for ke in kw_en_list):
                        for d in crop_diseases:
                            d_desc = f"{d.name or ''} {d.name_kh or ''} {d.description or ''} {d.description_kh or ''}".lower()
                            if kw_km in d_desc or any(ke in d_desc for ke in kw_en_list):
                                matched_disease = d
                                break
                    if matched_disease:
                        break

            # If user explicitly asked for listing diseases of this crop
            if not matched_disease and crop_diseases and is_disease_listing_query and not is_fertilizer_query:
                is_listing_all_crop_diseases = True

        # 3. If no crop matched, search globally across all database diseases
        if not matched_disease and not matched_crop:
            all_diseases = Disease.query.all()
            for d in all_diseases:
                name_en = (d.name or "").lower()
                name_km = (d.name_kh or "").lower()
                if (name_en and name_en in q_norm) or (name_km and name_km in q_norm):
                    matched_disease = d
                    break
    except Exception:
        matched_disease = None
        matched_crop = None

    # 4. If still not matched, search Cambodian agronomic dictionary (Durian, Pepper, Lime, etc.)
    if not matched_disease and not matched_crop:
        cambodian_kb_combos = [
            {"item_idx": 0, "require_crop": ["ទុរេន", "ធូរេន", "durian"], "require_symptom": ["រលួយ", "ជ័រ", "ស្អុយ", "rot", "canker", "phytophthora", "ooz"]},
            {"item_idx": 1, "require_crop": ["ស្រូវ", "rice", "paddy"], "require_symptom": ["ប្លាស់", "blast", "magnaporthe", "កួរ"]},
            {"item_idx": 2, "require_crop": ["ដំឡូងមី", "cassava"], "require_symptom": ["ម៉ូសេក", "mosaic", "រួញ", "curl", "មមាចស", "whitefl", "cmd"]},
            {"item_idx": 3, "require_crop": ["ពោត", "corn", "maize"], "require_symptom": ["ដង្កូវ", "armyworm", "spodoptera", "worm", "frass"]},
            {"item_idx": 4, "require_crop": ["ម្រេច", "pepper"], "require_symptom": ["ងាប់រហ័ស", "ងាប់យឺត", "quick wilt", "slow wilt", "wilt", "phytophthora"]},
            {"item_idx": 5, "require_crop": ["ប៉េងប៉ោះ", "tomato"], "require_symptom": ["ខ្លោចស្លឹក", "រលួយផ្លែ", "late blight"]},
            {"item_idx": 6, "require_crop": ["ត្រសក់", "cucumber"], "require_symptom": ["ផ្សិតម្សៅ", "រោម", "mildew"]},
            {"item_idx": 7, "require_crop": ["ម្ទេស", "chili"], "require_symptom": ["កន្ទុយបារី", "រលួយផ្លែ", "anthracnose"]},
            {"item_idx": 8, "require_crop": ["ក្រូច", "citrus"], "require_symptom": ["កង់កា", "ដំបៅ", "canker"]},
            {"item_idx": 9, "direct_terms": ["ដីជូរ", "កំបោរ", "acidic soil", "agricultural lime", "dolomite lime", "soil acidity", "soil ph", "ph ដី", "liming"]},
            {"item_idx": 10, "direct_terms": ["តុល្យភាពជី", "សមាមាត្រជី", "npk", "ជីអ៊ុយរ៉េ", "fertilizer balance", "balanced fertilization", "split application"]},
            {"item_idx": 11, "direct_terms": ["ប្តូរមុខដំណាំ", "បង្វិលមុខដំណាំ", "crop rotation", "legume", "rotate crops", "nitrogen fixation"]},
            {"item_idx": 12, "direct_terms": ["ipm", "គ្រប់គ្រងសត្វល្អិត", "កម្រិតសេដ្ឋកិច្ច", "integrated pest management", "economic threshold"]},
        ]
        for combo in cambodian_kb_combos:
            idx = combo["item_idx"]
            if idx < len(CAMBODIAN_AGRI_KB):
                item = CAMBODIAN_AGRI_KB[idx]
                direct = combo.get("direct_terms")
                if direct and any(dt in q_norm for dt in direct):
                    matched_kb_item = item
                    break
                req_c = combo.get("require_crop")
                req_s = combo.get("require_symptom")
                if req_c and req_s:
                    has_crop = any(c in q_norm for c in req_c)
                    has_sym = any(s in q_norm for s in req_s)
                    if has_crop and has_sym:
                        matched_kb_item = item
                        break

        if not matched_kb_item:
            for item in CAMBODIAN_AGRI_KB:
                if any(_normalize_query(k) in q_norm for k in item["keywords"]):
                    matched_kb_item = item
                    break

    # Check if user is asking about the AI / creator / identity
    identity_keywords_km = [
        "អ្នកជាអ្នកណា", "អ្នកណាបង្កើត", "នរណាបង្កើត", "ម៉ូឌែលឈ្មោះអ្វី", "ai នេះឈ្មោះអ្វី",
        "ប្រធានក្រុម", "ម៉ៅ សៀវអ៊ិ", "អំពីខ្លួនអ្នក", "ណែនាំខ្លួន", "ជំនាន់ទីប៉ុន្មាន", "ម៉ូឌែល agy",
        "ជានរណា", "មេក្រុម", "អំពី ai", "អ្នកណាធ្វើ", "ឈ្មោះអ្វី",
    ]
    identity_keywords_en = [
        "who are you", "who created you", "who made you", "who developed you", "what is your name",
        "what is your model", "what model are you", "model name", "who is your leader",
        "who is your team leader", "team leader", "who is mao seavik", "about you",
        "tell me about yourself", "introduce yourself", "what version are you", "what is agy",
        "about ai", "who built you",
    ]
    if is_khmer and any(k in q_norm for k in identity_keywords_km):
        return clean_professional_text(
            "ជំរាបសួរលោកអ្នក! ខ្ញុំគឺជា AgriSystem AI (ម៉ូឌែលឈ្មោះ AGY V2.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ "
            "ខ្ញុំជាជំនួយការកសិកម្មឆ្លាតវៃ ត្រៀមខ្លួនជានិច្ចក្នុងការជួយពិនិត្យជំងឺដំណាំ វិភាគរោគសញ្ញា ផ្តល់បច្ចេកទេសដាំដុះ និងចែករំលែកវិធីសាស្រ្តការពារ និងការព្យាបាលប្រកបដោយសុវត្ថិភាពខ្ពស់។ "
            "តើថ្ងៃនេះខ្ញុំអាចជួយអ្វីដល់លោកអ្នកបានខ្លះដែរ?"
        )
    if not is_khmer and any(k in q_norm for k in identity_keywords_en):
        return clean_professional_text(
            "Hello! I am AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. "
            "I am an intelligent agricultural assistant dedicated to helping farmers diagnose plant diseases, improve crop health, and adopt safe, sustainable farming practices. "
            "How can I help you and your farm today?"
        )

    # Check for simple greetings
    greetings_km = {"សួស្តី", "សួស្ដី", "សួរស្តី", "សួរស្ដី", "ជំរាបសួរ", "ជំរាបសួរបង", "សួស្តីបង", "សួស្តីប្អូន", "អរុណសួស្តី", "សុខសប្បាយជាទេ", "hello", "hi"}
    greetings_en = {"hi", "hello", "hey", "greetings", "good morning", "good afternoon", "how are you", "hi there"}
    active_greetings = greetings_km if is_khmer else greetings_en
    if any(q_norm == g or q_norm.startswith(g + " ") for g in active_greetings):
        if is_khmer:
            return clean_professional_text(
                "សួស្តីបាទ/ចាស! ខ្ញុំរីករាយណាស់ដែលបានជួយលោកអ្នកនៅថ្ងៃនេះ។ តើដំណាំ ឬការងារកសិកម្មរបស់អ្នកដំណើរការយ៉ាងណាដែរ? "
                "តើមានបញ្ហាជំងឺដំណាំ ឬការដាំដុះអ្វីដែលខ្ញុំអាចជួយផ្តល់ដំបូន្មាន ឬដោះស្រាយជូនបានដែរទេ?"
            )
        return clean_professional_text(
            "Hello! Warm greetings to you! It's a pleasure to assist you. How are your crops doing today, and how can I help you with your farming needs?"
        )

    # Handle Crop Fertilizer / Nutrition Guidance
    target_crop_name = ""
    if matched_crop:
        target_crop_name = (matched_crop.name_kh or matched_crop.name) if is_khmer else (matched_crop.name or "Crop")
    elif matched_kb_item:
        target_crop_name = matched_kb_item["crop_km"] if is_khmer else matched_kb_item["crop_en"]

    if target_crop_name and is_fertilizer_query:
        if is_khmer:
            return clean_professional_text(
                f"ការណែនាំបច្ចេកទេសជី និងអាហារូបត្ថម្ភសម្រាប់ដំណាំ {target_crop_name}\n\n"
                f"ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព! ខាងក្រោមនេះជារូបមន្ត និងកាលវិភាគប្រើប្រាស់ជីប្រកបដោយប្រសិទ្ធភាពខ្ពស់៖\n\n"
                f"១. ដំណាក់កាលលូតលាស់ដើម និងស្លឹក (Vegetative Stage)\n"
                f"- ប្រើប្រាស់ជីកំប៉ុសសរីរាង្គពុកផុយល្អលាយជាមួយផ្សិតទ្រីកូឌែរម៉ា (Trichoderma) ដើម្បីបំប៉នដី និងការពារជំងឺឫស។\n"
                f"- បន្ថែមជី NPK រូបមន្តតុល្យភាពដូចជា 15-15-15 ឬ 16-16-16 ឬជីអ៊ុយរ៉េ (46-0-0) ក្នុងបរិមាណសមស្របតាមអាយុកាលដំណាំ។\n\n"
                f"២. ដំណាក់កាលត្រៀមផ្កា និងផ្លែ (Flowering & Fruiting)\n"
                f"- បន្ថយជាតិអាសូត (N) និងបង្កើនជីផូស្វ័រ និងប៉ូតាស្យូម ដូចជារូបមន្ត 12-12-17, 8-24-24 ឬ 0-0-60 ដើម្បីជួយឱ្យផ្កាកាន់ល្អ និងផ្លែធំផ្អែម មានទម្ងន់។\n"
                f"- បាញ់បន្ថែមជីកាល់ស្យូម-បូរ៉ុង (Calcium-Boron) ដើម្បីកាត់បន្ថយការជ្រុះផ្កា និងការប្រេះផ្លែ។\n\n"
                f"៣. ការគ្រប់គ្រងគុណភាពដី (Soil Management)\n"
                f"- វាស់កម្រិត pH ដីឱ្យនៅចន្លោះ ៥.៥ ដល់ ៦.៥។ ប្រសិនបើដីជូរ (pH ទាប) ត្រូវរោយកំបោរកសិកម្ម (Dolomite) នៅដើមរដូវ។\n\n"
                f"ចំណាំ៖ ត្រូវស្រោចទឹកឱ្យបានគ្រប់គ្រាន់ក្រោយពេលដាក់ជីគីមីជានិច្ច ដើម្បីកុំឱ្យរលាកឫសដំណាំ។"
            )
        else:
            return clean_professional_text(
                f"Fertilizer and Nutrient Management for {target_crop_name}\n\n"
                f"Greetings! Here is your customized nutrition program:\n\n"
                f"1. Vegetative and Growth Stage\n"
                f"- Apply well-decomposed organic compost inoculated with Trichoderma to improve soil organic matter and suppress root pathogens.\n"
                f"- Side-dress with balanced NPK (15-15-15 or 16-16-16) or moderate nitrogen (Urea 46-0-0) calibrated to plant age.\n\n"
                f"2. Flowering and Fruit Development\n"
                f"- Shift to high phosphorus and potassium formulations (such as 12-12-17, 8-24-24, or 0-0-60) to stimulate flower retention, fruit size, and sweetness.\n"
                f"- Foliar spray micronutrients, specifically Calcium-Boron, to prevent blossom end rot and fruit splitting.\n\n"
                f"3. Soil pH and Root Zone Care\n"
                f"- Maintain soil pH in the optimal range of 5.8 - 6.5. Broadcast agricultural limestone (Dolomite) if soil acidity is elevated.\n\n"
                f"Reminder: Always irrigate thoroughly after granular fertilizer application to prevent osmotic root shock."
            )

    # Response for listing all diseases of a crop from database
    if is_listing_all_crop_diseases and matched_crop:
        crop_diseases = getattr(matched_crop, "diseases", []) or []
        if crop_diseases:
            if is_khmer:
                return _format_crop_all_diseases_reply_km(matched_crop, crop_diseases)
            return _format_crop_all_diseases_reply_en(matched_crop, crop_diseases)

    # Response from Knowledge Dictionary
    if matched_kb_item:
        if is_khmer:
            return clean_professional_text(
                f"{matched_kb_item['title_km']}\n\n"
                f"ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព! ខាងក្រោមនេះជាវិធានការដោះស្រាយ និងការព្យាបាលប្រកបដោយវិជ្ជាជីវៈ៖\n\n"
                f"១. រោគសញ្ញាជាក់ស្តែង (Symptoms)\n"
                f"- {matched_kb_item['symptoms_km']}\n\n"
                f"២. វិធានការព្យាបាលបន្ទាន់ (Treatment)\n"
                f"- {matched_kb_item['treatment_km']}\n\n"
                f"៣. វិធានការបង្ការ និងថែទាំដី (Prevention & Soil Care)\n"
                f"- {matched_kb_item['prevention_km']}\n\n"
                f"ការណែនាំសុវត្ថិភាព៖ សូមពាក់ម៉ាស់ ស្រោមដៃ និងវ៉ែនតាការពារពេលប្រើប្រាស់ថ្នាំកសិកម្ម និងគោរពតាមរយៈពេលផ្អាកមុនប្រមូលផល (PHI)។"
            )
        else:
            return clean_professional_text(
                f"{matched_kb_item['title_en']}\n\n"
                f"Greetings! Here is the structured agronomic recommendation for your farm:\n\n"
                f"1. Symptoms and Diagnosis\n"
                f"- {matched_kb_item['symptoms_en']}\n\n"
                f"2. Immediate Treatment Strategy\n"
                f"- {matched_kb_item['treatment_en']}\n\n"
                f"3. Long-Term Prevention and Field Care\n"
                f"- {matched_kb_item['prevention_en']}\n\n"
                f"Safety Reminder: Always wear personal protective equipment (PPE) when applying crop protection chemicals and strictly observe pre-harvest intervals (PHI)."
            )

    # Response from Database Match
    if matched_disease:
        if is_khmer:
            d_name = matched_disease.name_kh or matched_disease.name
            c_name = (matched_disease.crop.name_kh or matched_disease.crop.name) if matched_disease.crop else "ដំណាំ"
            desc = matched_disease.description_kh or matched_disease.description or "ជំងឺនេះប៉ះពាល់ដល់ការលូតលាស់និងទិន្នផលដំណាំ។"
            cause = matched_disease.cause_explanation_kh or matched_disease.cause_explanation or "កើតឡើងដោយសារមេរោគផ្សិត ឬបាក់តេរីក្នុងលក្ខខណ្ឌសំណើមខ្ពស់។"
            treat = matched_disease.treatment_kh or matched_disease.treatment or "កាត់ក្រីមែកដែលខូចចោល និងប្រើប្រាស់ថ្នាំកសិកម្មការពារផ្សិតសមស្របតាមកម្រិតណែនាំ។"
            prev = matched_disease.prevention_tips_kh or matched_disease.prevention_tips or "ជ្រើសរើសពូជធន់ ដាំលើដីមានប្រព័ន្ធបង្ហូរទឹកល្អ និងកែតម្រូវដីដោយកំបោរកសិកម្ម។"
            return clean_professional_text(
                f"ការណែនាំបច្ចេកទេស៖ {d_name} លើដំណាំ {c_name}\n\n"
                f"ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព! ខាងក្រោមនេះជាវិធានការដោះស្រាយ និងការព្យាបាលប្រកបដោយវិជ្ជាជីវៈ៖\n\n"
                f"១. រោគសញ្ញា និងមូលហេតុបង្ក (Symptoms & Cause)\n"
                f"- ការពិពណ៌នា៖ {desc}\n"
                f"- មូលហេតុចម្បង៖ {cause}\n\n"
                f"២. វិធានការព្យាបាលបន្ទាន់ (Treatment)\n"
                f"- {treat}\n\n"
                f"៣. វិធានការបង្ការ និងថែទាំដី (Prevention & Soil Care)\n"
                f"- {prev}\n\n"
                f"ការណែនាំសុវត្ថិភាព៖ សូមពាក់ម៉ាស់ ស្រោមដៃ និងវ៉ែនតាការពារពេលប្រើប្រាស់ថ្នាំកសិកម្ម និងគោរពតាមរយៈពេលផ្អាកមុនប្រមូលផល (PHI)។"
            )
        else:
            d_name = matched_disease.name
            c_name = matched_disease.crop.name if matched_disease.crop else "crop"
            desc = matched_disease.description or "Disease affecting crop vigor and yield."
            cause = matched_disease.cause_explanation or "Pathogen proliferation favored by excessive humidity or poor soil drainage."
            treat = matched_disease.treatment or "Apply registered fungicides at recommended label rates and prune heavily infected plant parts."
            prev = matched_disease.prevention_tips or "Maintain good field drainage, ensure balanced fertilization, and apply preventative bio-controls."
            return clean_professional_text(
                f"Technical Guidance: {d_name} on {c_name}\n\n"
                f"Greetings! Here is the structured agronomic recommendation for your farm:\n\n"
                f"1. Symptoms and Root Cause\n"
                f"- Overview: {desc}\n"
                f"- Root Cause: {cause}\n\n"
                f"2. Immediate Treatment Strategy\n"
                f"- {treat}\n\n"
                f"3. Long-Term Prevention and Field Care\n"
                f"- {prev}\n\n"
                f"Safety Reminder: Always wear personal protective equipment (PPE) when applying crop protection chemicals and strictly observe pre-harvest intervals (PHI)."
            )

    if is_khmer:
        return clean_professional_text(
            "ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព! "
            "ខ្ញុំបានកត់ត្រាសំណួររបស់អ្នករួចហើយ។ ដើម្បីជួយវិភាគឱ្យកាន់តែចំគោលដៅ និងផ្តល់រូបមន្តព្យាបាលបានត្រឹមត្រូវ សូមជម្រាបបន្ថែមអំពី៖\n"
            "១. ឈ្មោះដំណាំដែលកំពុងដាំ (ឧទាហរណ៍៖ ស្រូវ ទុរេន ដំឡូងមី ម្រេច បន្លែ...)\n"
            "២. រោគសញ្ញាជាក់ស្តែងលើស្លឹក ដើម ឬឫស\n"
            "៣. អាយុកាលដំណាំ និងស្ថានភាពដី ឬការស្រោចស្រព។\n"
            "ខ្ញុំត្រៀមខ្លួនជានិច្ចដើម្បីជួយដោះស្រាយជូនលោកអ្នក!"
        )
    return clean_professional_text(
        "Greetings! "
        "To provide you with the most accurate diagnosis and treatment plan, could you please specify:\n"
        "1. Your crop name (e.g. Rice, Durian, Cassava, Sweet Corn, Pepper, Vegetables)\n"
        "2. Visible symptoms on the leaves, stems, or fruits\n"
        "3. Crop age and recent weather or moisture conditions.\n"
        "I am ready to help you optimize your crop health!"
    )


def _gradio_client_reply(endpoint: str, token: str, question: str, context: str, timeout: float, max_new_tokens: int) -> Optional[str]:
    """Call the Hugging Face Space using the official gradio_client library."""
    try:
        from gradio_client import Client

        clean_ep = endpoint.rstrip("/")
        auth_token = token if (token and token.startswith("hf_")) else None
        client = Client(clean_ep, token=auth_token)
        try:
            job = client.submit(
                question=question,
                temperature=0.5,
                max_new_tokens=max_new_tokens,
                api_name="/answer",
            )
            result = job.result(timeout=timeout)
            if isinstance(result, str) and result.strip():
                return result.strip()
        except Exception:
            pass
    except Exception as exc:
        try:
            current_app.logger.warning("gradio_client request failed: %s", exc)
        except RuntimeError:
            pass
    return None


def _gradio_call_urls(endpoint: str) -> list[str]:
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


def _gradio_sse_reply(endpoint: str, token: str, prompt: str, timeout: float, max_new_tokens: int) -> str:
    """Direct HTTP SSE fallback for Gradio Spaces."""
    headers = {"Content-Type": "application/json"}
    hostname = (urlparse(endpoint).hostname or "").lower()
    if token and (not hostname.endswith(".hf.space") or token.startswith("hf_")):
        headers["Authorization"] = f"Bearer {token}"
    payload = {"data": [prompt, 0.5, max(32, min(int(max_new_tokens), 1024))]}

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
    question: str = "",
    context: str = "",
) -> str:
    """Call the deployed model on Hugging Face."""
    if is_gradio_endpoint(endpoint):
        q = question or prompt
        client_res = _gradio_client_reply(endpoint, token, q, context, timeout, max_new_tokens)
        if client_res:
            return client_res
        return _gradio_sse_reply(endpoint, token, q, timeout, max_new_tokens)

    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = requests.post(
        endpoint,
        json={
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": max_new_tokens,
                "temperature": 0.5,
                "top_p": 0.9,
                "return_full_text": False,
            },
        },
        headers=headers,
        timeout=timeout,
    )
    response.raise_for_status()
    return _clean_model_output(_extract_text(response.json()))


def generate_reply(
    user_message: str,
    *,
    context: str = "",
    language: Optional[str] = None,
) -> Optional[str]:
    """Generate a reply using the user's trained AI assistant."""
    if not user_message or not is_configured():
        return None

    endpoint = _endpoint()
    token = _setting("HF_TOKEN") or _setting("HUGGINGFACEHUB_API_TOKEN")
    prompt = _build_prompt(user_message, context, language)
    raw_reply = ""

    try:
        max_tokens = 768
        raw_reply = request_endpoint(
            endpoint,
            token,
            prompt,
            timeout=_timeout(),
            max_new_tokens=max_tokens,
            question=user_message,
            context=context,
        )
    except Exception as exc:
        try:
            current_app.logger.warning("Remote agricultural AI request failed: %s", exc)
        except RuntimeError:
            pass

    cleaned_reply = _clean_model_output(raw_reply, user_message, language)

    if _is_valid_reply(cleaned_reply, user_message, language):
        return cleaned_reply

    # Fallback to local expert agronomic synthesis (zero commercial LLMs)
    return _synthesize_local_expert_reply(user_message, context, language)
