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
