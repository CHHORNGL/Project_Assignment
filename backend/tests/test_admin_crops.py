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


class AdminCropsTestCase(unittest.TestCase):
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
            username="crops_admin",
            email="crops-admin@agrisystem.local",
            is_active=True,
        )
        self.admin.set_password("AdminPass123!")
        self.admin.roles.append(admin_role)
        db.session.add(self.admin)

        self.crop_rice = Crop(
            name="Rice",
            name_kh="ស្រូវ",
            emoji="🌾",
            description="Staple paddy grain",
            description_kh="ដំណាំស្រូវ",
        )
        self.crop_corn = Crop(
            name="Corn",
            name_kh="ពោត",
        )
        db.session.add_all([self.crop_rice, self.crop_corn])
        db.session.commit()

        disease = Disease(name="Blast", crop_id=self.crop_rice.id)
        db.session.add(disease)
        db.session.flush()
        db.session.add(
            Diagnosis(
                farmer_id=self.admin.id,
                crop_id=self.crop_rice.id,
                crop_name="Rice",
                disease_id=disease.id,
                disease_name="Blast",
                symptoms="Spots",
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

    def test_crops_bootstrap_includes_counts_links_and_sorted_order(self):
        self._login_admin()
        resp = self.client.get("/admin/crops/")
        self.assertEqual(resp.status_code, 200)
        payload = _extract_bootstrap_payload(resp.get_data(as_text=True))
        self.assertEqual(payload["page"]["id"], "admin-crops")
        data = payload["data"]
        self.assertEqual(data["bulkActionUrl"], "/admin/crops/bulk")
        self.assertEqual(data["links"]["diseasesUrl"], "/admin/diseases")
        names = [c["name"] for c in data["crops"]]
        self.assertEqual(names, ["Corn", "Rice"])
        by_name = {c["name"]: c for c in data["crops"]}
        self.assertEqual(by_name["Rice"]["diseaseCount"], 1)
        self.assertEqual(by_name["Rice"]["diagnosisCount"], 1)
        self.assertEqual(by_name["Corn"]["diseaseCount"], 0)

    def test_create_duplicate_crop_handled_cleanly_and_bulk_delete_detaches_history(self):
        self._login_admin()
        dup_resp = self.client.post(
            "/admin/crops/create",
            data={"name": "rice"},
            follow_redirects=False,
        )
        self.assertEqual(dup_resp.status_code, 302)
        self.assertEqual(Crop.query.count(), 2)

        bulk_resp = self.client.post(
            "/admin/crops/bulk",
            data={"action": "delete", "scope": "selected", "crop_ids": [str(self.crop_rice.id)]},
            follow_redirects=False,
        )
        self.assertEqual(bulk_resp.status_code, 302)
        self.assertEqual(Crop.query.count(), 1)
        self.assertEqual(Diagnosis.query.count(), 1)
        self.assertIsNone(Diagnosis.query.first().crop_id)


if __name__ == "__main__":
    unittest.main()
