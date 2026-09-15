import os
from dotenv import load_dotenv

load_dotenv()


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _float_env(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


class Config:
    MAX_CONTENT_LENGTH = max(1024, _int_env("MAX_CONTENT_LENGTH", 16 * 1024 * 1024))
    # memory:// is for single-process development; Docker uses shared Redis.
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_STRATEGY = "fixed-window"
    RATELIMIT_SWALLOW_ERRORS = False
    RATELIMIT_IN_MEMORY_FALLBACK_ENABLED = False
    RATELIMIT_KEY_PREFIX = "agri"
    RATE_LIMIT_GLOBAL = os.getenv("RATE_LIMIT_GLOBAL", "300 per minute;3000 per hour")
    RATE_LIMIT_AUTH = os.getenv("RATE_LIMIT_AUTH", "10 per minute;100 per hour")
    RATE_LIMIT_RECOVERY = os.getenv("RATE_LIMIT_RECOVERY", "5 per minute;20 per hour")
    RATE_LIMIT_EXPENSIVE = os.getenv("RATE_LIMIT_EXPENSIVE", "30 per minute;300 per hour")
    # Only trust forwarded client IPs when an ingress proxy is explicitly configured.
    TRUSTED_PROXY_COUNT = max(0, _int_env("TRUSTED_PROXY_COUNT", 0))

    SECRET_KEY = os.getenv("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

    # Weather intelligence microservice settings.
    WEATHER_PROVIDER_BASE_URL = os.getenv(
        "WEATHER_PROVIDER_BASE_URL",
        "https://api.open-meteo.com/v1/forecast",
    )
    WEATHER_CACHE_TTL_SECONDS = max(300, _int_env("WEATHER_CACHE_TTL_SECONDS", 600))
    WEATHER_STALE_TTL_SECONDS = max(
        WEATHER_CACHE_TTL_SECONDS,
        _int_env("WEATHER_STALE_TTL_SECONDS", 21600),
    )
    WEATHER_REQUEST_TIMEOUT_SECONDS = max(2.0, _float_env("WEATHER_REQUEST_TIMEOUT_SECONDS", 6.0))

    # Dynamic theme manager seasonal automation.
    THEME_EVENTS_PROVIDER = (os.getenv("THEME_EVENTS_PROVIDER", "auto") or "auto").strip().lower()
    THEME_EVENTS_DEFAULT_COUNTRY = (
        os.getenv("THEME_EVENTS_DEFAULT_COUNTRY", "KH") or "KH"
    ).strip().upper()
    CALENDARIFIC_API_KEY = (os.getenv("CALENDARIFIC_API_KEY", "") or "").strip()

    # Theme animation auto-upload pipeline.
    THEME_ANIMATION_CDN_PROVIDER = (
        os.getenv("THEME_ANIMATION_CDN_PROVIDER", "auto") or "auto"
    ).strip().lower()
    THEME_ANIMATION_MAX_BYTES = max(64 * 1024, _int_env("THEME_ANIMATION_MAX_BYTES", 2 * 1024 * 1024))
    CLOUDINARY_CLOUD_NAME = (os.getenv("CLOUDINARY_CLOUD_NAME", "") or "").strip()
    CLOUDINARY_UPLOAD_PRESET = (os.getenv("CLOUDINARY_UPLOAD_PRESET", "") or "").strip()
    CLOUDINARY_UPLOAD_FOLDER = (os.getenv("CLOUDINARY_UPLOAD_FOLDER", "agri-theme-animations") or "").strip()

    # Opaque server-side sessions; production Compose supplies Redis.
    from datetime import timedelta
    SESSION_TYPE = os.getenv("SESSION_TYPE", "cachelib")
    SESSION_REDIS_URL = os.getenv("SESSION_REDIS_URL", "redis://localhost:6379/1")
    SESSION_KEY_PREFIX = "agri:session:"
    SESSION_ID_LENGTH = 32
    SESSION_PERMANENT = True
    SESSION_IDLE_TIMEOUT_SECONDS = max(60, _int_env("SESSION_IDLE_TIMEOUT_SECONDS", 1800))
    SESSION_ABSOLUTE_TIMEOUT_SECONDS = max(60, _int_env("SESSION_ABSOLUTE_TIMEOUT_SECONDS", 43200))
    PERMANENT_SESSION_LIFETIME = timedelta(seconds=SESSION_ABSOLUTE_TIMEOUT_SECONDS)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "true").lower() == "true"
    # Preserve the existing cross-site frontend; same-site deployments can use Lax.
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "None")
    SESSION_COOKIE_DOMAIN = None
    SESSION_COOKIE_PATH = "/"
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SECURE = SESSION_COOKIE_SECURE
    REMEMBER_COOKIE_SAMESITE = SESSION_COOKIE_SAMESITE
    REMEMBER_COOKIE_REFRESH_EACH_REQUEST = False
