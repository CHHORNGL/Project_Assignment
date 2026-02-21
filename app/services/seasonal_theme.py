from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterable

import requests


CALENDARIFIC_URL = "https://calendarific.com/api/v2/holidays"
NAGER_URL_TEMPLATE = "https://date.nager.at/api/v3/PublicHolidays/{year}/{country}"
ALLOWED_PROVIDERS = {"auto", "calendarific", "nager"}
BUILTIN_EVENTS = {
    "KH": [
        ("Khmer New Year", 4, 14, "Traditional Cambodian new year celebration."),
        ("Water Festival", 11, 23, "Bon Om Touk / Water Festival."),
        ("Pchum Ben", 10, 1, "Ancestors remembrance period."),
    ],
    "US": [
        ("New Year's Day", 1, 1, "New year celebration."),
        ("Independence Day", 7, 4, "National day of the United States."),
        ("Christmas Day", 12, 25, "Christmas celebration."),
    ],
}


@dataclass
class SeasonalThemeError(Exception):
    message: str

    def __str__(self):
        return self.message


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    if "T" in text:
        text = text.split("T", 1)[0]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def _normalize_country(country: str | None) -> str:
    value = (country or "KH").strip().upper()
    if len(value) != 2 or not value.isalpha():
        raise SeasonalThemeError("Country must be a 2-letter ISO code, e.g. KH or US.")
    return value


def _normalize_provider(provider: str | None) -> str:
    value = (provider or "auto").strip().lower()
    if value not in ALLOWED_PROVIDERS:
        raise SeasonalThemeError("Unsupported provider. Use auto, calendarific, or nager.")
    return value


def _normalize_year(year: int | str | None) -> int:
    try:
        value = int(year) if year is not None else date.today().year
    except (TypeError, ValueError) as exc:
        raise SeasonalThemeError("Invalid year value.") from exc
    if value < 2000 or value > 2100:
        raise SeasonalThemeError("Year out of range.")
    return value


def _fetch_calendarific(country: str, year: int, api_key: str, timeout_seconds: int) -> list[dict]:
    if not api_key:
        raise SeasonalThemeError("Calendarific API key is missing.")

    response = requests.get(
        CALENDARIFIC_URL,
        params={
            "api_key": api_key,
            "country": country,
            "year": year,
            "type": "national,religious,observance,local",
        },
        timeout=max(2, min(int(timeout_seconds), 20)),
    )
    if response.status_code >= 400:
        raise SeasonalThemeError(f"Calendarific API returned {response.status_code}.")

    payload = response.json() if response.content else {}
    holidays = (((payload or {}).get("response") or {}).get("holidays") or [])
    events = []
    for row in holidays:
        day = _parse_date((((row or {}).get("date") or {}).get("iso")))
        if not day:
            continue
        events.append(
            {
                "name": str((row or {}).get("name") or "").strip() or "Event",
                "description": str((row or {}).get("description") or "").strip() or None,
                "date": day,
                "source": "calendarific",
                "types": [str(item).strip() for item in ((row or {}).get("type") or []) if str(item).strip()],
            }
        )
    return events


def _fetch_nager(country: str, year: int, timeout_seconds: int) -> list[dict]:
    response = requests.get(
        NAGER_URL_TEMPLATE.format(year=year, country=country),
        timeout=max(2, min(int(timeout_seconds), 20)),
    )
    if response.status_code >= 400:
        raise SeasonalThemeError(f"Nager API returned {response.status_code}.")

    payload = response.json() if response.content else []
    events = []
    for row in payload or []:
        day = _parse_date((row or {}).get("date"))
        if not day:
            continue
        events.append(
            {
                "name": str((row or {}).get("localName") or (row or {}).get("name") or "").strip() or "Event",
                "description": None,
                "date": day,
                "source": "nager",
                "types": [str(item).strip() for item in ((row or {}).get("types") or []) if str(item).strip()],
            }
        )
    return events


def _builtin_events(country: str, year: int) -> list[dict]:
    rows = BUILTIN_EVENTS.get(country.upper(), [])
    result = []
    for name, month, day, description in rows:
        try:
            event_day = date(year, int(month), int(day))
        except ValueError:
            continue
        result.append(
            {
                "name": name,
                "description": description,
                "date": event_day,
                "source": "builtin",
                "types": ["seasonal"],
            }
        )
    return result


def fetch_seasonal_events(
    country: str | None,
    year: int | str | None,
    provider: str | None = "auto",
    api_key: str | None = None,
    timeout_seconds: int = 8,
) -> list[dict]:
    normalized_country = _normalize_country(country)
    normalized_year = _normalize_year(year)
    normalized_provider = _normalize_provider(provider)
    errors: list[str] = []

    if normalized_provider in {"auto", "calendarific"}:
        try:
            rows = _fetch_calendarific(
                country=normalized_country,
                year=normalized_year,
                api_key=(api_key or "").strip(),
                timeout_seconds=timeout_seconds,
            )
            if rows:
                return rows
            errors.append("Calendarific returned no events.")
        except Exception as exc:  # noqa: BLE001
            errors.append(str(exc))
            if normalized_provider == "calendarific":
                raise SeasonalThemeError(str(exc)) from exc

    if normalized_provider in {"auto", "nager"}:
        try:
            rows = _fetch_nager(
                country=normalized_country,
                year=normalized_year,
                timeout_seconds=timeout_seconds,
            )
            if rows:
                return rows
            errors.append("Nager returned no events.")
        except Exception as exc:  # noqa: BLE001
            errors.append(str(exc))
            if normalized_provider == "nager":
                raise SeasonalThemeError(str(exc)) from exc

    builtin = _builtin_events(normalized_country, normalized_year)
    if builtin:
        return builtin

    raise SeasonalThemeError("Unable to fetch events. " + " | ".join(errors))


def _pick_profile_slug(event_name: str, available_slugs: Iterable[str]) -> tuple[str | None, str]:
    name = (event_name or "").strip().lower()
    slug_set = {str(item).strip().lower() for item in available_slugs if str(item).strip()}
    if not slug_set:
        return None, "no_profiles"

    keyword_to_slug = [
        (("lunar", "chinese new year", "spring festival", "lantern", "ចូលឆ្នាំចិន"), "lunar_festival"),
        (("water", "boat", "moon", "night", "អុំទូក"), "ocean"),
        (("new year", "ឆ្នាំថ្មី", "ចូលឆ្នាំ", "festival", "campaign", "launch", "anniversary"), "sunrise"),
        (("harvest", "agri", "farm", "green", "earth", "environment", "ព្រៃ", "ស្រូវ"), "forest"),
    ]

    for keywords, slug in keyword_to_slug:
        if slug not in slug_set:
            continue
        if any(token in name for token in keywords):
            return slug, f"keyword:{slug}"

    if "classic" in slug_set:
        return "classic", "fallback:classic"
    # Stable fallback by sorted slug.
    return sorted(slug_set)[0], "fallback:first"


def build_seasonal_suggestions(
    events: list[dict],
    profile_rows: Iterable,
    days_before: int = 1,
    days_after: int = 1,
) -> list[dict]:
    before = max(0, min(int(days_before), 14))
    after = max(0, min(int(days_after), 30))

    profiles = list(profile_rows or [])
    slug_to_profile = {str(item.slug).strip().lower(): item for item in profiles if getattr(item, "slug", None)}
    suggestions: list[dict] = []

    seen: set[tuple[str, date]] = set()
    for row in events or []:
        event_name = str((row or {}).get("name") or "").strip() or "Event"
        event_day = (row or {}).get("date")
        if not isinstance(event_day, date):
            continue

        dedupe_key = (event_name.lower(), event_day)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        profile_slug, reason = _pick_profile_slug(event_name, slug_to_profile.keys())
        profile = slug_to_profile.get(profile_slug or "")
        if not profile:
            continue

        window_start = event_day - timedelta(days=before)
        window_end = event_day + timedelta(days=after)
        suggestions.append(
            {
                "name": event_name,
                "description": (row or {}).get("description"),
                "event_date": event_day.isoformat(),
                "start_date": window_start.isoformat(),
                "end_date": window_end.isoformat(),
                "profile_id": int(profile.id),
                "profile_slug": str(profile.slug),
                "profile_label": str(profile.label),
                "source": str((row or {}).get("source") or "unknown"),
                "reason": reason,
            }
        )

    return suggestions
