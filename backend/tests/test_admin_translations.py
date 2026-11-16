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
from app.models.disease import Disease
from app.models.role import Role
from app.models.symptom import Symptom
from app.models.translation_backup import TranslationBackup
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


class AdminTranslationsTestCase(unittest.TestCase):
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

        admin_role = Role(name="admin", route_type="admin")
        db.session.add(admin_role)
        self.admin = User(
            username="trans_admin",
            email="trans-admin@agrisystem.local",
            is_active=True,
        )
        self.admin.set_password("AdminPass123!")
        self.admin.roles.append(admin_role)
        db.session.add(self.admin)

        self.crop_full = Crop(
            name="Rice",
            name_kh="ស្រូវ",
            description="Paddy rice",
            description_kh="ដំណាំស្រូវ",
        )
        self.crop_partial = Crop(
            name="Corn",
            name_kh="ពោត",
            description="Maize variety",
            description_kh=None,
        )
        db.session.add_all([self.crop_full, self.crop_partial])
        db.session.flush()

        self.disease = Disease(
            crop_id=self.crop_full.id,
            name="Blast",
            name_kh="ផ្លេកបន្ទោរ",
            description="Spots",
            treatment="Spray fungicide",
        )
        self.symptom = Symptom(name="Leaf Spot", name_kh="អុចស្លឹក")
        db.session.add_all([self.disease, self.symptom])
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

    def test_translations_bootstrap_stats_and_missing_description_filter(self):
        self._login_admin()
        resp = self.client.get("/admin/translations?section=crops&missing=1")
        self.assertEqual(resp.status_code, 200)
        data = _extract_bootstrap_payload(resp.get_data(as_text=True))["data"]
        self.assertEqual(data["aiTranslateUrl"], "/admin/translations/ai")
        self.assertEqual(data["coverageStats"]["crops"]["total"], 2)
        self.assertEqual(data["coverageStats"]["crops"]["translated"], 2)
        self.assertEqual([c["name"] for c in data["crops"]], ["Corn"])

    def test_partial_save_preserves_untouched_rows_creates_backup_and_restores(self):
        self._login_admin()
        save_resp = self.client.post(
            "/admin/translations",
            data={
                "action": "save",
                "section": "crops",
                f"crop_name_kh_{self.crop_partial.id}": "ពោតផ្អែម",
                f"crop_desc_kh_{self.crop_partial.id}": "ដំណាំពោត",
            },
            follow_redirects=False,
        )
        self.assertEqual(save_resp.status_code, 302)
        db.session.refresh(self.crop_full)
        db.session.refresh(self.crop_partial)
        self.assertEqual(self.crop_full.name_kh, "ស្រូវ")
        self.assertEqual(self.crop_partial.name_kh, "ពោតផ្អែម")
        self.assertEqual(self.crop_partial.description_kh, "ដំណាំពោត")
        self.assertEqual(TranslationBackup.query.count(), 1)

        backups_resp = self.client.get("/admin/translations/backups")
        self.assertEqual(backups_resp.status_code, 200)
        b_data = _extract_bootstrap_payload(backups_resp.get_data(as_text=True))["data"]
        self.assertEqual(b_data["backups"][0]["section"], "crops")
        self.assertIn("1 crops record(s)", b_data["backups"][0]["summary"])

        undo_resp = self.client.post(
            "/admin/translations/undo",
            data={"backup_id": str(b_data["backups"][0]["id"])},
            follow_redirects=False,
        )
        self.assertEqual(undo_resp.status_code, 302)
        db.session.refresh(self.crop_partial)
        self.assertEqual(self.crop_partial.name_kh, "ពោត")
        self.assertIsNone(self.crop_partial.description_kh)


if __name__ == "__main__":
    unittest.main()
