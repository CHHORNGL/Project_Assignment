import unittest
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from unittest.mock import Mock, patch

from app.services.weather_intelligence.cache import CacheEntry, TTLWeatherCache
from app.services.weather_intelligence.client import WeatherProviderError, WeatherRequest
from app.services.weather_intelligence.met_norway import MetNorwayClient
from app.services.weather_intelligence.service import WeatherIntelligenceService


def document():
    start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    series = []
    for hour in list(range(48)) + list(range(48, 216, 6)):
        span = 1 if hour < 48 else 6
        series.append({
            "time": (start + timedelta(hours=hour)).isoformat(),
            "data": {
                "instant": {"details": {
                    "air_temperature": 25 + hour / 100, "relative_humidity": 70, "wind_speed": 2,
                }},
                f"next_{span}_hours": {
                    "summary": {"symbol_code": "rainandthunder"},
                    "details": {"precipitation_amount": span},
                },
            },
        })
    # A short-range point has both overlapping 1h and 6h totals.
    series[0]["data"]["next_6_hours"] = {
        "summary": {"symbol_code": "heavyrain"}, "details": {"precipitation_amount": 99},
    }
    return {"properties": {"timeseries": series}}


class WeatherBackupTests(unittest.TestCase):
    def setUp(self):
        self.request = WeatherRequest(11.5564, 104.9282)
        self.data = document()
        self.session = Mock()
        self.response = Mock(status_code=200, headers={
            "Expires": format_datetime(datetime.now(timezone.utc) + timedelta(minutes=30), usegmt=True),
            "Last-Modified": "Sat, 19 Sep 2026 05:12:32 GMT",
        })
        self.response.json.return_value = self.data
        self.session.get.return_value = self.response
        self.client = MetNorwayClient(session=self.session)

    def test_adapter_converts_wind_and_aggregates_seven_days_without_overlap(self):
        result = self.client.fetch_forecast(self.request)
        self.assertEqual(result["current"]["wind_speed_10m"], 7.2)
        self.assertEqual(result["current"]["temperature_2m"], 25)
        self.assertEqual(result["current"]["weather_code"], 95)
        self.assertEqual(len(result["daily"]["time"]), 7)
        self.assertEqual(sum(result["hourly"]["precipitation"]), 24)
        self.assertEqual(result["daily"]["precipitation_sum"][1:], [24] * 6)
        self.assertEqual(result["timezone"], "Asia/Phnom_Penh")
        self.assertEqual(result["_provider"], "met-norway")

    def test_identifies_application_rounds_coordinates_and_honors_http_expiry(self):
        result = self.client.fetch_forecast(self.request)
        args = self.session.get.call_args.kwargs
        self.assertEqual(args["params"], {"lat": "11.556", "lon": "104.928"})
        self.assertIn("https://agricultureexp.space", args["headers"]["User-Agent"])
        self.assertGreater(result["_cache_until"], datetime.now(timezone.utc).timestamp() + 1700)

    def test_304_revalidates_and_recomputes_current_forecast_hour(self):
        previous = self.client.fetch_forecast(self.request)
        self.response.status_code = 304
        real_datetime = datetime
        later = datetime.now(timezone.utc) + timedelta(hours=1)
        class LaterDatetime(datetime):
            @classmethod
            def now(cls, tz=None):
                return later.astimezone(tz) if tz else later.replace(tzinfo=None)
        with patch("app.services.weather_intelligence.met_norway.datetime", LaterDatetime):
            result = self.client.fetch_forecast(self.request, previous_payload=previous)
        self.assertEqual(self.session.get.call_args.kwargs["headers"]["If-Modified-Since"], previous["_last_modified"])
        self.assertEqual(result["current"]["temperature_2m"], 25.01)
        self.assertGreater(result["_cache_until"], real_datetime.now(timezone.utc).timestamp())

    def test_incomplete_or_invalid_forecast_is_not_reported_as_live(self):
        for data in ({}, {"properties": {"timeseries": []}},
                     {"properties": {"timeseries": self.data["properties"]["timeseries"][:1]}}):
            self.response.json.return_value = data
            with self.assertRaises(WeatherProviderError):
                self.client.fetch_forecast(self.request)

    def test_backup_rate_limit_is_respected(self):
        self.response.status_code = 429
        self.response.headers["Retry-After"] = "1800"
        with self.assertRaises(WeatherProviderError) as error:
            self.client.fetch_forecast(self.request)
        self.assertEqual(error.exception.retry_after, 1800)

    def service(self):
        self.primary = Mock()
        self.primary.fetch_forecast.side_effect = WeatherProviderError(
            "Primary limited", code="provider_rate_limited", retry_after=900,
        )
        self.cache = TTLWeatherCache()
        return WeatherIntelligenceService(client=self.primary, backup_client=self.client, cache=self.cache)

    def test_primary_limit_returns_real_backup_data_and_reuses_it_for_other_language(self):
        service = self.service()
        first, source = service.get_weather_summary(latitude=11.5564, longitude=104.9282, lang="en")
        second, next_source = service.get_weather_summary(latitude=11.5564, longitude=104.9282, lang="km")
        self.assertEqual((source, next_source), ("live", "cache"))
        self.assertEqual(first["meta"]["provider"], "met-norway")
        self.assertFalse(first["meta"]["degraded"])
        self.assertEqual(first["current"]["temp_c"], 25)
        self.assertEqual(second["meta"]["lang"], "km")
        self.primary.fetch_forecast.assert_called_once()
        self.session.get.assert_called_once()

    def test_backup_honors_expiry_even_after_normal_ten_minute_cache_ttl(self):
        service = self.service()
        service.get_weather_summary(latitude=11.5564, longitude=104.9282)
        key = "backup:" + service._cache_key(11.5564, 104.9282)
        entry = self.cache._items[key]
        self.cache._items[key] = CacheEntry(entry.payload, entry.fetched_at - timedelta(minutes=20))
        self.assertEqual(service.get_weather_summary(latitude=11.5564, longitude=104.9282)[1], "cache")
        self.session.get.assert_called_once()

    def test_primary_recovers_without_requesting_backup(self):
        service = self.service()
        service.get_weather_summary(latitude=11.5564, longitude=104.9282)
        raw = self.client._normalize(self.data, self.request)
        raw.pop("_provider")
        self.primary.fetch_forecast.side_effect = None
        self.primary.fetch_forecast.return_value = raw
        self.cache.set("provider-cooldown", {"code": "provider_rate_limited", "retry_at": 0})
        payload, source = service.get_weather_summary(latitude=11.5564, longitude=104.9282)
        self.assertEqual(source, "live")
        self.assertEqual(payload["meta"]["provider"], "open-meteo")
        self.session.get.assert_called_once()

    def test_both_provider_failures_use_cooldowns_and_return_unavailable(self):
        import requests
        service = self.service()
        self.session.get.side_effect = requests.Timeout()
        for _ in range(2):
            payload, source = service.get_weather_summary(latitude=11.5564, longitude=104.9282)
            self.assertEqual(source, "fallback")
            self.assertIsNone(payload["current"]["temp_c"])
        self.primary.fetch_forecast.assert_called_once()
        self.session.get.assert_called_once()

    def test_stale_backup_remains_labeled_when_both_providers_fail(self):
        import requests
        service = self.service()
        service.get_weather_summary(latitude=11.5564, longitude=104.9282)
        key = "backup:" + service._cache_key(11.5564, 104.9282)
        entry = self.cache._items[key]
        entry.payload["_cache_until"] = 0
        old = entry.fetched_at - timedelta(hours=1)
        self.cache._items[key] = CacheEntry(entry.payload, old)
        self.session.get.side_effect = requests.Timeout()
        payload, source = service.get_weather_summary(latitude=11.5564, longitude=104.9282)
        self.assertEqual(source, "stale-cache")
        self.assertTrue(payload["meta"]["degraded"])
        self.assertEqual(payload["meta"]["generated_at"], old.isoformat())


if __name__ == "__main__":
    unittest.main()
