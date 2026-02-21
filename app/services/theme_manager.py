import json
import re
from copy import deepcopy
from dataclasses import dataclass
from datetime import date, datetime, timezone
from threading import Lock
from zoneinfo import ZoneInfo

from app.extensions import db
from app.models.theme import ThemeProfile, ThemeRuntimeState, ThemeSchedule


DEFAULT_SCOPE = "admin"
ALLOWED_SCOPES = {"admin", "expert", "farmer"}
ALLOWED_RADIUS_MODES = {"soft", "medium", "sharp"}
ALLOWED_DENSITY_MODES = {"comfortable", "compact"}
HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{1,79}$")
TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
URL_RE = re.compile(r"^https?://[^\s]{3,280}$", re.IGNORECASE)
STATIC_URL_RE = re.compile(r"^/static/[A-Za-z0-9._/-]{3,280}$")
MOTION_LAYER_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{1,39}$")
MOTION_PLACEMENTS = {"topbar", "topbar_xy", "viewport", "sidebar", "auth_bg"}
MOTION_SCROLL_MODES = {"fixed", "scroll"}

TOKEN_DEFAULTS = {
    "primary": "#4e73df",
    "primary_soft": "rgba(78, 115, 223, 0.14)",
    "admin_bg": "#f8f9fc",  # legacy alias for light background
    "admin_card": "#ffffff",  # legacy alias for light card
    "admin_border": "#e3e6f0",  # legacy alias for light border
    "admin_text": "#3a3b45",  # legacy alias for light text
    "admin_muted": "#858796",  # legacy alias for light muted text
    "admin_bg_light": "#f8f9fc",
    "admin_card_light": "#ffffff",
    "admin_border_light": "#e3e6f0",
    "admin_text_light": "#3a3b45",
    "admin_muted_light": "#858796",
    "admin_bg_dark": "#0f172a",
    "admin_card_dark": "#111827",
    "admin_border_dark": "#1f2937",
    "admin_text_dark": "#e2e8f0",
    "admin_muted_dark": "#94a3b8",
    "admin_accent": "#4e73df",
    "admin_accent_soft": "rgba(78, 115, 223, 0.14)",
    "admin_shadow": "0 18px 36px rgba(15, 23, 42, 0.08)",
    "admin_lottie_url": "",
    "admin_motion_layers": "[]",
}

DEFAULT_PROFILES = {
    "admin": [
        {
            "slug": "classic",
            "label": "Classic Blue",
            "description": "Balanced default admin palette.",
            "tokens": {
                "primary": "#4e73df",
                "admin_accent": "#4e73df",
                "admin_accent_soft": "rgba(78, 115, 223, 0.14)",
            },
        },
        {
            "slug": "forest",
            "label": "Forest Green",
            "description": "Calm green palette for long operations.",
            "tokens": {
                "primary": "#2f8f5b",
                "primary_soft": "rgba(47, 143, 91, 0.14)",
                "admin_accent": "#2f8f5b",
                "admin_accent_soft": "rgba(47, 143, 91, 0.16)",
            },
        },
        {
            "slug": "ocean",
            "label": "Ocean Teal",
            "description": "High-contrast cool palette.",
            "tokens": {
                "primary": "#0e7490",
                "primary_soft": "rgba(14, 116, 144, 0.16)",
                "admin_accent": "#0e7490",
                "admin_accent_soft": "rgba(14, 116, 144, 0.16)",
            },
        },
        {
            "slug": "sunrise",
            "label": "Sunrise Amber",
            "description": "Warm palette for dashboards and reports.",
            "tokens": {
                "primary": "#d97706",
                "primary_soft": "rgba(217, 119, 6, 0.16)",
                "admin_accent": "#d97706",
                "admin_accent_soft": "rgba(217, 119, 6, 0.16)",
            },
        },
        {
            "slug": "lunar_festival",
            "label": "Lunar Festival",
            "description": "Red-gold festive palette inspired by seasonal campaigns.",
            "tokens": {
                "primary": "#eab308",
                "primary_soft": "rgba(234, 179, 8, 0.18)",
                "admin_bg_light": "#fbf7f2",
                "admin_card_light": "#ffffff",
                "admin_border_light": "#f1d5c3",
                "admin_bg_dark": "#0b1020",
                "admin_card_dark": "#111a33",
                "admin_border_dark": "#2a365c",
                "admin_accent": "#d62828",
                "admin_accent_soft": "rgba(214, 40, 40, 0.16)",
                "admin_lottie_url": "/static/animations/lunar_festival.json",
                "admin_motion_layers": (
                    '[{"id":"lunar_top","name":"Lunar Top","url":"/static/animations/lunar_festival.json",'
                    '"placement":"topbar","x":84,"y":12,"size":30,"scale":1,"opacity":0.95,"z_index":30,"enabled":true}]'
                ),
            },
        },
    ]
}

_CACHE_LOCK = Lock()
_RUNTIME_CACHE = {}


@dataclass
class ThemeValidationError(Exception):
    message: str

    def __str__(self):
        return self.message


def _utcnow():
    return datetime.now(timezone.utc)


def _normalize_scope(scope: str) -> str:
    value = (scope or DEFAULT_SCOPE).strip().lower()
    if value not in ALLOWED_SCOPES:
        return DEFAULT_SCOPE
    return value


def _json_load(value: str):
    if not value:
        return {}
    try:
        payload = json.loads(value)
        if isinstance(payload, dict):
            return payload
    except Exception:
        return {}
    return {}


def _json_dump(payload):
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def _is_allowed_theme_url(value: str) -> bool:
    text = (value or "").strip()
    if not text:
        return False
    if URL_RE.match(text):
        return True
    if ".." in text:
        return False
    return bool(STATIC_URL_RE.match(text))


def _to_bool(value, default=True):
    if isinstance(value, bool):
        return value
    if value is None:
        return bool(default)
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return bool(default)


def _clamp_float(value, min_value, max_value, fallback):
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = float(fallback)
    if number < min_value:
        number = min_value
    if number > max_value:
        number = max_value
    return round(number, 3)


def _clamp_int(value, min_value, max_value, fallback):
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        number = int(fallback)
    if number < min_value:
        number = min_value
    if number > max_value:
        number = max_value
    return number


def _sanitize_motion_layers(raw_text: str) -> str:
    text = (raw_text or "").strip()
    if not text:
        return "[]"
    try:
        payload = json.loads(text)
    except Exception:
        return "[]"
    if not isinstance(payload, list):
        return "[]"

    result = []
    for index, item in enumerate(payload[:24], start=1):
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        if not _is_allowed_theme_url(url):
            continue

        layer_id = str(item.get("id") or f"layer_{index}").strip().lower()
        if not MOTION_LAYER_ID_RE.match(layer_id):
            layer_id = f"layer_{index}"
        if any(existing.get("id") == layer_id for existing in result):
            layer_id = f"{layer_id}_{index}"

        name = str(item.get("name") or f"Layer {index}").strip()
        if len(name) > 60:
            name = name[:60]
        if not name:
            name = f"Layer {index}"

        placement = str(item.get("placement") or "topbar").strip().lower()
        if placement not in MOTION_PLACEMENTS:
            placement = "topbar"

        scroll_mode = str(item.get("scroll_mode") or item.get("behavior") or "fixed").strip().lower()
        if scroll_mode not in MOTION_SCROLL_MODES:
            scroll_mode = "fixed"
        if placement != "viewport":
            scroll_mode = "fixed"

        max_size = 960 if placement in {"viewport", "sidebar", "auth_bg"} else 320

        result.append(
            {
                "id": layer_id,
                "name": name,
                "url": url,
                "placement": placement,
                "scroll_mode": scroll_mode,
                "x": _clamp_float(item.get("x"), 0.0, 100.0, 85.0),
                "y": _clamp_float(item.get("y"), 0.0, 100.0, 12.0),
                "size": _clamp_int(item.get("size"), 16, max_size, 32),
                "scale": _clamp_float(item.get("scale"), 0.3, 3.0, 1.0),
                "opacity": _clamp_float(item.get("opacity"), 0.1, 1.0, 0.95),
                "z_index": _clamp_int(item.get("z_index"), 1, 200, 30),
                "enabled": bool(_to_bool(item.get("enabled"), default=True)),
            }
        )

    return _json_dump(result)


def _sanitize_tokens(tokens: dict) -> dict:
    if not isinstance(tokens, dict):
        return {}
    sanitized = {}
    for key, value in tokens.items():
        if key not in TOKEN_DEFAULTS:
            continue
        if not isinstance(value, str):
            continue
        text = value.strip()
        if not text:
            continue
        if key == "admin_motion_layers":
            sanitized[key] = _sanitize_motion_layers(text)
            continue
        if key.endswith("_url"):
            if len(text) <= 280 and _is_allowed_theme_url(text):
                sanitized[key] = text
            continue
        if len(text) > 120:
            continue
        if key.endswith("_shadow"):
            # Shadow values are free-form but bounded and controlled by whitelist key.
            sanitized[key] = text
            continue
        if key.endswith("_soft"):
            # Permit rgba for soft overlays.
            if text.startswith("rgba(") and text.endswith(")"):
                sanitized[key] = text
                continue
        if HEX_COLOR_RE.match(text):
            sanitized[key] = text
    return sanitized


def _serialize_profile(profile: ThemeProfile) -> dict:
    tokens = TOKEN_DEFAULTS.copy()
    tokens.update(_sanitize_tokens(_json_load(profile.tokens_json)))
    return {
        "id": profile.id,
        "scope": profile.scope,
        "slug": profile.slug,
        "label": profile.label,
        "description": profile.description,
        "is_active": bool(profile.is_active),
        "is_locked": bool(profile.is_locked),
        "tokens": tokens,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


def _parse_weekdays(value):
    if value is None:
        return []
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except Exception:
            parsed = []
    else:
        parsed = value
    if not isinstance(parsed, list):
        return []
    result = sorted({int(item) for item in parsed if str(item).isdigit() and 0 <= int(item) <= 6})
    return result


def _parse_time(value):
    if not value:
        return None
    text = str(value).strip()
    if not TIME_RE.match(text):
        raise ThemeValidationError("Invalid time format. Expected HH:MM.")
    return text


def _time_to_minutes(value: str | None):
    if not value:
        return None
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def _parse_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    text = str(value).strip()
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        raise ThemeValidationError("Invalid date format. Expected YYYY-MM-DD.")


def _resolve_timezone(name: str | None) -> str:
    value = (name or "UTC").strip()
    if len(value) > 64:
        raise ThemeValidationError("Timezone value is too long.")
    try:
        ZoneInfo(value)
    except Exception:
        raise ThemeValidationError("Invalid timezone.")
    return value


def _schedule_matches(schedule: ThemeSchedule, now_utc: datetime) -> bool:
    tz = ZoneInfo(schedule.timezone or "UTC")
    local_now = now_utc.astimezone(tz)

    if schedule.start_date and local_now.date() < schedule.start_date:
        return False
    if schedule.end_date and local_now.date() > schedule.end_date:
        return False

    weekdays = _parse_weekdays(schedule.weekdays_json)
    if weekdays and local_now.weekday() not in weekdays:
        return False

    start_minutes = _time_to_minutes(schedule.start_time)
    end_minutes = _time_to_minutes(schedule.end_time)
    if start_minutes is None and end_minutes is None:
        return True

    now_minutes = local_now.hour * 60 + local_now.minute
    if start_minutes is None:
        return now_minutes < end_minutes
    if end_minutes is None:
        return now_minutes >= start_minutes
    if start_minutes == end_minutes:
        return True
    if start_minutes < end_minutes:
        return start_minutes <= now_minutes < end_minutes
    # Overnight window, e.g. 22:00 -> 05:00
    return now_minutes >= start_minutes or now_minutes < end_minutes


def _runtime_cache_get(scope: str, revision: int):
    now = _utcnow().timestamp()
    with _CACHE_LOCK:
        entry = _RUNTIME_CACHE.get(scope)
        if not entry:
            return None
        if entry["revision"] != revision:
            return None
        if entry["expires_at"] <= now:
            return None
        return deepcopy(entry["payload"])


def _runtime_cache_set(scope: str, revision: int, payload: dict, ttl_seconds: int):
    now = _utcnow().timestamp()
    ttl = max(5, min(int(ttl_seconds or 120), 900))
    with _CACHE_LOCK:
        _RUNTIME_CACHE[scope] = {
            "revision": int(revision),
            "payload": deepcopy(payload),
            "expires_at": now + ttl,
        }


def invalidate_runtime_cache(scope: str):
    with _CACHE_LOCK:
        _RUNTIME_CACHE.pop(scope, None)


def ensure_seed_data(scope: str = DEFAULT_SCOPE, actor_id: int | None = None):
    target_scope = _normalize_scope(scope)
    changed = False

    defaults = DEFAULT_PROFILES.get(target_scope, [])
    existing = {
        row.slug: row
        for row in ThemeProfile.query.filter_by(scope=target_scope).all()
    }

    for item in defaults:
        existing_profile = existing.get(item["slug"])
        if existing_profile:
            if existing_profile.is_locked:
                current_tokens = _sanitize_tokens(_json_load(existing_profile.tokens_json))
                default_tokens = _sanitize_tokens(item.get("tokens", {}))
                patched_tokens = dict(current_tokens)
                updated = False
                for key, value in default_tokens.items():
                    if key not in patched_tokens:
                        patched_tokens[key] = value
                        updated = True
                if updated:
                    existing_profile.tokens_json = _json_dump(patched_tokens)
                    changed = True
                if not existing_profile.description and item.get("description"):
                    existing_profile.description = item.get("description")
                    changed = True
            continue
        profile = ThemeProfile(
            scope=target_scope,
            slug=item["slug"],
            label=item["label"],
            description=item.get("description"),
            tokens_json=_json_dump(_sanitize_tokens(item.get("tokens", {}))),
            is_active=item["slug"] == "classic",
            is_locked=True,
            created_by_id=actor_id,
        )
        db.session.add(profile)
        changed = True

    if changed:
        db.session.flush()

    state = ThemeRuntimeState.query.get(target_scope)
    if not state:
        active = (
            ThemeProfile.query
            .filter_by(scope=target_scope, is_active=True)
            .order_by(ThemeProfile.id.asc())
            .first()
        )
        if not active:
            active = ThemeProfile.query.filter_by(scope=target_scope).order_by(ThemeProfile.id.asc()).first()
        state = ThemeRuntimeState(
            scope=target_scope,
            active_profile_id=active.id if active else None,
            revision=1,
            auto_schedule_enabled=True,
            cache_ttl_seconds=120,
            radius_mode="soft",
            density_mode="comfortable",
            updated_by_id=actor_id,
        )
        db.session.add(state)
        changed = True
    elif not state.active_profile_id:
        active = ThemeProfile.query.filter_by(scope=target_scope).order_by(ThemeProfile.id.asc()).first()
        if active:
            state.active_profile_id = active.id
            state.revision = max(1, int(state.revision or 1))
            state.updated_by_id = actor_id
            changed = True

    if changed:
        db.session.commit()
        invalidate_runtime_cache(target_scope)

    return target_scope


def _serialize_schedule(schedule: ThemeSchedule) -> dict:
    return {
        "id": schedule.id,
        "scope": schedule.scope,
        "name": schedule.name,
        "profile_id": schedule.profile_id,
        "profile_label": schedule.profile.label if schedule.profile else None,
        "timezone": schedule.timezone,
        "weekdays": _parse_weekdays(schedule.weekdays_json),
        "start_time": schedule.start_time,
        "end_time": schedule.end_time,
        "start_date": schedule.start_date.isoformat() if schedule.start_date else None,
        "end_date": schedule.end_date.isoformat() if schedule.end_date else None,
        "priority": schedule.priority,
        "is_enabled": bool(schedule.is_enabled),
        "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None,
    }


def list_profiles(scope: str):
    target_scope = _normalize_scope(scope)
    return (
        ThemeProfile.query
        .filter_by(scope=target_scope)
        .order_by(ThemeProfile.is_locked.desc(), ThemeProfile.id.asc())
        .all()
    )


def list_schedules(scope: str):
    target_scope = _normalize_scope(scope)
    return (
        ThemeSchedule.query
        .filter_by(scope=target_scope)
        .order_by(ThemeSchedule.priority.asc(), ThemeSchedule.id.asc())
        .all()
    )


def get_runtime_state(scope: str):
    target_scope = _normalize_scope(scope)
    return ThemeRuntimeState.query.get(target_scope)


def resolve_active_runtime(scope: str, use_cache: bool = True) -> dict:
    target_scope = ensure_seed_data(scope)
    state = get_runtime_state(target_scope)
    if not state:
        raise ThemeValidationError("Theme runtime state is missing.")

    cached = _runtime_cache_get(target_scope, int(state.revision or 1)) if use_cache else None
    if cached:
        return cached

    now_utc = _utcnow()
    selected_profile = None
    source = "manual"

    if state.auto_schedule_enabled:
        schedules = (
            ThemeSchedule.query
            .filter_by(scope=target_scope, is_enabled=True)
            .order_by(ThemeSchedule.priority.asc(), ThemeSchedule.id.asc())
            .all()
        )
        for schedule in schedules:
            if schedule.profile is None:
                continue
            if _schedule_matches(schedule, now_utc):
                selected_profile = schedule.profile
                source = "scheduled"
                break

    if not selected_profile and state.active_profile_id:
        selected_profile = ThemeProfile.query.filter_by(id=state.active_profile_id, scope=target_scope).first()

    if not selected_profile:
        selected_profile = (
            ThemeProfile.query
            .filter_by(scope=target_scope, is_active=True)
            .order_by(ThemeProfile.id.asc())
            .first()
        )

    if not selected_profile:
        selected_profile = ThemeProfile.query.filter_by(scope=target_scope).order_by(ThemeProfile.id.asc()).first()
        source = "default"

    profile_data = _serialize_profile(selected_profile)
    payload = {
        "scope": target_scope,
        "revision": int(state.revision or 1),
        "source": source,
        "active_profile_id": selected_profile.id if selected_profile else None,
        "radius_mode": state.radius_mode or "soft",
        "density_mode": state.density_mode or "comfortable",
        "auto_schedule_enabled": bool(state.auto_schedule_enabled),
        "cache_ttl_seconds": int(state.cache_ttl_seconds or 120),
        "next_refresh_seconds": 60 if state.auto_schedule_enabled else int(state.cache_ttl_seconds or 120),
        "profile": profile_data,
        "fetched_at": now_utc.isoformat(),
    }

    _runtime_cache_set(
        target_scope,
        int(state.revision or 1),
        payload,
        min(payload["cache_ttl_seconds"], payload["next_refresh_seconds"]),
    )
    return payload


def _validate_slug(slug: str):
    text = (slug or "").strip().lower()
    if not SLUG_RE.match(text):
        raise ThemeValidationError("Invalid slug format. Use lowercase letters, numbers, _ or -.")
    return text


def _validate_label(label: str):
    text = (label or "").strip()
    if not text:
        raise ThemeValidationError("Profile label is required.")
    if len(text) > 120:
        raise ThemeValidationError("Profile label is too long.")
    return text


def upsert_profile(scope: str, payload: dict, actor_id: int | None = None) -> ThemeProfile:
    target_scope = _normalize_scope(scope)
    data = payload or {}
    profile_id = data.get("id")
    raw_tokens = data.get("tokens") or {}
    tokens = _sanitize_tokens(raw_tokens)
    label = _validate_label(data.get("label"))
    slug = _validate_slug(data.get("slug"))
    description = (data.get("description") or "").strip() or None
    if description and len(description) > 255:
        raise ThemeValidationError("Profile description is too long.")

    if profile_id:
        profile = ThemeProfile.query.filter_by(id=profile_id, scope=target_scope).first()
        if not profile:
            raise ThemeValidationError("Theme profile not found.")
        if profile.is_locked and slug != profile.slug:
            raise ThemeValidationError("Locked profile slug cannot be changed.")
        if ThemeProfile.query.filter(
            ThemeProfile.scope == target_scope,
            ThemeProfile.slug == slug,
            ThemeProfile.id != profile.id,
        ).first():
            raise ThemeValidationError("Slug already exists in this scope.")
    else:
        if ThemeProfile.query.filter_by(scope=target_scope, slug=slug).first():
            raise ThemeValidationError("Slug already exists in this scope.")
        profile = ThemeProfile(
            scope=target_scope,
            slug=slug,
            created_by_id=actor_id,
        )
        db.session.add(profile)

    profile.label = label
    profile.description = description
    profile.tokens_json = _json_dump(tokens)

    # If the active profile is edited, force runtime refresh for all clients.
    state = ThemeRuntimeState.query.get(target_scope)
    if state and int(state.active_profile_id or 0) == int(profile.id or 0):
        state.revision = int(state.revision or 1) + 1
        state.updated_by_id = actor_id
        invalidate_runtime_cache(target_scope)
    return profile


def activate_profile(
    scope: str,
    profile_id: int,
    actor_id: int | None = None,
    radius_mode: str | None = None,
    density_mode: str | None = None,
    auto_schedule_enabled: bool | None = None,
    cache_ttl_seconds: int | None = None,
) -> ThemeRuntimeState:
    target_scope = _normalize_scope(scope)
    profile = ThemeProfile.query.filter_by(id=profile_id, scope=target_scope).first()
    if not profile:
        raise ThemeValidationError("Theme profile not found.")

    ThemeProfile.query.filter_by(scope=target_scope).update({"is_active": False})
    profile.is_active = True

    state = ThemeRuntimeState.query.get(target_scope)
    if not state:
        state = ThemeRuntimeState(scope=target_scope)
        db.session.add(state)
        db.session.flush()

    state.active_profile_id = profile.id
    state.revision = int(state.revision or 1) + 1
    state.updated_by_id = actor_id
    if radius_mode:
        mode = str(radius_mode).strip().lower()
        if mode not in ALLOWED_RADIUS_MODES:
            raise ThemeValidationError("Invalid radius mode.")
        state.radius_mode = mode
    if density_mode:
        mode = str(density_mode).strip().lower()
        if mode not in ALLOWED_DENSITY_MODES:
            raise ThemeValidationError("Invalid density mode.")
        state.density_mode = mode
    if auto_schedule_enabled is not None:
        state.auto_schedule_enabled = bool(auto_schedule_enabled)
    if cache_ttl_seconds is not None:
        ttl = int(cache_ttl_seconds)
        if ttl < 5 or ttl > 900:
            raise ThemeValidationError("Cache TTL must be between 5 and 900 seconds.")
        state.cache_ttl_seconds = ttl

    invalidate_runtime_cache(target_scope)
    return state


def delete_profile(scope: str, profile_id: int):
    target_scope = _normalize_scope(scope)
    profile = ThemeProfile.query.filter_by(id=profile_id, scope=target_scope).first()
    if not profile:
        raise ThemeValidationError("Theme profile not found.")
    if profile.is_locked:
        raise ThemeValidationError("Locked profile cannot be deleted.")

    state = ThemeRuntimeState.query.get(target_scope)
    if state and state.active_profile_id == profile.id:
        raise ThemeValidationError("Cannot delete the active profile.")

    has_schedules = ThemeSchedule.query.filter_by(scope=target_scope, profile_id=profile.id).first()
    if has_schedules:
        raise ThemeValidationError("Cannot delete profile while schedules are attached.")

    db.session.delete(profile)
    if state:
        state.revision = int(state.revision or 1) + 1
    invalidate_runtime_cache(target_scope)


def upsert_schedule(scope: str, payload: dict, actor_id: int | None = None) -> ThemeSchedule:
    target_scope = _normalize_scope(scope)
    data = payload or {}
    schedule_id = data.get("id")

    name = (data.get("name") or "").strip()
    if not name:
        raise ThemeValidationError("Schedule name is required.")
    if len(name) > 120:
        raise ThemeValidationError("Schedule name is too long.")

    profile_id = int(data.get("profile_id") or 0)
    profile = ThemeProfile.query.filter_by(id=profile_id, scope=target_scope).first()
    if not profile:
        raise ThemeValidationError("Selected profile does not exist in this scope.")

    timezone_name = _resolve_timezone(data.get("timezone") or "UTC")
    weekdays = _parse_weekdays(data.get("weekdays"))
    start_time = _parse_time(data.get("start_time"))
    end_time = _parse_time(data.get("end_time"))
    start_date = _parse_date(data.get("start_date"))
    end_date = _parse_date(data.get("end_date"))
    if start_date and end_date and start_date > end_date:
        raise ThemeValidationError("Start date cannot be after end date.")

    priority = int(data.get("priority") or 100)
    if priority < 1 or priority > 9999:
        raise ThemeValidationError("Priority must be between 1 and 9999.")

    is_enabled = bool(data.get("is_enabled", True))

    if schedule_id:
        schedule = ThemeSchedule.query.filter_by(id=schedule_id, scope=target_scope).first()
        if not schedule:
            raise ThemeValidationError("Schedule not found.")
    else:
        schedule = ThemeSchedule(scope=target_scope, created_by_id=actor_id)
        db.session.add(schedule)

    schedule.name = name
    schedule.profile_id = profile.id
    schedule.timezone = timezone_name
    schedule.weekdays_json = _json_dump(weekdays)
    schedule.start_time = start_time
    schedule.end_time = end_time
    schedule.start_date = start_date
    schedule.end_date = end_date
    schedule.priority = priority
    schedule.is_enabled = is_enabled

    state = ThemeRuntimeState.query.get(target_scope)
    if state:
        state.revision = int(state.revision or 1) + 1
        state.updated_by_id = actor_id

    invalidate_runtime_cache(target_scope)
    return schedule


def delete_schedule(scope: str, schedule_id: int, actor_id: int | None = None):
    target_scope = _normalize_scope(scope)
    schedule = ThemeSchedule.query.filter_by(id=schedule_id, scope=target_scope).first()
    if not schedule:
        raise ThemeValidationError("Schedule not found.")
    db.session.delete(schedule)

    state = ThemeRuntimeState.query.get(target_scope)
    if state:
        state.revision = int(state.revision or 1) + 1
        state.updated_by_id = actor_id
    invalidate_runtime_cache(target_scope)


def build_manager_payload(scope: str) -> dict:
    target_scope = ensure_seed_data(scope)
    state = get_runtime_state(target_scope)
    runtime = resolve_active_runtime(target_scope, use_cache=False)

    profiles = [_serialize_profile(row) for row in list_profiles(target_scope)]
    schedules = [_serialize_schedule(row) for row in list_schedules(target_scope)]
    return {
        "scope": target_scope,
        "runtime_state": {
            "scope": target_scope,
            "active_profile_id": state.active_profile_id if state else None,
            "revision": int(state.revision or 1) if state else 1,
            "auto_schedule_enabled": bool(state.auto_schedule_enabled) if state else True,
            "cache_ttl_seconds": int(state.cache_ttl_seconds or 120) if state else 120,
            "radius_mode": state.radius_mode if state else "soft",
            "density_mode": state.density_mode if state else "comfortable",
        },
        "active_runtime": runtime,
        "profiles": profiles,
        "schedules": schedules,
        "allowed_values": {
            "scopes": sorted(ALLOWED_SCOPES),
            "radius_modes": sorted(ALLOWED_RADIUS_MODES),
            "density_modes": sorted(ALLOWED_DENSITY_MODES),
        },
    }
