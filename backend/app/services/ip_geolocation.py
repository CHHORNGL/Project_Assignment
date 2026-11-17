"""IP address geolocation resolver with Redis + bounded memory caching."""

from __future__ import annotations

import ipaddress
import json
import urllib.request
from collections.abc import Iterable, Mapping
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

from flask import current_app, has_app_context

_COUNTRY_NAMES = {
    "KH": "Cambodia",
    "SG": "Singapore",
    "TH": "Thailand",
    "VN": "Vietnam",
    "LA": "Laos",
    "MY": "Malaysia",
    "ID": "Indonesia",
    "PH": "Philippines",
    "US": "United States",
    "GB": "United Kingdom",
    "AU": "Australia",
    "JP": "Japan",
    "KR": "South Korea",
    "CN": "China",
    "TW": "Taiwan",
    "HK": "Hong Kong",
    "IN": "India",
    "FR": "France",
    "DE": "Germany",
    "CA": "Canada",
}

_IP_GEO_LOCK = Lock()
_IP_GEO_CACHE: dict[str, str | None] = {}
_IP_GEO_CACHE_MAX = 4000
_REDIS_PREFIX = "agri:ipgeo:"
_POSITIVE_TTL_SECONDS = 7 * 24 * 60 * 60
_NEGATIVE_TTL_SECONDS = 10 * 60
_NEGATIVE_SENTINEL = "__NONE__"


def normalize_country_name(country: str | None) -> str:
    raw = (country or "").strip()
    if not raw or raw.upper() in {"XX", "T1"}:
        return ""
    if len(raw) == 2:
        return _COUNTRY_NAMES.get(raw.upper(), raw.upper())
    return raw


def format_location_parts(city: str | None = None, region: str | None = None, country: str | None = None) -> str | None:
    city_clean = (city or "").strip()
    region_clean = (region or "").strip()
    country_clean = normalize_country_name(country)

    parts: list[str] = []
    if city_clean:
        parts.append(city_clean)
    elif region_clean:
        parts.append(region_clean)
    if country_clean and country_clean not in parts:
        parts.append(country_clean)

    if not parts:
        return None
    return ", ".join(parts)[:80]


def is_private_or_local_ip(ip_address: str | None) -> bool:
    clean = (ip_address or "").strip()
    if not clean or clean in {"-", "localhost"}:
        return True
    try:
        ip_obj = ipaddress.ip_address(clean)
        return bool(
            ip_obj.is_private
            or ip_obj.is_loopback
            or ip_obj.is_link_local
            or ip_obj.is_reserved
            or ip_obj.is_multicast
            or ip_obj.is_unspecified
        )
    except ValueError:
        return True


def resolve_header_location(headers: Mapping[str, str] | None) -> str | None:
    """Resolve approximate city/country from trusted CDN geolocation headers if present."""
    if not headers:
        return None
    city = headers.get("CF-IPCity") or headers.get("X-Vercel-IP-City") or ""
    region = headers.get("CF-Region") or headers.get("CF-Region-Code") or ""
    country = headers.get("CF-IPCountry") or headers.get("X-Vercel-IP-Country") or ""
    return format_location_parts(city=city, region=region, country=country)


def _lookup_ip_geolocation(ip_address: str) -> str | None:
    clean = (ip_address or "").strip()
    if is_private_or_local_ip(clean):
        return "Local Network"

    try:
        url = f"http://ip-api.com/json/{clean}?fields=status,country,regionName,city"
        req = urllib.request.Request(url, headers={"User-Agent": "AgriSystem/2.0 (Session Security)"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        if isinstance(payload, dict) and payload.get("status") == "success":
            loc = format_location_parts(
                city=payload.get("city"),
                region=payload.get("regionName"),
                country=payload.get("country"),
            )
            if loc:
                return loc
    except Exception:  # noqa: BLE001, S110
        pass

    try:
        url = f"https://ipwho.is/{clean}"
        req = urllib.request.Request(url, headers={"User-Agent": "AgriSystem/2.0 (Session Security)"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        if isinstance(payload, dict) and payload.get("success") is not False:
            loc = format_location_parts(
                city=payload.get("city"),
                region=payload.get("region"),
                country=payload.get("country"),
            )
            if loc:
                return loc
    except Exception:  # noqa: BLE001, S110
        pass

    return None


def _get_redis_client():
    if not has_app_context():
        return None
    return current_app.config.get("SESSION_REDIS")


def resolve_ip_location(ip_address: str | None, *, allow_network: bool = True) -> str | None:
    clean = (ip_address or "").strip()
    if is_private_or_local_ip(clean):
        if clean and clean != "-":
            return "Local Network"
        return None

    with _IP_GEO_LOCK:
        if clean in _IP_GEO_CACHE:
            return _IP_GEO_CACHE[clean]

    redis_client = _get_redis_client()
    if redis_client:
        try:
            raw = redis_client.get(f"{_REDIS_PREFIX}{clean}")
            if raw is not None:
                decoded = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
                val = None if decoded == _NEGATIVE_SENTINEL else decoded
                with _IP_GEO_LOCK:
                    if len(_IP_GEO_CACHE) >= _IP_GEO_CACHE_MAX:
                        _IP_GEO_CACHE.clear()
                    _IP_GEO_CACHE[clean] = val
                return val
        except Exception:  # noqa: BLE001, S110
            pass

    if not allow_network:
        return None

    if has_app_context() and current_app.config.get("TESTING"):
        return None

    resolved = _lookup_ip_geolocation(clean)
    with _IP_GEO_LOCK:
        if len(_IP_GEO_CACHE) >= _IP_GEO_CACHE_MAX:
            _IP_GEO_CACHE.clear()
        _IP_GEO_CACHE[clean] = resolved

    if redis_client:
        try:
            redis_client.set(
                f"{_REDIS_PREFIX}{clean}",
                resolved if resolved else _NEGATIVE_SENTINEL,
                ex=_POSITIVE_TTL_SECONDS if resolved else _NEGATIVE_TTL_SECONDS,
            )
        except Exception:  # noqa: BLE001, S110
            pass

    return resolved


def resolve_ip_locations_batch(
    ip_addresses: Iterable[str | None],
    *,
    allow_network: bool = True,
    max_uncached_lookups: int = 8,
) -> dict[str, str | None]:
    unique_ips = []
    seen = set()
    for raw in ip_addresses:
        clean = (raw or "").strip()
        if clean and clean != "-" and clean not in seen:
            seen.add(clean)
            unique_ips.append(clean)

    results: dict[str, str | None] = {}
    uncached: list[str] = []
    for ip in unique_ips:
        cached_only = resolve_ip_location(ip, allow_network=False)
        if cached_only is not None or is_private_or_local_ip(ip):
            results[ip] = cached_only
        else:
            with _IP_GEO_LOCK:
                already_negative = ip in _IP_GEO_CACHE and _IP_GEO_CACHE[ip] is None
            if (
                already_negative
                or not allow_network
                or (has_app_context() and current_app.config.get("TESTING"))
            ):
                results[ip] = None
            else:
                uncached.append(ip)

    if uncached:
        targets = uncached[:max(1, int(max_uncached_lookups))]
        if len(targets) == 1:
            results[targets[0]] = resolve_ip_location(targets[0], allow_network=True)
        else:
            redis_client = _get_redis_client()

            def _fetch(target_ip: str):
                return target_ip, _lookup_ip_geolocation(target_ip)

            with ThreadPoolExecutor(max_workers=min(4, len(targets))) as executor:
                for target_ip, resolved in executor.map(_fetch, targets):
                    results[target_ip] = resolved
                    with _IP_GEO_LOCK:
                        if len(_IP_GEO_CACHE) >= _IP_GEO_CACHE_MAX:
                            _IP_GEO_CACHE.clear()
                        _IP_GEO_CACHE[target_ip] = resolved
                    if redis_client:
                        try:
                            redis_client.set(
                                f"{_REDIS_PREFIX}{target_ip}",
                                resolved if resolved else _NEGATIVE_SENTINEL,
                                ex=_POSITIVE_TTL_SECONDS if resolved else _NEGATIVE_TTL_SECONDS,
                            )
                        except Exception:  # noqa: BLE001, S110
                            pass

    return results
