import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from dotenv import load_dotenv

_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env")
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


def normalize_database_url(raw_url: str | None) -> str | None:
    """Normalize PostgreSQL schemes and ensure Neon endpoints enforce TLS."""
    url = (raw_url or "").strip()
    if not url:
        return None
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]

    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        if host.endswith(".neon.tech"):
            query = dict(parse_qsl(parsed.query, keep_blank_values=True))
            if "sslmode" not in query:
                query["sslmode"] = "require"
                url = urlunparse(parsed._replace(query=urlencode(query)))
    except ValueError:
        return url
    return url


def get_unpooled_database_url(raw_url: str | None = None) -> str | None:
    """Resolve Neon's direct (non-pooler) URL from DATABASE_URL_UNPOOLED or MIGRATION_DATABASE_URL."""
    candidate = raw_url if raw_url is not None else (
        os.getenv("DATABASE_URL_UNPOOLED") or os.getenv("MIGRATION_DATABASE_URL")
    )
    return normalize_database_url(candidate)


def build_sqlalchemy_engine_options(db_uri: str | None) -> dict:
    """Build SQLAlchemy pooling options tuned for Neon serverless PostgreSQL."""
    uri = (db_uri or "").strip().lower()
    if not uri or uri.startswith("sqlite"):
        return {}
    return {
        "pool_pre_ping": True,
        "pool_recycle": max(30, _int_env("DB_POOL_RECYCLE", 280)),
        "pool_size": max(1, _int_env("DB_POOL_SIZE", 5)),
        "max_overflow": max(0, _int_env("DB_MAX_OVERFLOW", 10)),
        "pool_timeout": max(5, _int_env("DB_POOL_TIMEOUT", 30)),
        "connect_args": {
            "connect_timeout": max(3, _int_env("DB_CONNECT_TIMEOUT", 10)),
        },
    }


def is_render_environment() -> bool:
    """Return True when running inside Render managed hosting."""
    return os.getenv("RENDER", "").strip().lower() == "true" or bool(
        os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
        or os.getenv("RENDER_SERVICE_ID", "").strip()
    )


def resolve_redis_url(primary_env: str, default: str = "") -> str:
    """Resolve Redis URL from primary_env, falling back to shared REDIS_URL without mutating DB index."""
    primary = os.getenv(primary_env, "").strip()
    if primary:
        return primary
    shared = os.getenv("REDIS_URL", "").strip()
    if shared:
        return shared
    return default


def get_cors_allowed_origins() -> list[str]:
    """Return explicitly allowed CORS origins without permitting credentialed wildcards."""
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
    if raw:
        return list(
            dict.fromkeys(
                origin.strip().rstrip("/")
                for origin in raw.split(",")
                if origin.strip()
            )
        )

    origins: list[str] = []
    app_domain = os.getenv("APP_DOMAIN", "").strip().lower().lstrip(".")
    if app_domain and app_domain not in {"example.com", "your-domain.com"}:
        origins.append(f"https://{app_domain}")
        if not app_domain.startswith("www."):
            origins.append(f"https://www.{app_domain}")
        elif len(app_domain) > 4:
            origins.append(f"https://{app_domain[4:]}")

    render_external_url = os.getenv("RENDER_EXTERNAL_URL", "").strip().rstrip("/")
    if render_external_url:
        origins.append(render_external_url)

    render_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip().lower()
    if render_hostname:
        origins.append(f"https://{render_hostname}")

    is_prod = os.getenv("FLASK_ENV", "development").strip().lower() == "production" or is_render_environment()
    if not is_prod:
        origins.extend(
            [
                "http://localhost:5000",
                "http://127.0.0.1:5000",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ]
        )

    return list(dict.fromkeys(origins))


class Config:
    MAX_CONTENT_LENGTH = max(1024, _int_env("MAX_CONTENT_LENGTH", 16 * 1024 * 1024))
    # memory:// is for single-process development; Docker uses shared Redis.
    RATELIMIT_STORAGE_URI = resolve_redis_url("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_STRATEGY = "fixed-window"
    RATELIMIT_SWALLOW_ERRORS = False
    RATELIMIT_IN_MEMORY_FALLBACK_ENABLED = False
    RATELIMIT_KEY_PREFIX = "agri"
    RATE_LIMIT_GLOBAL = os.getenv("RATE_LIMIT_GLOBAL", "300 per minute;3000 per hour")
    RATE_LIMIT_AUTH = os.getenv("RATE_LIMIT_AUTH", "10 per minute;100 per hour")
    RATE_LIMIT_RECOVERY = os.getenv("RATE_LIMIT_RECOVERY", "5 per minute;20 per hour")
    RATE_LIMIT_EXPENSIVE = os.getenv("RATE_LIMIT_EXPENSIVE", "30 per minute;300 per hour")
    # Only trust forwarded client IPs when an ingress proxy is explicitly configured.
    TRUSTED_PROXY_COUNT = max(0, _int_env("TRUSTED_PROXY_COUNT", 1 if is_render_environment() else 0))
    TRUSTED_PROTO_PROXY_COUNT = max(0, _int_env("TRUSTED_PROTO_PROXY_COUNT", 1 if TRUSTED_PROXY_COUNT > 0 else 0))
    TRUSTED_HOST_PROXY_COUNT = max(0, _int_env("TRUSTED_HOST_PROXY_COUNT", 1 if TRUSTED_PROXY_COUNT > 0 else 0))
    TRUSTED_PREFIX_PROXY_COUNT = max(0, _int_env("TRUSTED_PREFIX_PROXY_COUNT", 1 if TRUSTED_PROXY_COUNT > 0 else 0))
    CORS_ALLOWED_ORIGINS = get_cors_allowed_origins()

    SECRET_KEY = os.getenv("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = normalize_database_url(os.getenv("DATABASE_URL"))
    DATABASE_URL_UNPOOLED = get_unpooled_database_url()
    SQLALCHEMY_ENGINE_OPTIONS = build_sqlalchemy_engine_options(SQLALCHEMY_DATABASE_URI)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

    # Flask connects only to the owner's self-trained remote model and never
    # loads model weights or exposes the inference token to web/mobile clients.
    AI_PROVIDER = "own-ai"
    HF_INFERENCE_URL = (os.getenv("HF_INFERENCE_URL", "") or "").strip()
    HUGGINGFACE_INFERENCE_URL = (os.getenv("HUGGINGFACE_INFERENCE_URL", "") or "").strip()
    HF_TOKEN = (os.getenv("HF_TOKEN", "") or "").strip()
    HUGGINGFACEHUB_API_TOKEN = (os.getenv("HUGGINGFACEHUB_API_TOKEN", "") or "").strip()
    AI_REQUEST_TIMEOUT_SECONDS = max(2.0, _float_env("AI_REQUEST_TIMEOUT_SECONDS", 30.0))
    AI_LEGACY_FALLBACK_ENABLED = False

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
    # Blank reuses session Redis in production; local development stays in memory.
    WEATHER_REDIS_URL = resolve_redis_url("WEATHER_REDIS_URL", "")

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
    SESSION_TYPE = (os.getenv("SESSION_TYPE") or "").strip() or (
        "redis" if (is_render_environment() and bool(os.getenv("REDIS_URL", "").strip())) else "cachelib"
    )
    SESSION_REDIS_URL = resolve_redis_url("SESSION_REDIS_URL", "redis://localhost:6379/1")
    SESSION_KEY_PREFIX = "agri:session:"
    SESSION_ID_LENGTH = 32
    SESSION_PERMANENT = True
    SESSION_IDLE_TIMEOUT_SECONDS = max(60, _int_env("SESSION_IDLE_TIMEOUT_SECONDS", 15 * 24 * 60 * 60))
    SESSION_ABSOLUTE_TIMEOUT_SECONDS = max(60, _int_env("SESSION_ABSOLUTE_TIMEOUT_SECONDS", 15 * 24 * 60 * 60))
    PERMANENT_SESSION_LIFETIME = timedelta(seconds=SESSION_ABSOLUTE_TIMEOUT_SECONDS)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = ((os.getenv("SESSION_COOKIE_SECURE") or "").strip() or "true").lower() == "true"
    # Same-site Render / Cloudflare hosting defaults to Lax; keep None only for cross-site iframes.
    SESSION_COOKIE_SAMESITE = (os.getenv("SESSION_COOKIE_SAMESITE") or "").strip() or (
        "Lax" if is_render_environment() else "None"
    )
    SESSION_COOKIE_DOMAIN = None
    SESSION_COOKIE_PATH = "/"
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SECURE = SESSION_COOKIE_SECURE
    REMEMBER_COOKIE_SAMESITE = SESSION_COOKIE_SAMESITE
    REMEMBER_COOKIE_REFRESH_EACH_REQUEST = False
