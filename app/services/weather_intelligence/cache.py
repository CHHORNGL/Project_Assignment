from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import logging
from threading import Lock
from typing import Any

from redis.exceptions import RedisError


@dataclass(frozen=True)
class CacheEntry:
    payload: dict[str, Any]
    fetched_at: datetime


class TTLWeatherCache:
    """Thread-safe in-memory TTL cache for weather payloads."""

    def __init__(self, max_items: int = 500):
        self._max_items = max_items
        self._items: dict[str, CacheEntry] = {}
        self._lock = Lock()

    def get_fresh(self, key: str, ttl_seconds: int) -> CacheEntry | None:
        now = datetime.now(timezone.utc)
        with self._lock:
            entry = self._items.get(key)
            if not entry:
                return None
            age_seconds = (now - entry.fetched_at).total_seconds()
            if age_seconds > ttl_seconds:
                return None
            return entry

    def get_stale(self, key: str, max_age_seconds: int) -> CacheEntry | None:
        now = datetime.now(timezone.utc)
        with self._lock:
            entry = self._items.get(key)
            if not entry:
                return None
            age_seconds = (now - entry.fetched_at).total_seconds()
            if age_seconds > max_age_seconds:
                return None
            return entry

    def set(self, key: str, payload: dict[str, Any]) -> None:
        entry = CacheEntry(payload=payload, fetched_at=datetime.now(timezone.utc))
        with self._lock:
            self._items[key] = entry
            if len(self._items) > self._max_items:
                # Remove oldest entries first to prevent unbounded growth.
                ordered = sorted(self._items.items(), key=lambda item: item[1].fetched_at)
                for victim_key, _ in ordered[: max(1, len(self._items) - self._max_items)]:
                    self._items.pop(victim_key, None)


class RedisWeatherCache(TTLWeatherCache):
    """Share forecasts and provider cooldowns; retain a local outage fallback."""

    def __init__(self, redis_client, *, prefix: str, retention_seconds: int):
        super().__init__(max_items=600)
        self._redis = redis_client
        self._prefix = prefix
        self._retention_seconds = max(86400, retention_seconds)

    def _read(self, key: str, ttl_seconds: int) -> CacheEntry | None:
        try:
            raw = self._redis.get(self._prefix + key)
            if raw:
                data = json.loads(raw)
                entry = CacheEntry(data["payload"], datetime.fromisoformat(data["fetched_at"]))
                age = (datetime.now(timezone.utc) - entry.fetched_at).total_seconds()
                if isinstance(entry.payload, dict) and 0 <= age <= ttl_seconds:
                    return entry
        except (RedisError, ValueError, KeyError, TypeError):
            logging.getLogger(__name__).warning("Weather Redis cache unavailable or invalid; using local cache")
        return super().get_stale(key, ttl_seconds)

    def get_fresh(self, key: str, ttl_seconds: int) -> CacheEntry | None:
        return self._read(key, ttl_seconds)

    def get_stale(self, key: str, max_age_seconds: int) -> CacheEntry | None:
        return self._read(key, max_age_seconds)

    def set(self, key: str, payload: dict[str, Any]) -> None:
        super().set(key, payload)
        entry = super().get_fresh(key, self._retention_seconds)
        try:
            self._redis.setex(
                self._prefix + key,
                self._retention_seconds,
                json.dumps({"payload": entry.payload, "fetched_at": entry.fetched_at.isoformat()}),
            )
        except RedisError:
            logging.getLogger(__name__).warning("Weather Redis write unavailable; retaining local cache")
