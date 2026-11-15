from __future__ import annotations

from datetime import datetime, timezone
import logging
import math
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
        backup_client=None,
    ) -> None:
        self._client = client
        self._cache = cache
        self._cache_ttl_seconds = max(60, cache_ttl_seconds)
        self._stale_ttl_seconds = max(self._cache_ttl_seconds, stale_ttl_seconds)
        self._backup_client = backup_client

    @staticmethod
    def _cache_key(latitude: float, longitude: float) -> str:
        # Share upstream data between languages as well as nearby coordinates.
        return f"forecast:{latitude:.3f}:{longitude:.3f}"

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

        key = self._cache_key(latitude, longitude)
        fresh_entry = self._cache.get_fresh(key, self._cache_ttl_seconds)
        if fresh_entry:
            return self._from_entry(fresh_entry, latitude, longitude, lang, "cache"), "cache"

        failure = self._cache.get_fresh("provider-cooldown", 86400)
        if failure:
            remaining = math.ceil(failure.payload["retry_at"] - datetime.now(timezone.utc).timestamp())
            if remaining > 0:
                return self._unavailable(key, latitude, longitude, lang, failure.payload["code"], remaining)

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
            self._cache.set(key, raw_payload)
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
            self._cache.set("provider-cooldown", {
                "code": exc.code,
                "retry_at": datetime.now(timezone.utc).timestamp() + exc.retry_after,
            })
            logging.getLogger(__name__).warning(
                "Weather provider failure: %s; retry in %ss", exc.code, exc.retry_after,
            )
            return self._unavailable(key, latitude, longitude, lang, exc.code, exc.retry_after)

    def _from_entry(self, entry, latitude, longitude, lang, source):
        payload = build_weather_intelligence_payload(
            raw_payload=entry.payload, latitude=latitude, longitude=longitude, lang=lang,
        )
        payload["meta"].update({
            "source": source,
            "degraded": source == "stale-cache",
            "generated_at": entry.fetched_at.isoformat(),
            "age_seconds": self._age_seconds(entry.fetched_at),
            "cache_ttl_seconds": self._cache_ttl_seconds,
        })
        return payload

    def _unavailable(self, key, latitude, longitude, lang, code, retry_after):
        backup = self._backup_summary(key, latitude, longitude, lang)
        if backup is not None:
            return backup
        stale_entry = self._cache.get_stale(key, self._stale_ttl_seconds)
        if stale_entry:
            payload = self._from_entry(stale_entry, latitude, longitude, lang, "stale-cache")
            source = "stale-cache"
        else:
            payload = build_offline_fallback_payload(
                latitude=latitude, longitude=longitude, reason=code, lang=lang,
            )
            source = "fallback"
        payload["meta"].update({
            "source": source,
            "degraded": True,
            "error_code": code,
            "retry_after_seconds": retry_after,
            "cache_ttl_seconds": self._cache_ttl_seconds,
        })
        return payload, source

    def _backup_summary(self, key, latitude, longitude, lang):
        if self._backup_client is None:
            return None
        backup_key = "backup:" + key
        entry = self._cache.get_stale(backup_key, 86400)
        now = datetime.now(timezone.utc).timestamp()
        if entry and entry.payload.get("_cache_until", 0) > now:
            return self._from_entry(entry, latitude, longitude, lang, "cache"), "cache"
        failure = self._cache.get_fresh("backup-provider-cooldown", 86400)
        remaining = math.ceil(failure.payload["retry_at"] - now) if failure else 0
        code = failure.payload["code"] if failure else "provider_unavailable"
        if remaining <= 0:
            try:
                raw = self._backup_client.fetch_forecast(
                    WeatherRequest(latitude=latitude, longitude=longitude, days=7),
                    previous_payload=entry.payload if entry else None,
                )
                payload = build_weather_intelligence_payload(
                    raw_payload=raw, latitude=latitude, longitude=longitude, lang=lang,
                )
                self._cache.set(backup_key, raw)
                payload["meta"].update({"age_seconds": 0, "cache_ttl_seconds": self._cache_ttl_seconds})
                return payload, "live"
            except WeatherProviderError as exc:
                code, remaining = exc.code, exc.retry_after
                self._cache.set("backup-provider-cooldown", {
                    "code": code, "retry_at": datetime.now(timezone.utc).timestamp() + remaining,
                })
                logging.getLogger(__name__).warning("Backup weather provider failure: %s", code)
        if entry and self._age_seconds(entry.fetched_at) <= self._stale_ttl_seconds:
            payload = self._from_entry(entry, latitude, longitude, lang, "stale-cache")
            payload["meta"].update({"error_code": code, "retry_after_seconds": remaining})
            return payload, "stale-cache"
        return None
