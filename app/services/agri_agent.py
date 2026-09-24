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
    identity_terms = (
        "who are you", "who created you", "who made you", "who developed you",
        "what is your name", "what is your model", "model name", "who is your leader",
        "team leader", "who is mao seavik", "about you",
        "តើអ្នកជាអ្នកណា", "អ្នកជាអ្នកណា", "តើអ្នកជាអ្វី", "អ្នកជាអ្វី", "អ្នកណាបង្កើត",
        "នរណាបង្កើត", "តើអ្នកណាបង្កើតអ្នក", "តើនរណាបង្កើតអ្នក", "តើម៉ូឌែលឈ្មោះអ្វី",
        "ម៉ូឌែលឈ្មោះអ្វី", "តើ ai នេះឈ្មោះអ្វី", "ប្រធានក្រុម", "ម៉ៅ សៀវអ៊ិ", "mao seavik",
    )
    greeting_terms = (
        "hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening",
        "how are you", "សួស្តី", "សួរស្តី", "ជំរាបសួរ", "ជំរាបសួរបង", "សួស្តីបង", "សួស្តីប្អូន",
        "អរុណសួស្តី", "ទិវាសួស្តី", "សាយណ្ហសួស្តី", "សុខសប្បាយជាទេ", "សុខសប្បាយ",
        "អ្នកសុខសប្បាយទេ",
    )

    clean_text = re.sub(r"[!?,.។៕\s]+", " ", text).strip()
    is_greeting = any(
        clean_text == term
        or clean_text.startswith(term + " ")
        or (term in {"សួស្តី", "សួរស្តី", "ជំរាបសួរ"} and text.startswith(term) and len(text) <= len(term) + 20)
        for term in greeting_terms
    )
    if _has_any(text, identity_terms):
        intent = "agent_identity"
        tools: tuple[str, ...] = ()
    elif is_greeting and len(clean_text) <= 50:
        intent = "greeting"
        tools = ()
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
    if language == "km":
        sections = [
            f"គោលបំណងសំណួរ៖ {plan.intent}",
            "គោលការណ៍សុវត្ថិភាព៖ ផ្អែកលើចំណេះដឹងដែលបានផ្ទៀងផ្ទាត់។ មិនត្រូវបង្កើតកម្រិតថ្នាំគីមី ការធ្វើរោគវិនិច្ឆ័យ ឬទិន្នន័យអាកាសធាតុដោយគ្មានមូលដ្ឋានឡើយ។",
        ]
        if plan.needs_location:
            sections.append("ត្រូវការព័ត៌មានទីតាំងជាក់លាក់ដើម្បីផ្តល់ព័ត៌មានអាកាសធាតុ។ សូមស្នើឱ្យកសិករផ្តល់ទីតាំងឬខេត្ត។")
        elif "weather" in plan.tools and latitude is not None and longitude is not None:
            sections.append("លទ្ធផលអាកាសធាតុ៖\n" + _weather_tool(latitude, longitude, language))

        if plan.intent not in {"greeting", "agent_identity"}:
            try:
                from app.services.openai_assistant import _build_kb_context
                knowledge_context, crop = _build_kb_context(message)
                sections.append("ព័ត៌មានពីមូលដ្ឋានចំណេះដឹងកសិកម្ម៖")
                sections.append(knowledge_context or "រកមិនឃើញព័ត៌មានដែលត្រូវគ្នានៅក្នុងមូលដ្ឋានចំណេះដឹងឡើយ។")
                if crop:
                    crop_title = getattr(crop, "name_kh", None) or crop.name
                    sections.append(f"ដំណាំដែលត្រូវគ្នា៖ {crop_title}")
            except Exception:
                sections.append("ចំណាំ៖ មិនមានទិន្នន័យជំងឺក្នុងស្រុកដែលត្រូវគ្នានឹងសំណួរនេះទេ។ សូមប្រើប្រាស់ចំណេះដឹងជំនាញកសិកម្មរបស់អ្នកដើម្បីផ្តល់ដំបូន្មានបច្ចេកទេសដាំដុះ និងការថែទាំដំណាំយ៉ាងពេញលេញជូនកសិករ។")

        if plan.intent == "greeting":
            sections.append(
                "គោលការណ៍ឆ្លើយតបការស្វាគមន៍ (Greeting Policy)៖\n"
                "កសិករកំពុងស្វាគមន៍ ឬសួរសួស្តី (Hello / Greetings)។ "
                "សូមឆ្លើយតបការស្វាគមន៍ដោយភាពរាក់ទាក់ កក់ក្តៅ និងគួរសមបំផុតជាភាសាខ្មែរ ហើយសួរបញ្ជាក់ថាតើមានបញ្ហាដំណាំ ការដាំដុះ ឬជំងឺរុក្ខជាតិអ្វីដែលកសិករចង់ឱ្យជួយប្រឹក្សាដែរឬទេ។ មិនត្រូវណែនាំប្រវត្តិខ្លួនឯង ឬអ្នកបង្កើតឡើយ លើកលែងតែកសិករសួរអំពីអត្តសញ្ញាណ AI ផ្ទាល់។"
            )
        if plan.intent == "agent_identity":
            sections.append(
                "ព័ត៌មានអត្តសញ្ញាណ AI៖\n"
                "- ឈ្មោះ AI៖ AgriSystem AI\n"
                "- ឈ្មោះម៉ូឌែល៖ AGY V2.0.0\n"
                "- អ្នកបង្កើត៖ បង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)\n"
                "- តួនាទី៖ ជំនួយការកសិកម្មឆ្លាតវៃ ផ្តល់ការប្រឹក្សាអំពីដំណាំ ជំងឺដំណាំ ដី និងការព្យាបាលប្រកបដោយសុវត្ថិភាព។\n"
                "សូមបញ្ជាក់ដោយច្បាស់លាស់ថា AI នេះមានម៉ូឌែលឈ្មោះ AGY V2.0.0 បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។"
            )
        if plan.intent in {"crop_health", "agricultural_advice"}:
            sections.append(
                "ប្រសិនបើកសិករសួរអំពីជំងឺទាំងអស់លើដំណាំ ឬសួរថាតើដំណាំមានជំងឺអ្វីខ្លះ សូមរៀបរាប់ឈ្មោះជំងឺទាំងអស់ដែលបានកត់ត្រាក្នុងមូលដ្ឋានចំណេះដឹងជាចំណុចៗ ព្រមទាំងរោគសញ្ញាសង្ខេប និងវិធីព្យាបាលចម្បងៗជូនកសិករដោយពេញលេញ។\n"
                "ដំណើរការវិនិច្ឆ័យ៖ សូមពន្យល់ពីមូលហេតុនិងរោគសញ្ញាដែលអាចកើតមាន រួចណែនាំកសិករឱ្យប្រើទំព័រធ្វើរោគវិនិច្ឆ័យក្នុងប្រព័ន្ធដើម្បីទទួលបានលទ្ធផលជាក់លាក់។"
            )
        if plan.intent == "action_request":
            sections.append(
                "សំណើរសកម្មភាព៖ កុំទាន់បង្កើតការរំលឹក ឬការកែប្រែទិន្នន័យ។ សូមសួរការបញ្ជាក់បន្ថែមពីពេលវេលានិងព័ត៌មានលម្អិតពីកសិករ។"
            )
        if has_image:
            sections.append(
                "រូបភាពត្រូវបានភ្ជាប់មកជាមួយ៖ ប្រសិនបើម៉ូឌែលរបស់អ្នកគាំទ្រការពិនិត្យរូបភាព (Vision) សូមពិនិត្យមើលរោគសញ្ញាជាក់ស្តែងលើស្លឹក ដើម ឬផ្លែ ដើម្បីជួយក្នុងការវិភាគជំងឺ និងផ្តល់ដំបូន្មានព្យាបាលសមស្រប។"
            )
    else:
        sections = [
            f"Agent intent: {plan.intent}",
            "Trusted tools selected: " + (", ".join(plan.tools) if plan.tools else "none"),
            "Safety policy: the rule/database diagnosis is authoritative. Do not invent a diagnosis, pesticide dose, guarantee, or live weather value.",
        ]

        if plan.needs_location:
            sections.append("Location is required for live weather. Ask the farmer to allow location access or provide a province/location before giving weather-specific advice.")
        elif "weather" in plan.tools and latitude is not None and longitude is not None:
            sections.append("Weather tool result:\n" + _weather_tool(latitude, longitude, language))

        if plan.intent not in {"greeting", "agent_identity"}:
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
                sections.append("Note: No specific local database records matched; provide complete agronomic guidance using your expert knowledge base.")

        if plan.intent == "greeting":
            sections.append(
                "Greeting Policy:\n"
                "The farmer is greeting you (Hello / Hi). Respond warmly, politely, and helpfully. Ask how you can assist with their crops or farming today. Do not recite your self-introduction or creator information unless specifically asked about the AI's identity."
            )
        if plan.intent == "agent_identity":
            sections.append(
                "AI Identity Information:\n"
                "- AI Name: AgriSystem AI\n"
                "- Model Name: AGY V2.0.0\n"
                "- Creator: Created and developed by Team Leader Mao Seavik\n"
                "- Role: Smart agricultural assistant providing advice on crops, plant diseases, soil, and safe farming practices.\n"
                "Please state clearly that you are AgriSystem AI (model: AGY V2.0.0), created by Team Leader Mao Seavik."
            )
        if plan.intent in {"crop_health", "agricultural_advice"}:
            sections.append(
                "If the farmer asks for all diseases affecting a crop or what diseases a crop has, list all the diseases provided in the knowledge-base context with their names, brief symptoms, and main treatments.\n"
                "Diagnosis workflow: explain possible causes and evidence, then direct the farmer to the app's Diagnose page for the authoritative rule-based result."
            )
        if plan.intent == "action_request":
            sections.append(
                "Action workflow: do not create reminders, alerts, or database changes in this chat yet. Ask for explicit confirmation and required timing/details."
            )
        if has_image:
            sections.append(
                "Image attached: A crop image has been provided. The current self-trained endpoint is text-only, so do not invent visual findings. Ask the farmer to describe visible symptoms or use the rule-based image review flow, then advise safe management steps."
            )

    history = []
    for sender, text in list(conversation or [])[-6:]:
        clean = re.sub(r"\s+", " ", str(text or "")).strip()
        if clean:
            history.append(f"{sender}: {clean[:600]}")
    if history:
        sections.append("Recent conversation context:\n" + "\n".join(history))

    # Keep the context under the remote client's expanded 8,000-character
    # safety bound while preserving enough disease and prevention details.
    return "\n\n".join(sections)[:7800], plan


def agent_metadata(plan: AgentPlan) -> dict[str, object]:
    """Return non-secret metadata useful for logs and future UI badges."""

    return {
        "intent": plan.intent,
        "tools": list(plan.tools),
        "needs_location": plan.needs_location,
        "has_image": plan.has_image,
    }
