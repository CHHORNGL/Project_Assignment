"""Shared real-time support chat helpers (message serialization & short-TTL typing state)."""
from __future__ import annotations

import os
import threading
import time
from typing import Any

from flask import current_app


_LOCAL_TYPING_LOCK = threading.Lock()
_LOCAL_TYPING_STATE: dict[str, float] = {}
_REDIS_CLIENT = None
_REDIS_CLIENT_UNAVAILABLE = False


def _get_redis_client():
    global _REDIS_CLIENT, _REDIS_CLIENT_UNAVAILABLE
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    if _REDIS_CLIENT_UNAVAILABLE:
        return None

    redis_url = ""
    try:
        redis_url = str(
            current_app.config.get("SESSION_REDIS_URL")
            or current_app.config.get("WEATHER_REDIS_URL")
            or os.getenv("REDIS_URL")
            or ""
        ).strip()
    except RuntimeError:
        redis_url = str(os.getenv("REDIS_URL") or "").strip()

    if not redis_url:
        _REDIS_CLIENT_UNAVAILABLE = True
        return None

    try:
        from redis import Redis

        client = Redis.from_url(redis_url, socket_connect_timeout=0.4, socket_timeout=0.4)
        client.ping()
        _REDIS_CLIENT = client
        return client
    except Exception:
        _REDIS_CLIENT_UNAVAILABLE = True
        return None


def _typing_key(sender_id: int, target_id: int) -> str:
    return f"agri:support:typing:{int(sender_id)}:{int(target_id)}"


def set_typing(sender_id: int, target_id: int, ttl_seconds: int = 5) -> None:
    """Record that sender_id is actively typing to target_id for ttl_seconds."""
    key = _typing_key(sender_id, target_id)
    ttl = max(2, min(int(ttl_seconds), 15))
    client = _get_redis_client()
    if client is not None:
        try:
            client.setex(key, ttl, "1")
            return
        except Exception:
            pass

    expires_at = time.monotonic() + ttl
    with _LOCAL_TYPING_LOCK:
        _LOCAL_TYPING_STATE[key] = expires_at


def clear_typing(sender_id: int, target_id: int) -> None:
    """Clear typing indicator immediately after a message is sent."""
    key = _typing_key(sender_id, target_id)
    client = _get_redis_client()
    if client is not None:
        try:
            client.delete(key)
        except Exception:
            pass

    with _LOCAL_TYPING_LOCK:
        _LOCAL_TYPING_STATE.pop(key, None)


def is_typing(sender_id: int, target_id: int) -> bool:
    """Return True if sender_id has an active typing heartbeat toward target_id."""
    key = _typing_key(sender_id, target_id)
    client = _get_redis_client()
    if client is not None:
        try:
            return bool(client.get(key))
        except Exception:
            pass

    now = time.monotonic()
    with _LOCAL_TYPING_LOCK:
        expires_at = _LOCAL_TYPING_STATE.get(key)
        if expires_at is None:
            return False
        if expires_at < now:
            _LOCAL_TYPING_STATE.pop(key, None)
            return False
        return True


def serialize_chat_message(msg: Any) -> dict[str, Any]:
    """Serialize AdminChatMessage rows consistently for admin and farmer APIs."""
    created_at = getattr(msg, "created_at", None)
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "receiver_id": getattr(msg, "receiver_id", None),
        "message": msg.message,
        "attachment_url": msg.attachment_url,
        "attachment_type": msg.attachment_type,
        "is_read": bool(getattr(msg, "is_read", False)),
        "created_at": created_at.strftime("%Y-%m-%d %H:%M:%S") if created_at else "",
    }
