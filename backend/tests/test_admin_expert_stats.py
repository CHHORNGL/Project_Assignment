# ruff: noqa: E402, I001
import pathlib as _pathlib
import sys as _sys

for _p in (
    str(_pathlib.Path(__file__).resolve().parents[1]),
    str(_pathlib.Path(__file__).resolve().parents[2]),
):
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

import json
import os
import re
import tempfile
import time
import unittest
from unittest.mock import patch

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app import create_app
from app.config import Config
from app.extensions import db
from app.models.diagnosis import Diagnosis
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User
from app.utils.session_security import credential_stamp


def _extract_bootstrap_payload(html: str) -> dict:
    match = re.search(
        r'<script[^>]*id=["\']app-bootstrap["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL,
    )
    if not match:
        raise AssertionError("Expected #app-bootstrap script tag in rendered HTML")
    return json.loads(match.group(1))


class AdminExpertStatsTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.multiple(
            Config,
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{_test_db_path}",
            SECRET_KEY=os.environ.get("SECRET_KEY", "test-secret-key-for-ci"),
        ):
            cls.app = create_app()
        cls.app.config.update({"TESTING": True, "WTF_CSRF_ENABLED": False})

    @classmethod
    def tearDownClass(cls):
        try:
            os.close(_test_db_fd)
            os.unlink(_test_db_path)
        except OSError:
            pass

    def setUp(self):
        self.ctx = self.app.app_context()
        self.ctx.push()
        self.client = self.app.test_client()
        db.create_all()

        perm_reports = Permission(code="view_reports", name="View Reports")
        admin_role = Role(name="admin", route_type="admin")
        admin_role.permissions.append(perm_reports)
        expert_role = Role(name="expert", route_type="expert")
        db.session.add_all([perm_reports, admin_role, expert_role])

        self.admin_user = User(
            username="stats_admin",
            email="stats-admin@agrisystem.local",
            is_active=True,
        )
        self.admin_user.set_password("AdminPass123!")
        self.admin_user.roles.append(admin_role)

        self.expert_user = User(
            username="dr_sopheak",
            full_name="Dr. Sopheak",
            email="sopheak@agrisystem.local",
            is_active=True,
        )
        self.expert_user.set_password("ExpertPass123!")
        self.expert_user.roles.append(expert_role)

        self.farmer_user = User(
            username="farmer_dara",
            email="dara@agrisystem.local",
            is_active=True,
        )
        self.farmer_user.set_password("FarmerPass123!")
        db.session.add_all([self.admin_user, self.expert_user, self.farmer_user])
        db.session.commit()

        db.session.add_all([
            Diagnosis(
                farmer_id=self.farmer_user.id,
                expert_id=self.expert_user.id,
                crop_name="Rice",
                disease_name="Bacterial Leaf Blight",
                symptoms="Yellow leaf lesions",
                confidence=0.80,
                status="APPROVED",
                feedback_rating="helpful",
            ),
            Diagnosis(
                farmer_id=self.farmer_user.id,
                crop_name="Banana",
                disease_name="Banana Panama Wilt",
                symptoms="Yellowing lower leaves",
                confidence=0.60,
                status="AUTO",
            ),
            Diagnosis(
                farmer_id=self.farmer_user.id,
                crop_name="Rice",
                disease_name="=BadFormulaDisease",
                symptoms="Brown spots",
                confidence=0.40,
                status="PENDING",
            ),
        ])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _login_admin(self):
        with self.client.session_transaction() as sess:
            sess["_user_id"] = str(self.admin_user.id)
            sess["_fresh"] = True
            sess["_authenticated_at"] = time.time()
            sess["_last_seen_at"] = time.time()
            sess["_credential_stamp"] = credential_stamp(self.admin_user)

    def test_expert_statistics_bootstrap_aggregates_statuses_crops_and_reviewers(self):
        self._login_admin()
        resp = self.client.get("/admin/expert-statistics")
        self.assertEqual(resp.status_code, 200)
        payload = _extract_bootstrap_payload(resp.get_data(as_text=True))
        self.assertEqual(payload["page"]["id"], "admin-expert-stats")
        data = payload["data"]

        self.assertEqual(data["totalDiagnoses"], 3)
        self.assertEqual(data["pendingCount"], 1)
        self.assertEqual(data["approvedCount"], 2)
        self.assertEqual(data["statusCounts"]["APPROVED"], 1)
        self.assertEqual(data["statusCounts"]["AUTO"], 1)
        self.assertEqual(data["statusCounts"]["PENDING"], 1)
        self.assertEqual(data["avgConfidence"], 60.0)
        self.assertEqual(data["feedbackCounts"]["helpful"], 1)
        self.assertEqual(data["feedbackCounts"]["notHelpful"], 0)
        self.assertEqual(data["cropBreakdown"][0]["cropName"], "Rice")
        self.assertEqual(data["cropBreakdown"][0]["count"], 2)
        self.assertEqual(len(data["reviewerStats"]), 1)
        self.assertEqual(data["reviewerStats"][0]["displayName"], "Dr. Sopheak")
        self.assertEqual(len(data["recentCases"]), 3)

    def test_expert_statistics_export_csv_and_json(self):
        self._login_admin()
        csv_resp = self.client.get("/admin/expert-statistics/export?format=csv")
        self.assertEqual(csv_resp.status_code, 200)
        self.assertIn("text/csv", csv_resp.content_type)
        self.assertIn("'=BadFormulaDisease", csv_resp.get_data(as_text=True))

        json_resp = self.client.get("/admin/expert-statistics/export?format=json")
        self.assertEqual(json_resp.status_code, 200)
        body = json.loads(json_resp.get_data(as_text=True))
        self.assertEqual(len(body["diagnoses"]), 3)


if __name__ == "__main__":
    unittest.main()
