import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

from flask import Flask
from flask_login import LoginManager, UserMixin
from redis.exceptions import ConnectionError as RedisConnectionError

from app.blueprints.weather_intelligence.routes import weather_intelligence_bp, _get_service
from app.services.weather_intelligence.cache import CacheEntry, RedisWeatherCache, TTLWeatherCache
from app.services.weather_intelligence.client import OpenMeteoClient, WeatherProviderError, WeatherRequest
from app.services.weather_intelligence.service import WeatherIntelligenceService


def forecast():
    return {
        "timezone": "Asia/Phnom_Penh",
        "current": {"temperature_2m": 29, "relative_humidity_2m": 70, "rain": 0,
                    "wind_speed_10m": 10, "weather_code": 0},
        "hourly": {"precipitation": [0], "wind_speed_10m": [10], "temperature_2m": [29]},
        "daily": {"time": ["2026-09-19"], "weather_code": [0],
                  "temperature_2m_max": [31], "temperature_2m_min": [24],
                  "precipitation_sum": [0], "wind_speed_10m_max": [10],
                  "relative_humidity_2m_mean": [70]},
    }


class MemoryRedis:
    def __init__(self):
        self.data = {}

    def get(self, key):
        return self.data.get(key)

    def setex(self, key, seconds, value):
        self.data[key] = value.encode()


class WeatherTests(unittest.TestCase):
    def setUp(self):
        self.client = Mock()
        self.client.fetch_forecast.return_value = forecast()
        self.cache = TTLWeatherCache()
        self.service = WeatherIntelligenceService(client=self.client, cache=self.cache)

    def summary(self, service=None, **kwargs):
        return (service or self.service).get_weather_summary(
            latitude=kwargs.pop("latitude", 11.5564), longitude=104.9282, **kwargs,
        )

    def test_shared_redis_survives_new_worker_and_reuses_forecast_across_languages(self):
        redis = MemoryRedis()
        def worker():
            return WeatherIntelligenceService(client=self.client, cache=RedisWeatherCache(
                redis, prefix="test:", retention_seconds=21600,
            ))
        first, source = self.summary(worker(), lang="en")
        second, second_source = self.summary(worker(), lang="km")
        self.assertEqual((source, second_source), ("live", "cache"))
        self.assertEqual(second["current"]["temp_c"], 29)
        self.assertEqual(second["meta"]["lang"], "km")
        self.assertNotEqual(first["current"]["condition"], second["current"]["condition"])
        self.client.fetch_forecast.assert_called_once()

    def test_rate_limit_cooldown_is_shared_across_workers_and_locations(self):
        self.client.fetch_forecast.side_effect = WeatherProviderError(
            "Limit reached", code="provider_rate_limited", retry_after=900,
        )
        redis = MemoryRedis()
        for latitude in (11.55, 12.1):
            worker = WeatherIntelligenceService(client=self.client, cache=RedisWeatherCache(
                redis, prefix="test:", retention_seconds=21600,
            ))
            payload, source = self.summary(worker, latitude=latitude)
            self.assertEqual(source, "fallback")
            self.assertEqual(payload["meta"]["error_code"], "provider_rate_limited")
            self.assertGreater(payload["meta"]["retry_after_seconds"], 0)
            self.assertTrue(all(value is None for value in payload["analytics"].values()))
        self.client.fetch_forecast.assert_called_once()

    def test_cooldown_expiry_recovers_live_weather(self):
        self.cache.set("provider-cooldown", {
            "code": "provider_rate_limited",
            "retry_at": datetime.now(timezone.utc).timestamp() - 1,
        })
        payload, source = self.summary()
        self.assertEqual(source, "live")
        self.assertFalse(payload["meta"]["degraded"])

    def test_stale_forecast_keeps_original_time_and_is_not_overwritten_by_failure(self):
        key = self.service._cache_key(11.5564, 104.9282)
        timestamp = datetime.now(timezone.utc) - timedelta(hours=1)
        self.cache._items[key] = CacheEntry(forecast(), timestamp)
        self.client.fetch_forecast.side_effect = WeatherProviderError("Unavailable")
        payload, source = self.summary()
        self.assertEqual(source, "stale-cache")
        self.assertEqual(payload["current"]["temp_c"], 29)
        self.assertEqual(payload["meta"]["generated_at"], timestamp.isoformat())
        self.assertGreaterEqual(payload["meta"]["age_seconds"], 3600)
        self.assertEqual(self.cache._items[key].fetched_at, timestamp)

    def test_expired_forecast_is_not_served(self):
        key = self.service._cache_key(11.5564, 104.9282)
        self.cache._items[key] = CacheEntry(forecast(), datetime.now(timezone.utc) - timedelta(days=1))
        self.client.fetch_forecast.side_effect = WeatherProviderError("Unavailable")
        payload, source = self.summary()
        self.assertEqual(source, "fallback")
        self.assertIsNone(payload["current"]["temp_c"])

    def test_redis_outage_retains_local_forecast(self):
        redis = Mock()
        redis.get.side_effect = RedisConnectionError()
        redis.setex.side_effect = RedisConnectionError()
        service = WeatherIntelligenceService(client=self.client, cache=RedisWeatherCache(
            redis, prefix="test:", retention_seconds=21600,
        ))
        self.summary(service)
        self.assertEqual(self.summary(service)[1], "cache")
        self.client.fetch_forecast.assert_called_once()

    def test_redis_cache_preserves_age_and_handles_invalid_data(self):
        redis = MemoryRedis()
        cache = RedisWeatherCache(redis, prefix="test:", retention_seconds=21600)
        old = datetime.now(timezone.utc) - timedelta(hours=1)
        redis.setex("test:forecast", 21600, json.dumps({"payload": forecast(), "fetched_at": old.isoformat()}))
        self.assertIsNone(cache.get_fresh("forecast", 600))
        self.assertEqual(cache.get_stale("forecast", 21600).fetched_at, old)
        redis.data["test:broken"] = b"invalid JSON"
        self.assertIsNone(cache.get_fresh("broken", 600))

    def test_upstream_429_exposes_safe_code_and_honors_retry_after(self):
        for header, expected in ((None, 900), ("invalid", 900), ("1200", 1200), ("0", 60)):
            with self.subTest(header=header):
                response = Mock(status_code=429, headers={"Retry-After": header})
                session = Mock()
                session.get.return_value = response
                with self.assertRaises(WeatherProviderError) as error:
                    OpenMeteoClient(session=session).fetch_forecast(WeatherRequest(11.55, 104.92))
                self.assertEqual(error.exception.code, "provider_rate_limited")
                self.assertEqual(error.exception.retry_after, expected)

    def test_upstream_http_date_retry_after(self):
        from email.utils import format_datetime
        header = format_datetime(datetime.now(timezone.utc) + timedelta(minutes=30), usegmt=True)
        session = Mock()
        session.get.return_value = Mock(status_code=429, headers={"Retry-After": header})
        with self.assertRaises(WeatherProviderError) as error:
            OpenMeteoClient(session=session).fetch_forecast(WeatherRequest(11.55, 104.92))
        self.assertTrue(1790 <= error.exception.retry_after <= 1800)

    def test_provider_timeout_is_short_cooldown_without_exception_details(self):
        session = Mock()
        session.get.side_effect = TimeoutError("private upstream connection details")
        with self.assertRaises(WeatherProviderError) as error:
            OpenMeteoClient(session=session).fetch_forecast(WeatherRequest(11.55, 104.92))
        self.assertEqual(error.exception.retry_after, 60)
        self.assertNotIn("private", str(error.exception))

    def test_route_reuses_session_redis_with_separate_namespace(self):
        app = Flask(__name__)
        app.config.update(SESSION_TYPE="redis", SESSION_REDIS_URL="redis://example/1")
        with app.app_context(), patch("app.blueprints.weather_intelligence.routes.Redis.from_url") as factory:
            first = _get_service()
            second = _get_service()
        self.assertIs(first._cache, second._cache)
        self.assertIsInstance(first._cache, RedisWeatherCache)
        self.assertTrue(first._cache._prefix.startswith("agri:weather:v2:"))
        factory.assert_called_once()

    def test_weather_route_remains_protected_and_exposes_degraded_metadata(self):
        app = Flask(__name__)
        app.secret_key = "test-only"
        manager = LoginManager(app)
        class Farmer(UserMixin):
            id = "1"
            roles = []
            def has_role(self, role):
                return role == "farmer"
        manager.user_loader(lambda user_id: Farmer())
        app.register_blueprint(weather_intelligence_bp)
        browser = app.test_client()
        path = "/weather-intelligence/api/v1/summary?lat=11.5564&lon=104.9282&lang=en"
        self.assertEqual(browser.get(path).status_code, 401)
        with browser.session_transaction() as session:
            session["_user_id"] = "1"
        self.client.fetch_forecast.side_effect = WeatherProviderError(
            "Limit reached", code="provider_rate_limited", retry_after=900,
        )
        with patch("app.blueprints.weather_intelligence.routes._get_service", return_value=self.service):
            response = browser.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["X-Weather-Source"], "fallback")
            self.assertIn("no-store", response.headers["Cache-Control"])
            self.assertEqual(response.json["meta"]["error_code"], "provider_rate_limited")
            self.assertEqual(browser.get(path.replace("11.5564", "999")).status_code, 400)


if __name__ == "__main__":
    unittest.main()
