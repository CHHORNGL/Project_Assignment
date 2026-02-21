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
