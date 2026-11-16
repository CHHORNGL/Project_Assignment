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
from app.models.crop import Crop
from app.models.diagnosis import Diagnosis
from app.models.disease import Disease
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


class AdminDiseasesTestCase(unittest.TestCase):
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

        perm = Permission(code="manage_crops", name="Manage Crops")
        admin_role = Role(name="admin", route_type="admin")
        admin_role.permissions.append(perm)
        db.session.add_all([perm, admin_role])

        self.admin = User(
            username="disease_admin",
            email="disease-admin@agrisystem.local",
            is_active=True,
        )
        self.admin.set_password("AdminPass123!")
        self.admin.roles.append(admin_role)
        db.session.add(self.admin)

        self.crop = Crop(name="Rice", name_kh="ស្រូវ")
        db.session.add(self.crop)
        db.session.commit()

        self.disease = Disease(
            crop_id=self.crop.id,
            name="Rice Blast",
            name_kh="ជំងឺផ្លេកបន្ទោរលើស្រូវ",
            severity_level="medium",
            description="Leaf lesions",
            cause_explanation="Magnaporthe oryzae fungus",
            treatment="Use tricyclazole fungicide",
            prevention_tips="Use resistant cultivars",
        )
        db.session.add(self.disease)
        db.session.flush()
        db.session.add(
            Diagnosis(
                farmer_id=self.admin.id,
                crop_id=self.crop.id,
                crop_name="Rice",
                disease_id=self.disease.id,
                disease_name="Rice Blast",
                symptoms="Lesions",
                status="APPROVED",
            )
        )
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _login_admin(self):
        with self.client.session_transaction() as sess:
            sess["_user_id"] = str(self.admin.id)
            sess["_fresh"] = True
            sess["_authenticated_at"] = time.time()
            sess["_last_seen_at"] = time.time()
            sess["_credential_stamp"] = credential_stamp(self.admin)

    def test_diseases_list_and_form_normalize_severity_and_expose_extended_fields(self):
        self._login_admin()
        list_resp = self.client.get("/admin/diseases")
        self.assertEqual(list_resp.status_code, 200)
        list_data = _extract_bootstrap_payload(list_resp.get_data(as_text=True))["data"]
        self.assertEqual(list_data["bulkActionUrl"], "/admin/diseases/bulk")
        self.assertEqual(list_data["crops"][0]["name"], "Rice")
        row = list_data["diseases"][0]
        self.assertEqual(row["severity"], "Medium")
        self.assertEqual(row["causeExplanation"], "Magnaporthe oryzae fungus")
        self.assertEqual(row["preventionTips"], "Use resistant cultivars")

        form_resp = self.client.get(f"/admin/diseases/{self.disease.id}/edit")
        self.assertEqual(form_resp.status_code, 200)
        form_data = _extract_bootstrap_payload(form_resp.get_data(as_text=True))["data"]
        self.assertEqual(form_data["formValues"]["severityLevel"], "Medium")
        self.assertEqual(form_data["formValues"]["causeExplanation"], "Magnaporthe oryzae fungus")
        self.assertEqual(form_data["formValues"]["preventionTips"], "Use resistant cultivars")

    def test_create_edit_and_bulk_delete_preserve_diagnosis_history(self):
        self._login_admin()
        create_resp = self.client.post(
            "/admin/diseases/create",
            data={
                "crop_id": str(self.crop.id),
                "name": "Brown Spot",
                "name_kh": "ជំងឺអុចត្នោត",
                "severity_level": "high",
                "description": "Brown spots on foliage",
                "cause_explanation": "Bipolaris oryzae",
                "cause_explanation_kh": "ផ្សិត",
                "treatment": "Balanced potassium",
                "prevention_tips": "Clean seed",
            },
            follow_redirects=False,
        )
        self.assertEqual(create_resp.status_code, 302)
        created = Disease.query.filter_by(name="Brown Spot").first()
        self.assertIsNotNone(created)
        self.assertEqual(created.severity_level, "High")
        self.assertEqual(created.cause_explanation, "Bipolaris oryzae")
        self.assertEqual(created.prevention_tips, "Clean seed")

        bulk_resp = self.client.post(
            "/admin/diseases/bulk",
            data={
                "action": "delete",
                "scope": "selected",
                "disease_ids": [str(self.disease.id)],
            },
            follow_redirects=False,
        )
        self.assertEqual(bulk_resp.status_code, 302)
        self.assertIsNone(Disease.query.get(self.disease.id))
        self.assertEqual(Diagnosis.query.count(), 1)
        self.assertIsNone(Diagnosis.query.first().disease_id)


if __name__ == "__main__":
    unittest.main()
