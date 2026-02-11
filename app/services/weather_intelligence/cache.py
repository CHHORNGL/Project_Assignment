from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Any


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
