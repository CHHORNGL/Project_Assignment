from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any


THUNDERSTORM_CODES = {95, 96, 99}
HEAVY_RAIN_MM = 35.0
HEATWAVE_DAY_TEMP_C = 36.0
HEATWAVE_CURRENT_TEMP_C = 38.0
HIGH_WIND_KPH = 45.0
SPRAY_WIND_LIMIT_KPH = 25.0

ALERT_COLORS = {
    "danger": "red",
    "warning": "orange",
    "safe": "green",
    "info": "blue",
}

TEXTS = {
    "en": {
        "cond_clear_sky": "Clear sky",
        "cond_partly_cloudy": "Partly cloudy",
        "cond_cloudy": "Cloudy",
        "cond_foggy": "Foggy",
        "cond_light_rain": "Light rain",
        "cond_heavy_rain": "Heavy rain",
        "cond_snow": "Snow",
        "cond_thunderstorm": "Thunderstorm",
        "cond_windy": "Windy weather",
        "cond_unavailable": "Unavailable",
        "cond_data_unavailable": "Weather data unavailable",
        "alert_storm_title": "Storm risk in the next 24 to 72 hours",
        "alert_storm_message": "Strong wind or thunderstorm conditions are likely.",
        "alert_storm_reco": "Secure young plants, tie tall crops, and avoid field work during peak wind.",
        "alert_heavy_rain_title": "Heavy rain expected",
        "alert_heavy_rain_message": "Rainfall may be high enough to cause waterlogging.",
        "alert_heavy_rain_reco": "Open drainage channels and move fertilizer application after rain.",
        "alert_heat_title": "Heat stress risk",
        "alert_heat_message": "Very hot conditions may stress crops and livestock.",
        "alert_heat_reco": "Irrigate in early morning/evening and use mulch to keep soil moisture.",
        "alert_wind_spray_title": "Wind too strong for spraying",
        "alert_wind_spray_message": "Pesticide spray can drift and waste product in high wind.",
        "alert_wind_spray_reco": "Spray only when wind drops below 20 km/h, ideally early morning.",
        "alert_spray_safe_title": "Spraying window looks safer",
        "alert_spray_safe_message": "Wind is currently in a safer range for controlled spraying.",
        "alert_spray_safe_reco": "Continue checking wind before mixing chemicals.",
        "alert_irrigation_reduce_title": "Irrigation can be reduced",
        "alert_irrigation_reduce_message": "Good rainfall is expected in the next 24 hours.",
        "alert_irrigation_reduce_reco": "Delay or reduce irrigation to save water and avoid waterlogging.",
        "alert_low_rain_title": "Low rain expected",
        "alert_low_rain_message": "Little rainfall is expected in the next 24 hours.",
        "alert_low_rain_reco": "Plan a light irrigation cycle, preferably early morning.",
        "alert_stable_title": "Weather is stable",
        "alert_stable_message": "No major weather risks detected for the next few days.",
        "alert_stable_reco": "Follow normal farm operations and keep monitoring local updates.",
        "reco_storm": "Protect crop supports and avoid outdoor spraying during storm hours.",
        "reco_heavy_rain": "Check field drainage and postpone fertilizer while heavy rain is expected.",
        "reco_heat": "Use shade, mulch, and split irrigation to reduce heat stress.",
        "reco_wind": "Delay pesticide spraying until wind is calmer.",
        "reco_rain_high": "Reduce irrigation because rainfall is likely soon.",
        "reco_rain_low": "Plan irrigation because rain chance is low.",
        "fallback_alert_title": "Live weather is unavailable",
        "fallback_alert_message": "The weather service is temporarily offline.",
        "fallback_alert_reco": "Use local observations before spraying or irrigating.",
        "fallback_reco_1": "Check sky conditions locally before critical field activities.",
        "fallback_reco_2": "Retry weather updates when network connection is stable.",
        "fallback_reason": "Live weather data is not available.",
    },
    "km": {
        "cond_clear_sky": "មេឃស្រឡះ",
        "cond_partly_cloudy": "មេឃមានពពកខ្លះ",
        "cond_cloudy": "មេឃពពកច្រើន",
        "cond_foggy": "មានអ័ព្ទ",
        "cond_light_rain": "ភ្លៀងតិច",
        "cond_heavy_rain": "ភ្លៀងខ្លាំង",
        "cond_snow": "ព្រិល",
        "cond_thunderstorm": "ព្យុះភ្លៀងផ្គរ",
        "cond_windy": "ខ្យល់ខ្លាំង",
        "cond_unavailable": "មិនមានទិន្នន័យ",
        "cond_data_unavailable": "មិនអាចទាញទិន្នន័យអាកាសធាតុបាន",
        "alert_storm_title": "ហានិភ័យព្យុះក្នុង 24 ដល់ 72 ម៉ោងខាងមុខ",
        "alert_storm_message": "អាចមានខ្យល់ខ្លាំង ឬ ព្យុះភ្លៀងផ្គរ។",
        "alert_storm_reco": "ចងរុក្ខជាតិក្មេង និងជៀសវាងធ្វើការក្រៅវាលពេលខ្យល់ខ្លាំង។",
        "alert_heavy_rain_title": "រំពឹងថាមានភ្លៀងខ្លាំង",
        "alert_heavy_rain_message": "បរិមាណភ្លៀងអាចបង្កឱ្យទឹកជន់លិចក្នុងស្រែ។",
        "alert_heavy_rain_reco": "បើកបង្ហូរទឹក និងពន្យារពេលដាក់ជីរហូតភ្លៀងឈប់។",
        "alert_heat_title": "ហានិភ័យកម្តៅខ្លាំង",
        "alert_heat_message": "សីតុណ្ហភាពខ្ពស់អាចប៉ះពាល់ដំណាំ និងសត្វចិញ្ចឹម។",
        "alert_heat_reco": "ស្រោចទឹកព្រឹកព្រលឹម ឬ ល្ងាច និងប្រើមូលដីរក្សាសំណើម។",
        "alert_wind_spray_title": "ខ្យល់ខ្លាំងពេកសម្រាប់បាញ់ថ្នាំ",
        "alert_wind_spray_message": "ការបាញ់ថ្នាំអាចហោះរាលដាល និងខាតថ្នាំពេលខ្យល់ខ្លាំង។",
        "alert_wind_spray_reco": "បាញ់ថ្នាំពេលខ្យល់ក្រោម 20 km/h ជាពិសេសពេលព្រឹក។",
        "alert_spray_safe_title": "លក្ខខណ្ឌបាញ់ថ្នាំសុវត្ថិភាពជាងមុន",
        "alert_spray_safe_message": "ល្បឿនខ្យល់ឥឡូវសមស្របជាងមុនសម្រាប់បាញ់ថ្នាំ។",
        "alert_spray_safe_reco": "សូមពិនិត្យខ្យល់ម្តងទៀតមុនលាយថ្នាំ។",
        "alert_irrigation_reduce_title": "អាចកាត់បន្ថយការស្រោចទឹក",
        "alert_irrigation_reduce_message": "រំពឹងថាមានភ្លៀងគ្រប់គ្រាន់ក្នុង 24 ម៉ោងខាងមុខ។",
        "alert_irrigation_reduce_reco": "ពន្យារពេល ឬ កាត់បន្ថយស្រោចទឹក ដើម្បីសន្សំទឹក និងជៀសវាងទឹកជន់។",
        "alert_low_rain_title": "រំពឹងថាភ្លៀងតិច",
        "alert_low_rain_message": "ក្នុង 24 ម៉ោងខាងមុខ មានឱកាសភ្លៀងតិច។",
        "alert_low_rain_reco": "រៀបចំស្រោចទឹកស្រាលៗ ជាពិសេសពេលព្រឹក។",
        "alert_stable_title": "អាកាសធាតុមានស្ថិរភាព",
        "alert_stable_message": "មិនឃើញហានិភ័យអាកាសធាតុធំៗក្នុងប៉ុន្មានថ្ងៃខាងមុខ។",
        "alert_stable_reco": "អនុវត្តការងារស្រែធម្មតា ហើយតាមដានព័ត៌មានអាកាសធាតុបន្ត។",
        "reco_storm": "ការពារទ្រទ្រង់ដំណាំ និងជៀសវាងបាញ់ថ្នាំពេលព្យុះ។",
        "reco_heavy_rain": "ពិនិត្យប្រព័ន្ធបង្ហូរទឹក ហើយពន្យារពេលដាក់ជីពេលភ្លៀងខ្លាំង។",
        "reco_heat": "ប្រើម្លប់ មូលដី និងបែងចែកពេលស្រោចទឹក ដើម្បីបន្ថយកម្តៅ។",
        "reco_wind": "ពន្យារពេលបាញ់ថ្នាំរហូតខ្យល់ស្ងប់។",
        "reco_rain_high": "កាត់បន្ថយស្រោចទឹក ព្រោះមានឱកាសភ្លៀងខាងមុខ។",
        "reco_rain_low": "រៀបចំស្រោចទឹក ព្រោះឱកាសភ្លៀងទាប។",
        "fallback_alert_title": "មិនអាចទាញអាកាសធាតុផ្ទាល់បាន",
        "fallback_alert_message": "សេវាអាកាសធាតុកំពុងមានបញ្ហាបណ្ដោះអាសន្ន។",
        "fallback_alert_reco": "សូមផ្អែកលើការសង្កេតក្នុងតំបន់មុនស្រោចទឹក ឬ បាញ់ថ្នាំ។",
        "fallback_reco_1": "ពិនិត្យមេឃ និងខ្យល់នៅតំបន់ជាក់ស្តែង មុនធ្វើការងារសំខាន់។",
        "fallback_reco_2": "សូមព្យាយាមទាញទិន្នន័យម្តងទៀត ពេលអ៊ីនធឺណិតស្ថិរភាព។",
        "fallback_reason": "មិនមានទិន្នន័យអាកាសធាតុផ្ទាល់។",
    },
}


def _normalize_lang(lang: str | None) -> str:
    return "km" if (lang or "").strip().lower() == "km" else "en"


def _t(lang: str, key: str) -> str:
    norm = _normalize_lang(lang)
    return TEXTS.get(norm, TEXTS["en"]).get(key, TEXTS["en"].get(key, key))


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return []


def _safe_at(values: list[Any], index: int, default: Any = None) -> Any:
    if 0 <= index < len(values):
        return values[index]
    return default


def _weather_descriptor(code: int, lang: str) -> tuple[str, str]:
    if code == 0:
        return _t(lang, "cond_clear_sky"), "fas fa-sun"
    if code in {1, 2}:
        return _t(lang, "cond_partly_cloudy"), "fas fa-cloud-sun"
    if code == 3:
        return _t(lang, "cond_cloudy"), "fas fa-cloud"
    if code in {45, 48}:
        return _t(lang, "cond_foggy"), "fas fa-smog"
    if code in {51, 53, 55, 56, 57, 61, 63, 66, 80, 81}:
        return _t(lang, "cond_light_rain"), "fas fa-cloud-rain"
    if code in {65, 67, 82}:
        return _t(lang, "cond_heavy_rain"), "fas fa-cloud-showers-heavy"
    if code in {71, 73, 75, 77, 85, 86}:
        return _t(lang, "cond_snow"), "fas fa-snowflake"
    if code in THUNDERSTORM_CODES:
        return _t(lang, "cond_thunderstorm"), "fas fa-bolt"
    return _t(lang, "cond_windy"), "fas fa-wind"


def _sum(values: list[float]) -> float:
    return round(sum(values), 1)


def _mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values), 1)


def _max(values: list[float]) -> float:
    if not values:
        return 0.0
    return round(max(values), 1)


def _min(values: list[float]) -> float:
    if not values:
        return 0.0
    return round(min(values), 1)


def _has_heatwave(forecast: list[dict[str, Any]]) -> bool:
    hot_streak = 0
    for day in forecast:
        if _as_float(day.get("temp_max_c")) >= HEATWAVE_DAY_TEMP_C:
            hot_streak += 1
            if hot_streak >= 3:
                return True
        else:
            hot_streak = 0
    return False


def _add_alert(
    alerts: list[dict[str, str]],
    *,
    level: str,
    title: str,
    message: str,
    recommendation: str,
) -> None:
    alerts.append(
        {
            "level": level,
            "color": ALERT_COLORS.get(level, "blue"),
            "title": title,
            "message": message,
            "recommendation": recommendation,
        }
    )


def _build_alerts(
    *,
    current: dict[str, Any],
    forecast: list[dict[str, Any]],
    analytics: dict[str, float],
    lang: str,
) -> tuple[list[dict[str, str]], list[str]]:
    alerts: list[dict[str, str]] = []
    recommendations: list[str] = []

    storm_detected = any(_as_int(day.get("weather_code")) in THUNDERSTORM_CODES for day in forecast[:3])
    if storm_detected or analytics["max_wind_next_24h_kph"] >= HIGH_WIND_KPH:
        _add_alert(
            alerts,
            level="danger",
            title=_t(lang, "alert_storm_title"),
            message=_t(lang, "alert_storm_message"),
            recommendation=_t(lang, "alert_storm_reco"),
        )
        recommendations.append(_t(lang, "reco_storm"))

    if any(_as_float(day.get("rain_mm")) >= HEAVY_RAIN_MM for day in forecast[:3]):
        _add_alert(
            alerts,
            level="warning",
            title=_t(lang, "alert_heavy_rain_title"),
            message=_t(lang, "alert_heavy_rain_message"),
            recommendation=_t(lang, "alert_heavy_rain_reco"),
        )
        recommendations.append(_t(lang, "reco_heavy_rain"))

    heatwave_risk = _has_heatwave(forecast) or _as_float(current.get("temp_c")) >= HEATWAVE_CURRENT_TEMP_C
    if heatwave_risk:
        _add_alert(
            alerts,
            level="danger",
            title=_t(lang, "alert_heat_title"),
            message=_t(lang, "alert_heat_message"),
            recommendation=_t(lang, "alert_heat_reco"),
        )
        recommendations.append(_t(lang, "reco_heat"))

    if analytics["max_wind_next_24h_kph"] >= SPRAY_WIND_LIMIT_KPH:
        _add_alert(
            alerts,
            level="warning",
            title=_t(lang, "alert_wind_spray_title"),
            message=_t(lang, "alert_wind_spray_message"),
            recommendation=_t(lang, "alert_wind_spray_reco"),
        )
        recommendations.append(_t(lang, "reco_wind"))
    else:
        _add_alert(
            alerts,
            level="safe",
            title=_t(lang, "alert_spray_safe_title"),
            message=_t(lang, "alert_spray_safe_message"),
            recommendation=_t(lang, "alert_spray_safe_reco"),
        )

    if analytics["rain_next_24h_mm"] >= 15:
        _add_alert(
            alerts,
            level="info",
            title=_t(lang, "alert_irrigation_reduce_title"),
            message=_t(lang, "alert_irrigation_reduce_message"),
            recommendation=_t(lang, "alert_irrigation_reduce_reco"),
        )
        recommendations.append(_t(lang, "reco_rain_high"))
    elif analytics["rain_next_24h_mm"] < 3:
        _add_alert(
            alerts,
            level="info",
            title=_t(lang, "alert_low_rain_title"),
            message=_t(lang, "alert_low_rain_message"),
            recommendation=_t(lang, "alert_low_rain_reco"),
        )
        recommendations.append(_t(lang, "reco_rain_low"))

    if not alerts:
        _add_alert(
            alerts,
            level="safe",
            title=_t(lang, "alert_stable_title"),
            message=_t(lang, "alert_stable_message"),
            recommendation=_t(lang, "alert_stable_reco"),
        )

    deduped_recommendations = list(dict.fromkeys([item.strip() for item in recommendations if item.strip()]))
    return alerts, deduped_recommendations


def _normalize_forecast(
    raw_payload: dict[str, Any],
    lang: str,
) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, float]]:
    current_raw = raw_payload.get("current", {})
    daily_raw = raw_payload.get("daily", {})
    hourly_raw = raw_payload.get("hourly", {})

    current_code = _as_int(current_raw.get("weather_code"), 0)
    current_label, current_icon = _weather_descriptor(current_code, lang)
    current = {
        "temp_c": round(_as_float(current_raw.get("temperature_2m")), 1),
        "humidity_pct": round(_as_float(current_raw.get("relative_humidity_2m")), 1),
        "rain_mm": round(_as_float(current_raw.get("rain")), 1),
        "wind_kph": round(_as_float(current_raw.get("wind_speed_10m")), 1),
        "weather_code": current_code,
        "condition": current_label,
        "icon": current_icon,
    }

    daily_dates = _as_list(daily_raw.get("time"))
    daily_codes = _as_list(daily_raw.get("weather_code"))
    daily_tmax = _as_list(daily_raw.get("temperature_2m_max"))
    daily_tmin = _as_list(daily_raw.get("temperature_2m_min"))
    daily_rain = _as_list(daily_raw.get("precipitation_sum"))
    daily_wind = _as_list(daily_raw.get("wind_speed_10m_max"))
    daily_humidity = _as_list(daily_raw.get("relative_humidity_2m_mean"))

    limit = min(7, len(daily_dates))
    forecast: list[dict[str, Any]] = []
    for idx in range(limit):
        weather_code = _as_int(_safe_at(daily_codes, idx, 0))
        label, icon = _weather_descriptor(weather_code, lang)
        forecast.append(
            {
                "date": _safe_at(daily_dates, idx, ""),
                "weather_code": weather_code,
                "condition": label,
                "icon": icon,
                "temp_max_c": round(_as_float(_safe_at(daily_tmax, idx, 0.0)), 1),
                "temp_min_c": round(_as_float(_safe_at(daily_tmin, idx, 0.0)), 1),
                "rain_mm": round(_as_float(_safe_at(daily_rain, idx, 0.0)), 1),
                "wind_kph": round(_as_float(_safe_at(daily_wind, idx, 0.0)), 1),
                "humidity_pct": round(_as_float(_safe_at(daily_humidity, idx, 0.0)), 1),
            }
        )

    hourly_precip = [_as_float(v) for v in _as_list(hourly_raw.get("precipitation"))[:24]]
    hourly_wind = [_as_float(v) for v in _as_list(hourly_raw.get("wind_speed_10m"))[:24]]
    hourly_temp = [_as_float(v) for v in _as_list(hourly_raw.get("temperature_2m"))[:24]]

    analytics = {
        "rain_next_24h_mm": _sum(hourly_precip),
        "max_wind_next_24h_kph": _max(hourly_wind),
        "avg_temp_next_24h_c": _mean(hourly_temp),
        "weekly_rain_mm": _sum([_as_float(day.get("rain_mm")) for day in forecast]),
        "weekly_max_temp_c": _max([_as_float(day.get("temp_max_c")) for day in forecast]),
        "weekly_min_temp_c": _min([_as_float(day.get("temp_min_c")) for day in forecast]),
    }

    return current, forecast, analytics


def build_weather_intelligence_payload(
    *,
    raw_payload: dict[str, Any],
    latitude: float,
    longitude: float,
    lang: str = "en",
) -> dict[str, Any]:
    normalized_lang = _normalize_lang(lang)
    current, forecast, analytics = _normalize_forecast(raw_payload, normalized_lang)
    alerts, recommendations = _build_alerts(
        current=current,
        forecast=forecast,
        analytics=analytics,
        lang=normalized_lang,
    )

    return {
        "location": {
            "latitude": round(latitude, 4),
            "longitude": round(longitude, 4),
            "timezone": raw_payload.get("timezone", "auto"),
        },
        "current": current,
        "forecast": forecast,
        "analytics": analytics,
        "alerts": alerts,
        "recommendations": recommendations,
        "meta": {
            "provider": "open-meteo",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "live",
            "degraded": False,
            "lang": normalized_lang,
        },
    }


def build_offline_fallback_payload(
    *,
    latitude: float,
    longitude: float,
    reason: str | None = None,
    lang: str = "en",
) -> dict[str, Any]:
    normalized_lang = _normalize_lang(lang)
    today = date.today()
    forecast = []
    for idx in range(7):
        day = today + timedelta(days=idx)
        forecast.append(
            {
                "date": day.isoformat(),
                "weather_code": -1,
                "condition": _t(normalized_lang, "cond_unavailable"),
                "icon": "fas fa-question-circle",
                "temp_max_c": None,
                "temp_min_c": None,
                "rain_mm": None,
                "wind_kph": None,
                "humidity_pct": None,
            }
        )

    return {
        "location": {
            "latitude": round(latitude, 4),
            "longitude": round(longitude, 4),
            "timezone": "auto",
        },
        "current": {
            "temp_c": None,
            "humidity_pct": None,
            "rain_mm": None,
            "wind_kph": None,
            "weather_code": -1,
            "condition": _t(normalized_lang, "cond_data_unavailable"),
            "icon": "fas fa-question-circle",
        },
        "forecast": forecast,
        "analytics": {
            "rain_next_24h_mm": 0.0,
            "max_wind_next_24h_kph": 0.0,
            "avg_temp_next_24h_c": 0.0,
            "weekly_rain_mm": 0.0,
            "weekly_max_temp_c": 0.0,
            "weekly_min_temp_c": 0.0,
        },
        "alerts": [
            {
                "level": "warning",
                "color": ALERT_COLORS["warning"],
                "title": _t(normalized_lang, "fallback_alert_title"),
                "message": _t(normalized_lang, "fallback_alert_message"),
                "recommendation": _t(normalized_lang, "fallback_alert_reco"),
            }
        ],
        "recommendations": [
            _t(normalized_lang, "fallback_reco_1"),
            _t(normalized_lang, "fallback_reco_2"),
        ],
        "meta": {
            "provider": "open-meteo",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "fallback",
            "degraded": True,
            "reason": reason or _t(normalized_lang, "fallback_reason"),
            "lang": normalized_lang,
        },
    }
