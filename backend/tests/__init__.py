"""Backend test suite package.

Automatically configures sys.path so tests can be executed from the repository
root (`python -m unittest discover -s backend/tests -v`) or from `backend/`.
"""
import os
import sys
from pathlib import Path

_TESTS_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _TESTS_DIR.parent
_REPO_ROOT = _BACKEND_DIR.parent

for _path in (str(_BACKEND_DIR), str(_REPO_ROOT)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")
