"""Application helper backed only by the owner's self-trained AI.

There is intentionally no OpenAI, Groq, Gemini, or other commercial-provider
fallback. If the custom endpoint is unavailable, a small local response keeps
navigation/support guidance usable without impersonating model output.
"""

from __future__ import annotations

from typing import Optional

from flask import current_app

from app.utils.i18n import get_current_language


PROJECT_CONTEXT = """Integrated Agricultural Expert System application help.
Roles: Admin, Expert, Farmer.
Farmer features: Dashboard, Diagnosis, Rule-Based Diagnosis, History, Ask Expert, Profile, Settings.
Expert features: Dashboard, Diagnosis review, Disease management, Farmer Chats, Support Hub.
Admin features: Dashboard, Users, Roles, agricultural knowledge, Translations, Audit Logs, Support.
Never reveal credentials, API keys, private user data, or internal secrets.
Give short, practical, step-by-step application guidance.
"""

SYSTEM_KEYWORDS = (
    "dashboard", "menu", "sidebar", "navigation", "route", "page", "screen",
    "login", "sign in", "register", "account", "profile", "settings",
    "diagnosis", "history", "ask expert", "chat", "button", "click",
    "submit", "form", "admin", "expert", "farmer", "permission", "support",
)

AGRI_KEYWORDS = (
    "crop", "disease", "symptom", "treatment", "pesticide", "fertilizer",
    "fungus", "bacteria", "virus", "pest", "soil", "irrigation", "yield",
)


def _looks_like_system_query(message: str) -> bool:
    message = (message or "").lower()
    return any(keyword in message for keyword in SYSTEM_KEYWORDS)


def _looks_like_agri_query(message: str) -> bool:
    message = (message or "").lower()
    return any(keyword in message for keyword in AGRI_KEYWORDS)


def _fallback_reply(message: str, lang: str) -> str:
    message = (message or "").lower()
    if _looks_like_agri_query(message) and not _looks_like_system_query(message):
        if lang == "km":
            return "សម្រាប់សំណួរកសិកម្ម សូមប្រើ Ask Expert ឬ Rule-Based Diagnosis។"
        return "For agricultural questions, please use Ask Expert or Rule-Based Diagnosis."
    if lang == "km":
        return (
            "ខ្ញុំអាចជួយពន្យល់របៀបប្រើប្រព័ន្ធនេះ។ សូមប្រាប់ទំព័រ "
            "និងអ្វីដែលអ្នកចង់ធ្វើ ឬប្រើ AI Helper > Contact Admin ប្រសិនបើមានបញ្ហា។"
        )
    return (
        "I can help with this application's navigation and features. Tell me the page "
        "and what you want to do, or use AI Helper > Contact Admin if something is broken."
    )


def generate_project_reply(
    user_message: str,
    *,
    user_role: str,
    page: str = "",
) -> Optional[str]:
    """Generate application help with the active self-trained model only."""
    lang = get_current_language()
    context = (
        f"{PROJECT_CONTEXT}\nUser role: {user_role or '-'}\n"
        f"Current page: {page or '-'}\n"
        "Answer only about using this application. Redirect agricultural questions to Ask Expert."
    )
    try:
        from app.services.ai_expert_service import generate_reply

        reply = generate_reply(user_message, context=context, language=lang)
        if reply:
            return reply.strip()
    except Exception as exc:
        current_app.logger.warning("Self-trained application helper unavailable: %s", exc)
    return _fallback_reply(user_message, lang)
