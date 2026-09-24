"""Safe orchestration for the agricultural assistant.

The language model remains responsible for explaining information. This
module decides which trusted application tools should provide that
information first. It deliberately does not allow the model to write to the
database, prescribe an unverified chemical dose, or claim that it inspected a
photo it cannot receive.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Iterable, Optional


@dataclass(frozen=True)
class AgentPlan:
    """Deterministic route selected before the language model is called."""

    intent: str
    tools: tuple[str, ...]
    needs_location: bool = False
    has_image: bool = False


def _has_any(text: str, phrases: Iterable[str]) -> bool:
    return any(phrase in text for phrase in phrases)


def plan_request(
    message: str,
    *,
    language: str = "en",
    has_image: bool = False,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> AgentPlan:
    """Choose trusted tools using English and Khmer intent signals.

    This is intentionally deterministic. The model may explain the tool
    results, but it cannot choose arbitrary Python functions or mutate data.
    """

    text = (message or "").strip().lower()
    weather_terms = (
        "weather", "forecast", "rain", "temperature", "wind", "flood",
        "drought", "អាកាសធាតុ", "ភ្លៀង", "សីតុណ្ហភាព", "ខ្យល់",
        "ទឹកជំនន់", "រាំងស្ងួត",
    )
    diagnosis_terms = (
        "diagnos", "disease", "pest", "symptom", "leaf", "spots", "fungus",
        "ជំងឺ", "សត្វល្អិត", "រោគសញ្ញា", "ស្លឹក", "ចំណុច", "ផ្សិត",
    )
    action_terms = (
        "remind", "reminder", "create task", "set task", "send alert",
        "រំលឹក", "បង្កើតភារកិច្ច", "ជូនដំណឹង",
    )
    greeting_terms = (
        "hi", "hello", "hey", "សួស្តី", "សួរស្តី", "ជំរាបសួរ",
    )

    is_greeting = text in greeting_terms or any(
        text.startswith(term + " ") for term in greeting_terms if " " not in term
    )
    if is_greeting and len(text) <= 40:
        intent = "greeting"
        tools: tuple[str, ...] = ()
    elif _has_any(text, weather_terms):
        intent = "weather_advice"
        tools = ("weather", "knowledge_base")
    elif _has_any(text, diagnosis_terms) or has_image:
        intent = "crop_health"
        tools = ("knowledge_base", "diagnosis_guidance")
    elif _has_any(text, action_terms):
        intent = "action_request"
        tools = ("knowledge_base", "confirmation_gate")
    else:
        intent = "agricultural_advice"
        tools = ("knowledge_base",)

    has_coordinates = latitude is not None and longitude is not None
    return AgentPlan(
        intent=intent,
        tools=tools,
        needs_location="weather" in tools and not has_coordinates,
        has_image=has_image,
    )


def _format_weather(payload: dict, source: str, language: str) -> str:
    current = payload.get("current") or {}
    analytics = payload.get("analytics") or {}
    recommendations = payload.get("recommendations") or []
    labels = {
        "en": ("Weather source", "Current", "Rain next 24h", "Weekly rain", "Field advice"),
        "km": ("ប្រភពអាកាសធាតុ", "បច្ចុប្បន្ន", "ភ្លៀង ២៤ម៉ោងខាងមុខ", "ភ្លៀងប្រចាំសប្តាហ៍", "អនុសាសន៍សម្រាប់ចម្ការ"),
    }
    source_label, current_label, rain_label, weekly_label, advice_label = labels.get(language, labels["en"])

    def value(key: str) -> str:
        raw = current.get(key)
        return "unknown" if raw is None else str(raw)

    lines = [
        f"{source_label}: {source}",
        f"{current_label}: {value('condition')}; {value('temp_c')} C; humidity {value('humidity_pct')}%",
        f"{rain_label}: {analytics.get('rain_next_24h_mm', 'unknown')} mm",
        f"{weekly_label}: {analytics.get('weekly_rain_mm', 'unknown')} mm",
    ]
    if recommendations:
        lines.append(f"{advice_label}: " + " | ".join(str(item) for item in recommendations[:3]))
    return "\n".join(lines)


def _weather_tool(latitude: float, longitude: float, language: str) -> str:
    """Read the existing cached weather service without creating a new provider."""

    try:
        from app.blueprints.weather_intelligence.routes import _get_service

        payload, source = _get_service().get_weather_summary(
            latitude=float(latitude),
            longitude=float(longitude),
            lang="km" if language == "km" else "en",
        )
        return _format_weather(payload, source, language)
    except Exception:
        # Weather is helpful but never allowed to break agricultural chat.
        return "Weather tool unavailable; do not invent current weather data."


def build_agent_context(
    message: str,
    *,
    language: str = "en",
    conversation: Optional[Iterable[tuple[str, str]]] = None,
    has_image: bool = False,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> tuple[str, AgentPlan]:
    """Run trusted tools and return bounded context for the model."""

    plan = plan_request(
        message,
        language=language,
        has_image=has_image,
        latitude=latitude,
        longitude=longitude,
    )
    sections = [
        f"Agent intent: {plan.intent}",
        "Trusted tools selected: " + (", ".join(plan.tools) if plan.tools else "none"),
        "Safety policy: the rule/database diagnosis is authoritative. Do not invent a diagnosis, pesticide dose, guarantee, or live weather value.",
    ]

    if plan.needs_location:
        if language == "km":
            sections.append("Location is required for live weather. Ask the farmer to allow location access or provide a province/location before giving weather-specific advice.")
        else:
            sections.append("Location is required for live weather. Ask the farmer to allow location access or provide a province/location before giving weather-specific advice.")
    elif "weather" in plan.tools and latitude is not None and longitude is not None:
        sections.append("Weather tool result:\n" + _weather_tool(latitude, longitude, language))

    try:
        # Import lazily to avoid the existing assistant module importing itself
        # while Flask is registering services.
        from app.services.openai_assistant import _build_kb_context

        knowledge_context, crop = _build_kb_context(message)
        sections.append("Knowledge-base tool result:")
        sections.append(knowledge_context or "No matching knowledge-base context was found.")
        if crop:
            sections.append(f"Matched crop record: {crop.name}")
    except Exception:
        sections.append("Knowledge-base tool unavailable; say when the available information is insufficient.")

    if plan.intent == "crop_health":
        sections.append(
            "Diagnosis workflow: explain possible causes and evidence, then direct the farmer to the app's Diagnose page for the authoritative rule-based result."
        )
    if plan.intent == "action_request":
        sections.append(
            "Action workflow: do not create reminders, alerts, or database changes in this chat yet. Ask for explicit confirmation and required timing/details."
        )
    if has_image:
        sections.append(
            "Image limitation: this text model has not received image pixels. Never claim to have visually inspected the attachment; direct the farmer to the dedicated diagnosis workflow."
        )

    history = []
    for sender, text in list(conversation or [])[-6:]:
        clean = re.sub(r"\s+", " ", str(text or "")).strip()
        if clean:
            history.append(f"{sender}: {clean[:600]}")
    if history:
        sections.append("Recent conversation context:\n" + "\n".join(history))

    # Keep the context under the remote client's 4,000-character safety bound.
    return "\n\n".join(sections)[:3900], plan


def agent_metadata(plan: AgentPlan) -> dict[str, object]:
    """Return non-secret metadata useful for logs and future UI badges."""

    return {
        "intent": plan.intent,
        "tools": list(plan.tools),
        "needs_location": plan.needs_location,
        "has_image": plan.has_image,
    }
