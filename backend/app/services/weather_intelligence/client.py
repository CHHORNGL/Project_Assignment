from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import requests


OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


class WeatherProviderError(Exception):
    """Raised when upstream weather provider data cannot be fetched or parsed."""

    def __init__(self, message: str, *, code: str = "provider_unavailable", retry_after: int = 60):
        super().__init__(message)
        self.code = code
        self.retry_after = retry_after


def _retry_after(value: str | None) -> int:
    try:
        seconds = int(value)
    except (TypeError, ValueError):
        try:
            seconds = int((parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())
        except (TypeError, ValueError, OverflowError):
            seconds = 900
    return max(60, min(seconds, 86400))


@dataclass(frozen=True)
class WeatherRequest:
    latitude: float
    longitude: float
    timezone: str = "auto"
    days: int = 7


class OpenMeteoClient:
    def __init__(
        self,
        *,
        base_url: str = OPEN_METEO_FORECAST_URL,
        timeout_seconds: float = 6.0,
        session: requests.Session | None = None,
    ) -> None:
        self._base_url = base_url
        self._timeout_seconds = timeout_seconds
        self._session = session or requests.Session()

    def fetch_forecast(self, weather_request: WeatherRequest) -> dict[str, Any]:
        params = {
            "latitude": weather_request.latitude,
            "longitude": weather_request.longitude,
            "timezone": weather_request.timezone,
            "forecast_days": max(1, min(weather_request.days, 7)),
            "temperature_unit": "celsius",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
            "current": ",".join(
                [
                    "temperature_2m",
                    "relative_humidity_2m",
                    "rain",
                    "wind_speed_10m",
                    "weather_code",
                ]
            ),
            "hourly": ",".join(
                [
                    "precipitation",
                    "wind_speed_10m",
                    "temperature_2m",
                ]
            ),
            "daily": ",".join(
                [
                    "weather_code",
                    "temperature_2m_max",
                    "temperature_2m_min",
                    "precipitation_sum",
                    "wind_speed_10m_max",
                    "relative_humidity_2m_mean",
                ]
            ),
        }

        try:
            response = self._session.get(
                self._base_url,
                params=params,
                timeout=self._timeout_seconds,
            )
            if response.status_code == 429:
                raise WeatherProviderError(
                    "Weather provider request limit reached",
                    code="provider_rate_limited",
                    retry_after=_retry_after(response.headers.get("Retry-After")),
                )
            response.raise_for_status()
            payload = response.json()
        except WeatherProviderError:
            raise
        except Exception as exc:  # requests exceptions are implementation details.
            raise WeatherProviderError("Weather provider is unavailable") from exc

        if not isinstance(payload, dict):
            raise WeatherProviderError("Weather provider returned invalid payload")

        current = payload.get("current")
        daily = payload.get("daily")
        hourly = payload.get("hourly")
        if not isinstance(current, dict) or not isinstance(daily, dict) or not isinstance(hourly, dict):
            raise WeatherProviderError("Weather provider payload missing forecast sections")

        return payload
