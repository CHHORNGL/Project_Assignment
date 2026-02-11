from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from .cache import TTLWeatherCache
from .client import OpenMeteoClient, WeatherProviderError, WeatherRequest
from .intelligence import (
    build_offline_fallback_payload,
    build_weather_intelligence_payload,
)


class WeatherServiceError(Exception):
    """Raised when input or service internals fail before provider request."""


class WeatherIntelligenceService:
    def __init__(
        self,
        *,
        client: OpenMeteoClient,
        cache: TTLWeatherCache,
        cache_ttl_seconds: int = 600,
        stale_ttl_seconds: int = 21600,
    ) -> None:
        self._client = client
        self._cache = cache
        self._cache_ttl_seconds = max(60, cache_ttl_seconds)
        self._stale_ttl_seconds = max(self._cache_ttl_seconds, stale_ttl_seconds)

    @staticmethod
    def _cache_key(latitude: float, longitude: float, lang: str) -> str:
        # Rounded key keeps cache hit-rate high for nearby coordinates.
        return f"{lang}:{round(latitude, 3)}:{round(longitude, 3)}"

    @staticmethod
    def _age_seconds(then_dt: datetime) -> int:
        now = datetime.now(timezone.utc)
        return max(0, int((now - then_dt).total_seconds()))

    def get_weather_summary(
        self,
        *,
        latitude: float,
        longitude: float,
        lang: str = "en",
    ) -> tuple[dict[str, Any], str]:
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            raise WeatherServiceError("Invalid latitude or longitude")

        key = self._cache_key(latitude, longitude, (lang or "en").strip().lower())
        fresh_entry = self._cache.get_fresh(key, self._cache_ttl_seconds)
        if fresh_entry:
            cached_payload = deepcopy(fresh_entry.payload)
            cached_payload.setdefault("meta", {})
            cached_payload["meta"].update(
                {
                    "source": "cache",
                    "degraded": False,
                    "age_seconds": self._age_seconds(fresh_entry.fetched_at),
                    "cache_ttl_seconds": self._cache_ttl_seconds,
                }
            )
            return cached_payload, "cache"

        try:
            raw_payload = self._client.fetch_forecast(
                WeatherRequest(latitude=latitude, longitude=longitude, days=7)
            )
            payload = build_weather_intelligence_payload(
                raw_payload=raw_payload,
                latitude=latitude,
                longitude=longitude,
                lang=lang,
            )
            self._cache.set(key, payload)
            payload.setdefault("meta", {})
            payload["meta"].update(
                {
                    "source": "live",
                    "degraded": False,
                    "age_seconds": 0,
                    "cache_ttl_seconds": self._cache_ttl_seconds,
                }
            )
            return payload, "live"
        except WeatherProviderError as exc:
            stale_entry = self._cache.get_stale(key, self._stale_ttl_seconds)
            if stale_entry:
                stale_payload = deepcopy(stale_entry.payload)
                stale_payload.setdefault("meta", {})
                stale_payload["meta"].update(
                    {
                        "source": "stale-cache",
                        "degraded": True,
                        "reason": "Using cached weather because provider is unavailable.",
                        "age_seconds": self._age_seconds(stale_entry.fetched_at),
                        "cache_ttl_seconds": self._cache_ttl_seconds,
                    }
                )
                return stale_payload, "stale-cache"

            fallback_payload = build_offline_fallback_payload(
                latitude=latitude,
                longitude=longitude,
                reason=str(exc),
                lang=lang,
            )
            fallback_payload.setdefault("meta", {})
            fallback_payload["meta"].update(
                {
                    "source": "fallback",
                    "degraded": True,
                    "age_seconds": 0,
                    "cache_ttl_seconds": self._cache_ttl_seconds,
                }
            )
            return fallback_payload, "fallback"
