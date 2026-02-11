from __future__ import annotations

from functools import lru_cache

from flask import Blueprint, current_app, jsonify, request

from app.services.weather_intelligence.cache import TTLWeatherCache
from app.services.weather_intelligence.client import OpenMeteoClient
from app.services.weather_intelligence.service import (
    WeatherIntelligenceService,
    WeatherServiceError,
)
from app.utils.decorators import farmer_required
from app.utils.i18n import get_current_language


weather_intelligence_bp = Blueprint(
    "weather_intelligence",
    __name__,
    url_prefix="/weather-intelligence",
)

_shared_cache = TTLWeatherCache(max_items=600)


@lru_cache(maxsize=4)
def _get_client(base_url: str, timeout_seconds: float) -> OpenMeteoClient:
    return OpenMeteoClient(
        base_url=base_url,
        timeout_seconds=timeout_seconds,
    )


def _get_service() -> WeatherIntelligenceService:
    base_url = str(
        current_app.config.get("WEATHER_PROVIDER_BASE_URL", "https://api.open-meteo.com/v1/forecast")
    ).strip()
    timeout_seconds = float(current_app.config.get("WEATHER_REQUEST_TIMEOUT_SECONDS", 6.0))
    cache_ttl = int(current_app.config.get("WEATHER_CACHE_TTL_SECONDS", 600))
    stale_ttl = int(current_app.config.get("WEATHER_STALE_TTL_SECONDS", 21600))

    return WeatherIntelligenceService(
        client=_get_client(base_url, timeout_seconds),
        cache=_shared_cache,
        cache_ttl_seconds=cache_ttl,
        stale_ttl_seconds=stale_ttl,
    )


@weather_intelligence_bp.get("/api/v1/summary")
@farmer_required
def weather_summary():
    latitude = request.args.get("lat", type=float)
    longitude = request.args.get("lon", type=float)
    lang_param = (request.args.get("lang", type=str) or "").strip().lower()

    if latitude is None or longitude is None:
        return (
            jsonify(
                {
                    "error": "invalid_coordinates",
                    "message": "lat and lon query parameters are required.",
                }
            ),
            400,
        )

    try:
        lang = lang_param if lang_param in {"en", "km"} else get_current_language()
        payload, source = _get_service().get_weather_summary(
            latitude=latitude,
            longitude=longitude,
            lang=lang,
        )
    except WeatherServiceError as exc:
        return jsonify({"error": "invalid_request", "message": str(exc)}), 400

    response = jsonify(payload)
    response.headers["Cache-Control"] = "private, max-age=120, stale-while-revalidate=120"
    response.headers["X-Weather-Source"] = source
    if payload.get("meta", {}).get("degraded"):
        response.headers["Warning"] = '110 - "Using stale or fallback weather intelligence data"'
    return response
