# ruff: noqa: E402, I001
import pathlib as _pathlib
import sys as _sys

for _p in (
    str(_pathlib.Path(__file__).resolve().parents[1]),
    str(_pathlib.Path(__file__).resolve().parents[2]),
):
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

import unittest
from unittest.mock import Mock, patch

from flask import Flask
from flask_login import LoginManager, UserMixin

from app.blueprints.admin.routes import admin_bp
from app.services.weather_intelligence.cache import TTLWeatherCache
from app.services.weather_intelligence.intelligence import build_weather_intelligence_payload
from app.services.weather_intelligence.service import WeatherIntelligenceService


class AdminWorldWeatherTests(unittest.TestCase):
    def test_extended_atmospheric_metrics_normalize_with_optional_fallback(self):
        raw = {
            "timezone": "Asia/Phnom_Penh",
            "current": {
                "temperature_2m": 31.4,
                "apparent_temperature": 35.1,
                "relative_humidity_2m": 76,
                "rain": 2.4,
                "wind_speed_10m": 18.2,
                "wind_direction_10m": 135,
                "wind_gusts_10m": 29.6,
                "surface_pressure": 1007.8,
                "cloud_cover": 82,
                "weather_code": 95,
            },
            "hourly": {"precipitation": [2.4], "wind_speed_10m": [18.2], "temperature_2m": [31.4]},
            "daily": {
                "time": ["2026-11-16"],
                "weather_code": [95],
                "temperature_2m_max": [33],
                "temperature_2m_min": [25],
                "precipitation_sum": [12],
                "wind_speed_10m_max": [29.6],
                "relative_humidity_2m_mean": [76],
            },
        }
        payload = build_weather_intelligence_payload(
            raw_payload=raw,
            latitude=11.5564,
            longitude=104.9282,
            lang="en",
        )
        cur = payload["current"]
        self.assertEqual(cur["temp_c"], 31.4)
        self.assertEqual(cur["feels_like_c"], 35.1)
        self.assertEqual(cur["wind_direction_deg"], 135.0)
        self.assertEqual(cur["wind_gusts_kph"], 29.6)
        self.assertEqual(cur["pressure_hpa"], 1007.8)
        self.assertEqual(cur["cloud_cover_pct"], 82.0)
        self.assertEqual(cur["condition"], "Thunderstorm")

    def test_admin_world_weather_endpoint_requires_admin_and_returns_summary(self):
        app = Flask(__name__)
        app.secret_key = "test-admin-world-weather"
        manager = LoginManager(app)

        users = {}

        class TestUser(UserMixin):
            def __init__(self, uid: str, role: str):
                self.id = uid
                self._role = role
                self.roles = []

            def has_role(self, name: str) -> bool:
                return self._role == name

        users["1"] = TestUser("1", "admin")
        users["2"] = TestUser("2", "farmer")
        manager.user_loader(lambda uid: users.get(uid))

        app.register_blueprint(admin_bp)
        client = app.test_client()

        unauth = client.get("/admin/world/weather?lat=11.5564&lon=104.9282")
        self.assertEqual(unauth.status_code, 401)

        with client.session_transaction() as sess:
            sess["_user_id"] = "2"
        forbidden = client.get("/admin/world/weather?lat=11.5564&lon=104.9282")
        self.assertEqual(forbidden.status_code, 403)

        mock_client = Mock()
        mock_client.fetch_forecast.return_value = {
            "timezone": "Asia/Phnom_Penh",
            "current": {
                "temperature_2m": 27.5,
                "relative_humidity_2m": 80,
                "rain": 0.5,
                "wind_speed_10m": 14.0,
                "wind_direction_10m": 215,
                "surface_pressure": 1011.2,
                "weather_code": 3,
            },
            "hourly": {"precipitation": [0.5], "wind_speed_10m": [14.0], "temperature_2m": [27.5]},
            "daily": {
                "time": ["2026-11-16"],
                "weather_code": [3],
                "temperature_2m_max": [30],
                "temperature_2m_min": [24],
                "precipitation_sum": [1.5],
                "wind_speed_10m_max": [18.0],
                "relative_humidity_2m_mean": [80],
            },
        }
        service = WeatherIntelligenceService(client=mock_client, cache=TTLWeatherCache())

        with client.session_transaction() as sess:
            sess["_user_id"] = "1"
        with patch("app.blueprints.weather_intelligence.routes._get_service", return_value=service):
            resp = client.get("/admin/world/weather?lat=11.5564&lon=104.9282&lang=en")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json["current"]["wind_direction_deg"], 215.0)
        self.assertEqual(resp.json["current"]["pressure_hpa"], 1011.2)


if __name__ == "__main__":
    unittest.main()
