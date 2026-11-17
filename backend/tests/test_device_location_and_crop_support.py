import pathlib as _pathlib
import sys as _sys
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

for _p in (
    str(_pathlib.Path(__file__).resolve().parents[1]),
    str(_pathlib.Path(__file__).resolve().parents[2]),
):
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

from flask import Flask

from app.extensions import db
from app.models.audit_log import AuditLog
from app.services import ip_geolocation
from app.services.login_activity import list_login_activity
from app.utils.session_security import _login_device_metadata


class DeviceNameAndLocationTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SECRET_KEY="test-device-location-secret",
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
        )
        db.init_app(self.app)
        with self.app.app_context():
            db.create_all()
        with ip_geolocation._IP_GEO_LOCK:
            ip_geolocation._IP_GEO_CACHE.clear()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
        with ip_geolocation._IP_GEO_LOCK:
            ip_geolocation._IP_GEO_CACHE.clear()

    def test_real_device_name_detection(self):
        cases = [
            (
                {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1"},
                "iPhone",
            ),
            (
                {"User-Agent": "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) Safari/604.1"},
                "iPad",
            ),
            (
                {
                    "User-Agent": "Mozilla/5.0 (Linux; Android 14; K) Chrome/124.0.0.0 Mobile Safari/537.36",
                    "Sec-CH-UA-Model": '"SM-S928B"',
                },
                "Samsung Galaxy S24 Ultra",
            ),
            (
                {"User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/AP1A) Chrome/124.0.0.0 Mobile Safari/537.36"},
                "Google Pixel 8 Pro",
            ),
            (
                {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/124.0.0.0 Safari/537.36"},
                "Mac / MacBook",
            ),
            (
                {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36"},
                "Windows PC",
            ),
        ]
        for headers, expected_name in cases:
            with self.subTest(headers=headers):
                with self.app.test_request_context("/auth/login", headers=headers):
                    meta = _login_device_metadata()
                    self.assertEqual(meta["device_name"], expected_name)

    def test_cloudflare_header_location_and_local_network_fallback(self):
        with self.app.test_request_context(
            "/auth/login",
            headers={
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)",
                "CF-IPCity": "Phnom Penh",
                "CF-IPCountry": "KH",
            },
        ):
            meta = _login_device_metadata()
            self.assertEqual(meta["location"], "Phnom Penh, Cambodia")

        self.assertEqual(ip_geolocation.resolve_ip_location("127.0.0.1"), "Local Network")
        self.assertEqual(ip_geolocation.resolve_ip_location("192.168.1.55"), "Local Network")

    def test_list_login_activity_includes_device_name_and_real_location(self):
        with self.app.app_context():
            log1 = AuditLog(
                user_id=7,
                action="AUTH_SESSION_CREATED",
                target_user="farmer7",
                detail=(
                    "ip=203.144.80.15 Session initialized activity_id=act_geo_1 "
                    "device=mobile_phone browser=Chrome os=Android "
                    "device_name=Samsung_Galaxy_S24_Ultra location=Siem_Reap,_Cambodia "
                    "login_route=/auth/login"
                ),
                created_at=datetime(2026, 11, 17, 6, 0, 0, tzinfo=timezone.utc),
            )
            log2 = AuditLog(
                user_id=7,
                action="AUTH_SESSION_CREATED",
                target_user="farmer7",
                detail=(
                    "ip=192.168.1.12 Session initialized activity_id=act_geo_2 "
                    "device=laptop_computer browser=Chrome os=macOS login_route=/auth/login"
                ),
                created_at=datetime(2026, 11, 16, 6, 0, 0, tzinfo=timezone.utc),
            )
            db.session.add_all([log1, log2])
            db.session.commit()

            rows = list_login_activity(user_id=7, current_activity_id="act_geo_1")
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0]["device_name"], "Samsung Galaxy S24 Ultra")
            self.assertEqual(rows[0]["location"], "Siem Reap, Cambodia")
            self.assertEqual(rows[0]["os"], "Android")
            self.assertTrue(rows[0]["is_current"])

            # Historical session without stored device_name or location resolves cleanly
            self.assertEqual(rows[1]["device_name"], "Mac / MacBook")
            self.assertEqual(rows[1]["location"], "Local Network")

    def test_public_ip_lookup_uses_geolocation_helper_when_not_testing(self):
        self.app.config["TESTING"] = False
        with patch.object(ip_geolocation, "_lookup_ip_geolocation", return_value="Battambang, Cambodia") as mock_lookup:
            with self.app.app_context():
                loc1 = ip_geolocation.resolve_ip_location("103.16.63.10")
                loc2 = ip_geolocation.resolve_ip_location("103.16.63.10")
        self.assertEqual(loc1, "Battambang, Cambodia")
        self.assertEqual(loc2, "Battambang, Cambodia")
        mock_lookup.assert_called_once_with("103.16.63.10")


if __name__ == "__main__":
    unittest.main()
