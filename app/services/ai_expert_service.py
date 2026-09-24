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
            "សូមឆ្លើយជាភាសាខ្មែរឱ្យបានត្រឹមត្រូវ ច្បាស់លាស់ រលូន និងមានលក្ខណៈវិជ្ជាជីវៈជានិច្ច។ "
            "ផ្តល់ដំបូន្មានជាក់ស្តែង រៀបចំជាចំណុច វិធីព្យាបាល និងវិធានការបង្ការប្រកបដោយសុវត្ថិភាព។\n\n"
            f"បរិបទចំណេះដឹងកសិកម្ម៖\n{bounded_context}\n\n"
            f"សំណួររបស់កសិករ៖\n{bounded_message}\n\n"
            "ចម្លើយ៖\n"
        )

    language_name = _language_name(language)
    bounded_context = (context or "No matching knowledge-base context was found.").strip()[:MAX_CONTEXT_CHARS]
    return (
        "You are AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. "
        "You are a professional, empathetic, and knowledgeable agricultural expert who communicates naturally and warmly like a human agronomist. "
        f"Answer in {language_name}. Give complete, well-structured, practical advice regarding crop health, diagnosis, IPM, safe chemical treatment, and prevention.\n\n"
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

    # Clean double spaces caused by placeholder removal
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n\s*\n\s*\n+", "\n\n", cleaned)

    return cleaned.strip()


def _is_valid_reply(reply: str, user_message: str = "", language: Optional[str] = None) -> bool:
    """Validate that the model response is coherent, sufficiently long, and not a repetition loop."""
    if not reply or len(reply.strip()) < 10:
        return False
    cleaned = reply.strip()

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

    is_km = _is_khmer(language, user_message)
    # If the user asked in Khmer, the response must contain Khmer script
    if is_km and not bool(re.search(r"[\u1780-\u17ff]", cleaned)):
        return False

    return True


CAMBODIAN_AGRI_KB = [
    {
        "keywords": ["ទុរេន", "ធូរេន", "durian", "រលួយឬស", "រលួយដើម", "phytophthora", "fitora", "ជ័រ"],
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
        "keywords": ["ស្រូវ", "rice", "ប្លាស់", "blast", "ខ្លោចស្លឹក"],
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
        "keywords": ["ដំឡូងមី", "cassava", "ម៉ូសេក", "mosaic", "រួញស្លឹក"],
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
        "keywords": ["ពោត", "corn", "maize", "ដង្កូវហ្វូង", "armyworm", "ចោះដើម"],
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
        "keywords": ["ម្រេច", "pepper", "ងាប់រហ័ស", "ងាប់យឺត", "quick wilt"],
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
        "keywords": ["ប៉េងប៉ោះ", "tomato", "ខ្លោចស្លឹក", "រលួយផ្លែ", "blight"],
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
        "keywords": ["ត្រសក់", "cucumber", "ផ្សិតម្សៅ", "រលួយ", "mildew"],
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
        "keywords": ["ម្ទេស", "chili", "chilli", "កន្ទុយបារី", "anthracnose", "រលួយផ្លែ"],
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
        "keywords": ["ក្រូច", "ក្រូចឆ្មា", "lime", "lemon", "citrus", "ដំបៅ", "canker"],
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
    }
]


def _synthesize_local_expert_reply(user_message: str, context: str = "", language: Optional[str] = None) -> str:
    """Offline, deterministic agronomic synthesizer prioritizing crop matching and local database records."""
    is_khmer = _is_khmer(language, user_message)

    matched_crop = None
    matched_disease = None
    matched_kb_item = None
    is_fertilizer_query = False

    q_norm = user_message.lower()

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
            for d in crop_diseases:
                name_en = (d.name or "").lower()
                name_km = (d.name_kh or "").lower()
                if (name_en and name_en in q_norm) or (name_km and name_km in q_norm):
                    matched_disease = d
                    break
            if not matched_disease:
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
            if not matched_disease and crop_diseases and not is_fertilizer_query:
                matched_disease = crop_diseases[0]

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
        for item in CAMBODIAN_AGRI_KB:
            if any(k in q_norm for k in item["keywords"]):
                matched_kb_item = item
                break

    # Handle Crop Fertilizer / Nutrition Guidance
    target_crop_name = ""
    if matched_crop:
        target_crop_name = (matched_crop.name_kh or matched_crop.name) if is_khmer else (matched_crop.name or "Crop")
    elif matched_kb_item:
        target_crop_name = matched_kb_item["crop_km"] if is_khmer else matched_kb_item["crop_en"]

    if target_crop_name and is_fertilizer_query:
        if is_khmer:
            return (
                f"## 🌾 ការណែនាំបច្ចេកទេសជី និងអាហារូបត្ថម្ភសម្រាប់ដំណាំ {target_crop_name}\n\n"
                f"**ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព!** ខ្ញុំជា **AgriSystem AI (ម៉ូឌែល AGY V2.0.0)** បង្កើតឡើងដោយ **ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)**។ "
                f"ខាងក្រោមនេះជារូបមន្ត និងកាលវិភាគប្រើប្រាស់ជីប្រកបដោយប្រសិទ្ធភាពខ្ពស់៖\n\n"
                f"### 🌱 ១. ដំណាក់កាលលូតលាស់ដើម និងស្លឹក (Vegetative Stage)\n"
                f"- ប្រើប្រាស់ជីកំប៉ុសសរីរាង្គពុកផុយល្អលាយជាមួយផ្សិតទ្រីកូឌែរម៉ា (Trichoderma) ដើម្បីបំប៉នដី និងការពារជំងឺឫស។\n"
                f"- បន្ថែមជី NPK រូបមន្តតុល្យភាពដូចជា 15-15-15 ឬ 16-16-16 ឬជីអ៊ុយរ៉េ (46-0-0) ក្នុងបរិមាណសមស្របតាមអាយុកាលដំណាំ។\n\n"
                f"### 🌸 ២. ដំណាក់កាលត្រៀមផ្កា និងផ្លែ (Flowering & Fruiting)\n"
                f"- បន្ថយជាតិអាសូត (N) និងបង្កើនជីផូស្វ័រ និងប៉ូតាស្យូម ដូចជារូបមន្ត 12-12-17, 8-24-24 ឬ 0-0-60 ដើម្បីជួយឱ្យផ្កាកាន់ល្អ និងផ្លែធំផ្អែម មានទម្ងន់។\n"
                f"- បាញ់បន្ថែមជីកាល់ស្យូម-បូរ៉ុង (Calcium-Boron) ដើម្បីកាត់បន្ថយការជ្រុះផ្កា និងការប្រេះផ្លែ។\n\n"
                f"### 🧪 ៣. ការគ្រប់គ្រងគុណភាពដី (Soil Management)\n"
                f"- វាស់កម្រិត pH ដីឱ្យនៅចន្លោះ ៥.៥ ដល់ ៦.៥។ ប្រសិនបើដីជូរ (pH ទាប) ត្រូវរោយកំបោរកសិកម្ម (Dolomite) នៅដើមរដូវ។\n\n"
                f"⚠️ *ចំណាំ៖ ត្រូវស្រោចទឹកឱ្យបានគ្រប់គ្រាន់ក្រោយពេលដាក់ជីគីមីជានិច្ច ដើម្បីកុំឱ្យរលាកឫសដំណាំ។*"
            )
        else:
            return (
                f"## 🌾 Fertilizer & Nutrient Management for {target_crop_name}\n\n"
                f"**Greetings!** I am **AgriSystem AI (model: AGY V2.0.0)**, created and developed under the leadership of **Team Leader Mao Seavik**. "
                f"Here is your customized nutrition program:\n\n"
                f"### 🌱 1. Vegetative & Growth Stage\n"
                f"- Apply well-decomposed organic compost inoculated with *Trichoderma* to improve soil organic matter and suppress root pathogens.\n"
                f"- Side-dress with balanced NPK (15-15-15 or 16-16-16) or moderate nitrogen (Urea 46-0-0) calibrated to plant age.\n\n"
                f"### 🌸 2. Flowering & Fruit Development\n"
                f"- Shift to high phosphorus and potassium formulations (such as 12-12-17, 8-24-24, or 0-0-60) to stimulate flower retention, fruit size, and sweetness.\n"
                f"- Foliar spray micronutrients, specifically Calcium-Boron, to prevent blossom end rot and fruit splitting.\n\n"
                f"### 🧪 3. Soil pH and Root Zone Care\n"
                f"- Maintain soil pH in the optimal range of 5.8 - 6.5. Broadcast agricultural limestone (Dolomite) if soil acidity is elevated.\n\n"
                f"⚠️ *Reminder: Always irrigate thoroughly after granular fertilizer application to prevent osmotic root shock.*"
            )

    # Response from Knowledge Dictionary
    if matched_kb_item:
        if is_khmer:
            return (
                f"## 🌿 {matched_kb_item['title_km']}\n\n"
                f"**ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព!** ខ្ញុំជា **AgriSystem AI (ម៉ូឌែល AGY V2.0.0)** បង្កើតឡើងដោយ **ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)**។ "
                f"ខាងក្រោមនេះជាវិធានការដោះស្រាយ និងការព្យាបាលប្រកបដោយវិជ្ជាជីវៈ៖\n\n"
                f"### 🔍 ១. រោគសញ្ញាជាក់ស្តែង (Symptoms)\n"
                f"- {matched_kb_item['symptoms_km']}\n\n"
                f"### 💊 ២. វិធានការព្យាបាលបន្ទាន់ (Treatment)\n"
                f"- {matched_kb_item['treatment_km']}\n\n"
                f"### 🛡️ ៣. វិធានការបង្ការ និងថែទាំដី (Prevention & Soil Care)\n"
                f"- {matched_kb_item['prevention_km']}\n\n"
                f"⚠️ *ការណែនាំសុវត្ថិភាព៖ សូមពាក់ម៉ាស់ ស្រោមដៃ និងវ៉ែនតាការពារពេលប្រើប្រាស់ថ្នាំកសិកម្ម និងគោរពតាមរយៈពេលផ្អាកមុនប្រមូលផល (PHI)។*"
            )
        else:
            return (
                f"## 🌿 {matched_kb_item['title_en']}\n\n"
                f"**Greetings!** I am **AgriSystem AI (model: AGY V2.0.0)**, created and developed under the leadership of **Team Leader Mao Seavik**. "
                f"Here is the structured agronomic recommendation for your farm:\n\n"
                f"### 🔍 1. Symptoms & Diagnosis\n"
                f"- {matched_kb_item['symptoms_en']}\n\n"
                f"### 💊 2. Immediate Treatment Strategy\n"
                f"- {matched_kb_item['treatment_en']}\n\n"
                f"### 🛡️ 3. Long-Term Prevention & Field Care\n"
                f"- {matched_kb_item['prevention_en']}\n\n"
                f"⚠️ *Safety Reminder: Always wear personal protective equipment (PPE) when applying crop protection chemicals and strictly observe pre-harvest intervals (PHI).* "
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
            return (
                f"## 🌿 ការណែនាំបច្ចេកទេស៖ {d_name} លើដំណាំ {c_name}\n\n"
                f"**ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព!** ខ្ញុំជា **AgriSystem AI (ម៉ូឌែល AGY V2.0.0)** បង្កើតឡើងដោយ **ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)**។ "
                f"ខាងក្រោមនេះជាវិធានការដោះស្រាយ និងការព្យាបាលប្រកបដោយវិជ្ជាជីវៈ៖\n\n"
                f"### 🔍 ១. រោគសញ្ញា និងមូលហេតុបង្ក (Symptoms & Cause)\n"
                f"- **ការពិពណ៌នា**៖ {desc}\n"
                f"- **មូលហេតុចម្បង**៖ {cause}\n\n"
                f"### 💊 ២. វិធានការព្យាបាលបន្ទាន់ (Treatment)\n"
                f"- {treat}\n\n"
                f"### 🛡️ ៣. វិធានការបង្ការ និងថែទាំដី (Prevention & Soil Care)\n"
                f"- {prev}\n\n"
                f"⚠️ *ការណែនាំសុវត្ថិភាព៖ សូមពាក់ម៉ាស់ ស្រោមដៃ និងវ៉ែនតាការពារពេលប្រើប្រាស់ថ្នាំកសិកម្ម និងគោរពតាមរយៈពេលផ្អាកមុនប្រមូលផល (PHI)។*"
            )
        else:
            d_name = matched_disease.name
            c_name = matched_disease.crop.name if matched_disease.crop else "crop"
            desc = matched_disease.description or "Disease affecting crop vigor and yield."
            cause = matched_disease.cause_explanation or "Pathogen proliferation favored by excessive humidity or poor soil drainage."
            treat = matched_disease.treatment or "Apply registered fungicides at recommended label rates and prune heavily infected plant parts."
            prev = matched_disease.prevention_tips or "Maintain good field drainage, ensure balanced fertilization, and apply preventative bio-controls."
            return (
                f"## 🌿 Technical Guidance: {d_name} on {c_name}\n\n"
                f"**Greetings!** I am **AgriSystem AI (model: AGY V2.0.0)**, created and developed under the leadership of **Team Leader Mao Seavik**. "
                f"Here is the structured agronomic recommendation for your farm:\n\n"
                f"### 🔍 1. Symptoms & Root Cause\n"
                f"- **Overview**: {desc}\n"
                f"- **Root Cause**: {cause}\n\n"
                f"### 💊 2. Immediate Treatment Strategy\n"
                f"- {treat}\n\n"
                f"### 🛡️ 3. Long-Term Prevention & Field Care\n"
                f"- {prev}\n\n"
                f"⚠️ *Safety Reminder: Always wear personal protective equipment (PPE) when applying crop protection chemicals and strictly observe pre-harvest intervals (PHI).* "
            )

    if is_khmer:
        return (
            "ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព! ខ្ញុំជា **AgriSystem AI (ម៉ូឌែល AGY V2.0.0)** បង្កើតឡើងដោយ**ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ**។ "
            "ខ្ញុំបានកត់ត្រាសំណួររបស់អ្នករួចហើយ។ ដើម្បីជួយវិភាគឱ្យកាន់តែចំគោលដៅ និងផ្តល់រូបមន្តព្យាបាលបានត្រឹមត្រូវ សូមជម្រាបបន្ថែមអំពី៖\n"
            "១. ឈ្មោះដំណាំដែលកំពុងដាំ (ឧទាហរណ៍៖ ស្រូវ ទុរេន ដំឡូងមី ម្រេច បន្លែ...)\n"
            "២. រោគសញ្ញាជាក់ស្តែងលើស្លឹក ដើម ឬឫស\n"
            "៣. អាយុកាលដំណាំ និងស្ថានភាពដី ឬការស្រោចស្រព។\n"
            "ខ្ញុំត្រៀមខ្លួនជានិច្ចដើម្បីជួយដោះស្រាយជូនលោកអ្នក!"
        )
    return (
        "Hello! I am **AgriSystem AI (model: AGY V2.0.0)**, created and developed under the leadership of **Team Leader Mao Seavik**. "
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
                temperature=0.2,
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
    payload = {"data": [prompt, 0.2, max(32, min(int(max_new_tokens), 1024))]}

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
                "temperature": 0.2,
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
