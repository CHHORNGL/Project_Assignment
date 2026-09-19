from __future__ import annotations

from functools import lru_cache
from hashlib import sha256

from flask import Blueprint, current_app, jsonify, request
from redis import Redis

from app.services.weather_intelligence.cache import RedisWeatherCache, TTLWeatherCache
from app.services.weather_intelligence.client import OpenMeteoClient
from app.services.weather_intelligence.met_norway import MetNorwayClient
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

@lru_cache(maxsize=4)
def _get_client(base_url: str, timeout_seconds: float) -> OpenMeteoClient:
    return OpenMeteoClient(
        base_url=base_url,
        timeout_seconds=timeout_seconds,
    )


@lru_cache(maxsize=4)
def _get_backup_client(timeout_seconds: float) -> MetNorwayClient:
    return MetNorwayClient(timeout_seconds=timeout_seconds)


def _get_service() -> WeatherIntelligenceService:
    base_url = str(
        current_app.config.get("WEATHER_PROVIDER_BASE_URL", "https://api.open-meteo.com/v1/forecast")
    ).strip()
    timeout_seconds = float(current_app.config.get("WEATHER_REQUEST_TIMEOUT_SECONDS", 6.0))
    cache_ttl = int(current_app.config.get("WEATHER_CACHE_TTL_SECONDS", 600))
    stale_ttl = int(current_app.config.get("WEATHER_STALE_TTL_SECONDS", 21600))

    cache = current_app.extensions.get("weather_cache")
    if cache is None:
        redis_url = current_app.config.get("WEATHER_REDIS_URL")
        if not redis_url and current_app.config.get("SESSION_TYPE") == "redis":
            redis_url = current_app.config.get("SESSION_REDIS_URL")
        if redis_url:
            cache = RedisWeatherCache(
                Redis.from_url(redis_url, socket_connect_timeout=0.5, socket_timeout=0.5),
                prefix="agri:weather:v2:" + sha256(base_url.encode()).hexdigest()[:16] + ":",
                retention_seconds=stale_ttl,
            )
        else:
            cache = TTLWeatherCache(max_items=600)
        current_app.extensions["weather_cache"] = cache

    return WeatherIntelligenceService(
        client=_get_client(base_url, timeout_seconds),
        cache=cache,
        cache_ttl_seconds=cache_ttl,
        stale_ttl_seconds=stale_ttl,
        backup_client=_get_backup_client(timeout_seconds),
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
        response.headers["Cache-Control"] = "private, no-store"
    return response
