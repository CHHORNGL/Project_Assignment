"""MET Norway forecast adapter; all requests go through the shared server cache."""
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import math
from zoneinfo import ZoneInfo

import requests

from .client import WeatherProviderError, WeatherRequest, _retry_after


def _weather_code(symbol: str) -> int:
    name = symbol.split("_")[0]
    if "thunder" in name:
        return 95
    if "snow" in name or "sleet" in name:
        return 75 if "heavy" in name else 71
    if "rain" in name:
        return 65 if "heavy" in name else 61
    return {"clearsky": 0, "fair": 1, "partlycloudy": 2, "cloudy": 3, "fog": 45}.get(name, 3)


def _number(value):
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Non-finite forecast value")
    return number


class MetNorwayClient:
    def __init__(self, *, timeout_seconds=6.0, session=None):
        self._session = session or requests.Session()
        self._timeout_seconds = timeout_seconds

    def fetch_forecast(self, weather_request: WeatherRequest, *, previous_payload=None):
        headers = {"User-Agent": "AgricultureExp/1.0 https://agricultureexp.com"}
        if previous_payload and previous_payload.get("_last_modified"):
            headers["If-Modified-Since"] = previous_payload["_last_modified"]
        try:
            response = self._session.get(
                "https://api.met.no/weatherapi/locationforecast/2.0/compact",
                params={"lat": f"{weather_request.latitude:.3f}", "lon": f"{weather_request.longitude:.3f}"},
                headers=headers, timeout=self._timeout_seconds,
            )
            if response.status_code == 429:
                raise WeatherProviderError("Backup weather provider limit reached",
                    code="provider_rate_limited", retry_after=_retry_after(response.headers.get("Retry-After")))
            if response.status_code == 304 and previous_payload:
                document = previous_payload["_met_document"]
            else:
                response.raise_for_status()
                document = response.json()
            # Recompute the current hour after a 304; the unchanged model still
            # contains future samples, while yesterday's normalized values do not.
            payload = self._normalize(document, weather_request)
            payload["_met_document"] = document
            now = datetime.now(timezone.utc)
            try:
                expires = parsedate_to_datetime(response.headers["Expires"]).timestamp()
            except (KeyError, ValueError, TypeError, OverflowError):
                expires = now.timestamp() + 1800
            payload["_cache_until"] = max(now.timestamp() + 60, expires)
            payload["_last_modified"] = response.headers.get("Last-Modified") or (previous_payload or {}).get("_last_modified")
            return payload
        except WeatherProviderError:
            raise
        except (requests.RequestException, ValueError, KeyError, TypeError, IndexError) as exc:
            raise WeatherProviderError("Backup weather provider is unavailable") from exc

    @staticmethod
    def _normalize(document, weather_request):
        # The application is based in Cambodia; Open-Meteo still uses auto timezone.
        zone_name = "Asia/Phnom_Penh" if weather_request.timezone == "auto" else weather_request.timezone
        zone = ZoneInfo(zone_name)
        cutoff = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        series = sorted(document["properties"]["timeseries"], key=lambda point: point["time"])
        days = {}
        hourly = {"temperature_2m": [], "wind_speed_10m": [], "precipitation": []}
        current = None
        covered_until = cutoff
        for point in series:
            start = datetime.fromisoformat(point["time"].replace("Z", "+00:00"))
            if start < cutoff:
                continue
            data = point["data"]
            period_hours = next((hours for hours in (1, 6) if f"next_{hours}_hours" in data), None)
            if period_hours is None:
                continue  # Final sample has no forward precipitation period.
            period = data[f"next_{period_hours}_hours"]
            instant = data["instant"]["details"]
            temp = _number(instant["air_temperature"])
            wind = _number(instant["wind_speed"]) * 3.6  # m/s -> km/h
            humidity = _number(instant["relative_humidity"])
            rain_per_hour = _number(period["details"]["precipitation_amount"]) / period_hours
            code = _weather_code(period["summary"]["symbol_code"])
            if current is None:
                if start > cutoff + timedelta(hours=1):
                    raise ValueError("Forecast has no current data")
                current = {"temperature_2m": temp, "wind_speed_10m": wind,
                           "relative_humidity_2m": humidity, "rain": rain_per_hour, "weather_code": code}
            # Long-range data uses six-hour periods. Distribute rain by overlap
            # across local dates; temperatures are model samples/period extrema.
            for hour in range(period_hours):
                moment = start + timedelta(hours=hour)
                if moment < covered_until:
                    continue  # Never double-count overlapping 1h/6h periods.
                covered_until = moment + timedelta(hours=1)
                day = days.setdefault(moment.astimezone(zone).date().isoformat(), {
                    "max": [], "min": [], "humidity": [], "wind": [], "codes": [], "rain": 0,
                })
                day["max"].append(_number(period["details"].get("air_temperature_max", temp)))
                day["min"].append(_number(period["details"].get("air_temperature_min", temp)))
                day["humidity"].append(humidity)
                day["wind"].append(wind)
                day["codes"].append(code)
                day["rain"] += rain_per_hour
                if moment < cutoff + timedelta(hours=24):
                    hourly["temperature_2m"].append(temp)
                    hourly["wind_speed_10m"].append(wind)
                    hourly["precipitation"].append(rain_per_hour)
        count = max(1, min(weather_request.days, 7))
        if current is None or len(days) < count or len(hourly["temperature_2m"]) != 24:
            raise ValueError("Incomplete forecast")
        daily = {key: [] for key in (
            "time", "weather_code", "temperature_2m_max", "temperature_2m_min",
            "precipitation_sum", "wind_speed_10m_max", "relative_humidity_2m_mean",
        )}
        for date, values in sorted(days.items())[:count]:
            daily["time"].append(date)
            daily["weather_code"].append(max(values["codes"]))
            daily["temperature_2m_max"].append(max(values["max"]))
            daily["temperature_2m_min"].append(min(values["min"]))
            daily["precipitation_sum"].append(round(values["rain"], 2))
            daily["wind_speed_10m_max"].append(max(values["wind"]))
            daily["relative_humidity_2m_mean"].append(sum(values["humidity"]) / len(values["humidity"]))
        return {"_provider": "met-norway", "timezone": zone_name,
                "current": current, "hourly": hourly, "daily": daily}
