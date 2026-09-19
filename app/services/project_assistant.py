# app/services/project_assistant.py

import os
from typing import Optional

from app.utils.i18n import get_current_language

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

DEFAULT_MODEL = "llama-3.3-70b-versatile"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


def _get_openai_model():
    from app.models.site_setting import SiteSetting
    try:
        db_model = SiteSetting.query.get("OPENAI_MODEL")
        if db_model and db_model.value.strip():
            return db_model.value.strip()
    except Exception:
        pass
    return os.getenv("OPENAI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def _get_ai_route():
    """Resolve the same admin AI route used by the expert assistant.

    The AI helper used to select the logged-in user's ``ai_model``. That
    bypassed the admin provider/key configuration and could make the helper
    try Gemini even when the application was configured for Groq or OpenAI.
    """
    from app.models.site_setting import SiteSetting

    provider = "groq"
    expert_override = False
    expert_model = ""
    provider_models = {
        "groq": DEFAULT_GROQ_MODEL,
        "openai": DEFAULT_OPENAI_MODEL,
        "gemini": DEFAULT_GEMINI_MODEL,
    }

    try:
        active_setting = SiteSetting.query.get("ACTIVE_PROVIDER")
        expert_provider_setting = SiteSetting.query.get("EXPERT_PROVIDER")
        expert_model_setting = SiteSetting.query.get("EXPERT_MODEL")

        active_provider = (active_setting.value or "").strip().lower() if active_setting else ""
        expert_provider = (
            (expert_provider_setting.value or "").strip().lower()
            if expert_provider_setting else ""
        )
        if expert_provider in provider_models:
            provider = expert_provider
            expert_override = True
        elif active_provider in provider_models:
            provider = active_provider

        if expert_model_setting and expert_model_setting.value:
            expert_model = expert_model_setting.value.strip()

        for key in provider_models:
            setting = SiteSetting.query.get(
                {"groq": "GROQ_MODEL", "openai": "OPENAI_MODEL", "gemini": "GEMINI_MODEL"}[key]
            )
            if setting and setting.value and setting.value.strip():
                provider_models[key] = setting.value.strip()

    except Exception:
        pass

    model = expert_model if expert_override and expert_model else provider_models[provider]
    if not model:
        model = _get_openai_model()
    return provider, model


PROJECT_CONTEXT = """You are helping users of the Integrated Agricultural Expert System web app.

Product overview:
- Roles: Admin, Expert, Farmer.
- Farmer features: Dashboard, New Diagnosis, Rule-Based Diagnosis, Diagnosis History, Ask an Expert (AI chat), Rule-Based Chat, Profile, Settings.
- Expert features: Dashboard, Pending Diagnoses, Review/Approve/Reject diagnoses, Disease management, Farmer Chats, Support Hub.
- Admin features: Dashboard, Users, Roles & Permissions, Crops/Diseases/Symptoms, Translations, Audit Logs.

Troubleshooting:
- If something is wrong (error page, missing data, unexpected behavior), ask for the exact steps + screenshot + time,
  then suggest using the "Contact Admin" form in the AI Helper.
- Never ask for or reveal passwords, API keys, SECRET_KEY, or private user data.

Runtime notes:
- This project runs on Flask (Python) with SQLAlchemy and Flask-Migrate.
- Typical local run: set SECRET_KEY and DATABASE_URL, then run run.py.
"""

SYSTEM_KEYWORDS = (
    "dashboard", "menu", "sidebar", "navigation", "route", "page", "screen",
    "login", "sign in", "register", "account", "profile", "settings",
    "diagnosis", "diagnosis history", "new diagnosis", "rule-based", "ask expert", "chat",
    "button", "click", "submit", "form", "search", "filter", "export",
    "admin", "expert", "farmer", "permission", "role", "support", "contact admin",
)

AGRI_KEYWORDS = (
    "crop", "crops", "disease", "diseases", "symptom", "symptoms",
    "treat", "treatment", "pesticide", "spray", "fertilizer", "fungus", "fungal",
    "bacteria", "virus", "pest", "pests", "insect", "insects", "soil",
    "weather", "irrigation", "yield", "control", "prevent", "cure",
)


def _looks_like_system_query(message: str) -> bool:
    msg = (message or "").lower()
    return any(k in msg for k in SYSTEM_KEYWORDS)


def _looks_like_agri_query(message: str) -> bool:
    msg = (message or "").lower()
    return any(k in msg for k in AGRI_KEYWORDS)


def _system_only_reply(lang: str) -> str:
    if lang == "km":
        return (
            "ខ្ញុំអាចជួយបានតែការប្រើប្រាស់ប្រព័ន្ធនេះប៉ុណ្ណោះ។ "
            "សម្រាប់ការវិនិច្ឆ័យដំណាំ សូមប្រើ \"Ask Expert\" ឬ \"Rule-Based Diagnosis\" ក្នុងប្រព័ន្ធ។"
        )
    return (
        "I can only help with how to use this system. "
        "For crop diagnosis, please use Ask Expert or Rule-Based Diagnosis inside the app."
    )


_pa_cached_openai_client = None
_pa_cached_openai_key = ""

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

def _get_openai_client(provider=None):
    global _pa_cached_openai_client, _pa_cached_openai_key
    if OpenAI is None:
        return None

    from app.models.site_setting import SiteSetting
    keys_list = []
    base_url = None
    try:
        if not provider:
            provider, _ = _get_ai_route()
        db_groq = SiteSetting.query.get("API_KEY_GROQ")
        db_openai = SiteSetting.query.get("API_KEY_OPENAI")

        if provider == "groq" and db_groq and db_groq.value.strip():
            keys_list = [k.strip() for k in db_groq.value.split(",") if k.strip()]
            base_url = "https://api.groq.com/openai/v1"
        elif provider == "openai" and db_openai and db_openai.value.strip():
            keys_list = [k.strip() for k in db_openai.value.split(",") if k.strip()]
            base_url = None
        else:
            # Fallback if the chosen provider has no keys, try the other
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
        if env_key and not env_key.startswith("sk-your-") and "your-api-key" not in env_key:
            keys_list = [env_key]
        base_url = os.getenv("OPENAI_BASE_URL", "").strip() or None

    keys_list = [
        key for key in keys_list
        if key and not key.startswith("sk-your-") and "your-api-key" not in key
    ]
    if not keys_list:
        return None

    cache_key = f"{','.join(keys_list)}|{base_url or ''}"
    if _pa_cached_openai_client is None or _pa_cached_openai_key != cache_key:
        clients = [OpenAI(api_key=k, base_url=base_url) for k in keys_list]
        _pa_cached_openai_client = MultiKeyOpenAI(clients)
        _pa_cached_openai_key = cache_key
    return _pa_cached_openai_client

def _get_gemini_client():
    """Build a Gemini client from the admin key pool, with user fallback."""
    if not genai:
        return None

    keys = []
    from app.models.site_setting import SiteSetting
    try:
        db_gemini = SiteSetting.query.get("API_KEY_GEMINI")
        if db_gemini and db_gemini.value.strip():
            keys = [key.strip() for key in db_gemini.value.split(",") if key.strip()]
    except Exception:
        pass

    if not keys and current_user and current_user.is_authenticated:
        user_key = getattr(current_user, "ai_api_key", None)
        if user_key:
            keys = [key.strip() for key in user_key.split(",") if key.strip()]

    if not keys:
        env_key = os.getenv("GEMINI_API_KEY", "").strip()
        if env_key:
            keys = [env_key]

    if keys:
        import random
        return genai.Client(api_key=random.choice(keys))

    return None


def _fallback_reply(user_message: str, *, user_role: str, page: str, lang: str) -> str:
    msg = (user_message or "").strip()
    msg_l = msg.lower()
    page_l = (page or "").lower()

    if _looks_like_agri_query(msg_l) and not _looks_like_system_query(msg_l):
        return _system_only_reply(lang)

    # Khmer fallback (short + practical). Keep simple; we don't have full i18n here.
    if lang == "km":
        if any(k in msg_l for k in ("login", "sign in", "register", "create account")):
            return (
                "សម្រាប់ចូលប្រើប្រាស់ (Login) សូមបញ្ចូល Username/Email និង Password រួចចុច Login។ "
                "បើមិនទាន់មានគណនី សូមចុច Create an account។"
            )
        if any(k in msg_l for k in ("menu", "sidebar", "navigation")):
            return (
                "លើទូរសព្ទ សូមចុចប៊ូតុងម៉ឺនុយ ដើម្បីបើក/បិទ Sidebar។ "
                "អ្នកអាចអូស (drag) ប៊ូតុង AI Helper ទៅទីតាំងដែលមិនរាំងការចុចបាន។"
            )
        if any(k in msg_l for k in ("error", "bug", "wrong", "issue", "problem")):
            return (
                "បើមានបញ្ហា សូមពណ៌នាជំហានដែលបានធ្វើ + សារកំហុស (បើមាន) + ទំព័រដែលកំពុងប្រើ។ "
                "អ្នកអាចប្រើ Contact Admin នៅក្នុង AI Helper ដើម្បីផ្ញើទៅអ្នកគ្រប់គ្រង។"
            )
        return (
            "ខ្ញុំអាចជួយពន្យល់អំពីរបៀបប្រើប្រាស់ប្រព័ន្ធ (Farmer/Expert) និងការដោះស្រាយបញ្ហាមូលដ្ឋាន។ "
            "បើអ្នកចង់ផ្ញើទៅ Admin សូមបើក AI Helper > Contact Admin។"
        )

    # English fallback.
    if any(k in msg_l for k in ("login", "sign in", "register", "create account")):
        return (
            "To sign in: enter your Username/Email and Password, then tap Login. "
            "If you don't have an account yet, tap Create an account."
        )

    if "/farmer/chat" in page_l or "ask expert" in msg_l or "chat" in msg_l:
        return (
            "Ask an Expert tips:\n"
            "1) Describe Crop + Symptoms + How long + Location.\n"
            "2) On mobile, type your message and tap Send (Enter adds a new line).\n"
            "3) If the helper button blocks something, drag it to another corner or press Reset in the helper panel."
        )

    if any(k in msg_l for k in ("menu", "sidebar", "navigation", "routes")):
        return (
            "On mobile, use the menu button to open/close the sidebar. "
            "You can drag the AI Helper button to any clear spot so it doesn't block buttons."
        )

    if any(k in msg_l for k in ("error", "bug", "wrong", "issue", "problem", "not working")):
        return (
            "If something looks wrong:\n"
            "1) Tell me the page and the exact steps.\n"
            "2) Copy any error text.\n"
            "3) Use AI Helper > Contact Admin to send it to the admin team."
        )

    return (
        "I can help with navigation, features, and basic troubleshooting for this system (Farmer/Expert/Admin flows). "
        "If you hit a bug, use AI Helper > Contact Admin and include what you were doing."
    )


def generate_project_reply(user_message: str, *, user_role: str, page: str = "") -> Optional[str]:

    lang = get_current_language()
    if _looks_like_agri_query(user_message) and not _looks_like_system_query(user_message):
        return _system_only_reply(lang)

    provider, model_name = _get_ai_route()
    system_prompt = (
        "You are a helpful AI assistant for this web application. "
        "Answer questions about how to use the system, navigation, features, and basic troubleshooting. "
        "If the user asks about crops, diseases, treatments, or anything outside the system, "
        "politely refuse and point them to Ask Expert or Rule-Based Diagnosis. "
        "If the user asks for something you cannot know, ask a clarifying question or suggest contacting admin. "
        "Do not provide secrets, credentials, or private data."
    )
    if lang == "km":
        system_prompt += " Respond in Khmer."

    user_prompt = (
        f"User role: {user_role}\n"
        f"Current page: {page or '-'}\n\n"
        f"Question:\n{user_message}\n\n"
        f"Project context:\n{PROJECT_CONTEXT}\n\n"
        "Reply with practical, step-by-step guidance when relevant."
    )

    try:
        if provider == "gemini":
            client = _get_gemini_client()
            if not client:
                return _fallback_reply(user_message, user_role=user_role, page=page, lang=lang)
            response = client.models.generate_content(
                model=model_name,
                contents=[system_prompt, user_prompt],
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=1000,
                ),
            )
            content = response.text if response else None
        else:
            client = _get_openai_client(provider)
            if not client:
                return _fallback_reply(user_message, user_role=user_role, page=page, lang=lang)
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=1000,
            )
            content = response.choices[0].message.content if response.choices and response.choices[0].message else None
    except Exception:
        current_app.logger.exception("AI helper request failed")
        return _fallback_reply(user_message, user_role=user_role, page=page, lang=lang)

    return content.strip() if content else _fallback_reply(user_message, user_role=user_role, page=page, lang=lang)
