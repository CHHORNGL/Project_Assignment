import json
import os
import re
import subprocess
import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent


class DependencyManagementTests(unittest.TestCase):
    def setUp(self):
        self.req_path = ROOT_DIR / "requirements.txt"
        self.lock_path = ROOT_DIR / "requirements.lock"
        self.dev_req_path = ROOT_DIR / "requirements-dev.txt"
        self.dependabot_path = ROOT_DIR / ".github" / "dependabot.yml"
        self.frontend_pkg = ROOT_DIR / "frontend" / "package.json"
        self.frontend_lock = ROOT_DIR / "frontend" / "package-lock.json"
        self.mobile_pubspec = ROOT_DIR / "mobile" / "pubspec.yaml"
        self.mobile_lock = ROOT_DIR / "mobile" / "pubspec.lock"
        self.dockerfile = ROOT_DIR / "Dockerfile"

    def _normalize_name(self, line: str) -> str:
        cleaned = line.split("#", 1)[0].strip()
        if not cleaned or cleaned.startswith("-"):
            return ""
        match = re.match(r"^([a-zA-Z0-9_\-\.]+)", cleaned)
        return match.group(1).lower().replace("_", "-") if match else ""

    def test_requirements_manifest_syntax_and_pinning(self):
        self.assertTrue(self.req_path.exists(), "requirements.txt must exist")
        with open(self.req_path, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]

        seen = set()
        for line in lines:
            name = self._normalize_name(line)
            self.assertTrue(name, f"Invalid requirement format: {line}")
            self.assertNotIn(name, seen, f"Duplicate requirement detected: {name}")
            seen.add(name)
            self.assertIn("==", line, f"Requirement '{line}' must be strictly pinned with ==")

    def test_requirements_lock_coverage(self):
        self.assertTrue(self.lock_path.exists(), "requirements.lock must exist")
        with open(self.req_path, "r", encoding="utf-8") as f:
            manifest_pkgs = {
                self._normalize_name(line) for line in f
                if self._normalize_name(line)
            }

        with open(self.lock_path, "r", encoding="utf-8") as f:
            locked_pkgs = {
                self._normalize_name(line) for line in f
                if self._normalize_name(line)
            }

        missing = manifest_pkgs - locked_pkgs
        self.assertEqual(missing, set(), f"Lockfile missing declared dependencies: {missing}")
        self.assertGreaterEqual(len(locked_pkgs), len(manifest_pkgs),
                                "Lockfile should include transitive dependencies")

    def test_pip_check_passes_without_broken_requirements(self):
        res = subprocess.run(
            [sys.executable, "-m", "pip", "check"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        self.assertEqual(
            res.returncode, 0,
            f"pip check failed with broken requirements:\n{res.stdout}\n{res.stderr}"
        )

    def test_dependabot_configuration(self):
        self.assertTrue(self.dependabot_path.exists(), ".github/dependabot.yml must exist")
        with open(self.dependabot_path, "r", encoding="utf-8") as f:
            content = f.read()

        required_ecosystems = ["pip", "npm", "pub", "docker", "github-actions"]
        for eco in required_ecosystems:
            self.assertIn(f'package-ecosystem: "{eco}"', content,
                          f"Dependabot must configure ecosystem: {eco}")

    def test_frontend_lockfile_integrity(self):
        self.assertTrue(self.frontend_pkg.exists(), "frontend/package.json must exist")
        self.assertTrue(self.frontend_lock.exists(), "frontend/package-lock.json must exist")

        with open(self.frontend_lock, "r", encoding="utf-8") as f:
            lock_data = json.load(f)

        self.assertIn("name", lock_data)
        self.assertIn("lockfileVersion", lock_data)
        self.assertIn("packages", lock_data)

    def test_mobile_lockfile_exists(self):
        self.assertTrue(self.mobile_pubspec.exists(), "mobile/pubspec.yaml must exist")
        self.assertTrue(self.mobile_lock.exists(), "mobile/pubspec.lock must exist")

    def test_dockerfile_reproducible_commands(self):
        self.assertTrue(self.dockerfile.exists(), "Dockerfile must exist")
        with open(self.dockerfile, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("npm ci", content, "Dockerfile frontend stage should use npm ci for deterministic builds")
        self.assertIn("requirements.lock", content, "Dockerfile backend stage should reference requirements.lock")


if __name__ == "__main__":
    unittest.main()
