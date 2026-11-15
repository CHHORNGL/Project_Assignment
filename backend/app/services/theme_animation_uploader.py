from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import requests
from flask import current_app, url_for


ALLOWED_PROVIDERS = {"auto", "cloudinary", "local"}
ALLOWED_EXTENSIONS = {".json"}


@dataclass
class ThemeAnimationUploadError(Exception):
    message: str

    def __str__(self):
        return self.message


def _normalize_provider(provider: str | None) -> str:
    value = (provider or "auto").strip().lower()
    if value not in ALLOWED_PROVIDERS:
        raise ThemeAnimationUploadError("Invalid animation provider.")
    return value


def _read_and_validate_json(file_storage) -> tuple[bytes, str]:
    if not file_storage:
        raise ThemeAnimationUploadError("Animation file is required.")

    original_name = str(getattr(file_storage, "filename", "") or "").strip()
    if not original_name:
        raise ThemeAnimationUploadError("Animation filename is required.")

    suffix = Path(original_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise ThemeAnimationUploadError("Only .json animation files are supported.")

    raw = file_storage.read()
    if not raw:
        raise ThemeAnimationUploadError("Animation file is empty.")

    max_bytes = int(current_app.config.get("THEME_ANIMATION_MAX_BYTES", 2 * 1024 * 1024))
    if len(raw) > max_bytes:
        raise ThemeAnimationUploadError(f"Animation file is too large (max {max_bytes // 1024}KB).")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise ThemeAnimationUploadError("Animation must be valid UTF-8 JSON.") from exc

    if not isinstance(payload, dict):
        raise ThemeAnimationUploadError("Animation JSON root must be an object.")

    # Basic Lottie signature check.
    if "v" not in payload or not any(key in payload for key in ("layers", "assets")):
        raise ThemeAnimationUploadError("This JSON does not look like a valid Lottie animation.")

    normalized = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return normalized, original_name


def _upload_cloudinary(raw_json: bytes, original_name: str) -> str:
    cloud_name = (current_app.config.get("CLOUDINARY_CLOUD_NAME") or "").strip()
    upload_preset = (current_app.config.get("CLOUDINARY_UPLOAD_PRESET") or "").strip()
    upload_folder = (current_app.config.get("CLOUDINARY_UPLOAD_FOLDER") or "").strip() or "agri-theme-animations"
    if not cloud_name or not upload_preset:
        raise ThemeAnimationUploadError("Cloudinary is not configured. Missing cloud name or upload preset.")

    endpoint = f"https://api.cloudinary.com/v1_1/{cloud_name}/raw/upload"
    files = {
        "file": (original_name, raw_json, "application/json"),
    }
    data = {
        "upload_preset": upload_preset,
        "folder": upload_folder,
        "resource_type": "raw",
    }
    timeout = 12
    try:
        response = requests.post(endpoint, data=data, files=files, timeout=timeout)
    except requests.RequestException as exc:
        raise ThemeAnimationUploadError("Cloudinary upload failed.") from exc

    if response.status_code >= 400:
        detail = ""
        try:
            payload = response.json()
            detail = str(((payload or {}).get("error") or {}).get("message") or "")
        except Exception:
            detail = response.text[:180]
        raise ThemeAnimationUploadError(
            f"Cloudinary upload error ({response.status_code}). {detail}".strip()
        )

    payload = response.json() if response.content else {}
    public_url = str((payload or {}).get("secure_url") or (payload or {}).get("url") or "").strip()
    if not public_url:
        raise ThemeAnimationUploadError("Cloudinary response did not return a public URL.")
    return public_url


def _save_local_static(raw_json: bytes) -> str:
    static_root = Path(current_app.static_folder)
    target_dir = static_root / "uploads" / "theme_animations"
    target_dir.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    filename = f"lottie_{stamp}_{uuid4().hex[:10]}.json"
    destination = target_dir / filename
    destination.write_bytes(raw_json)

    relative = f"uploads/theme_animations/{filename}"
    return url_for("static", filename=relative, _external=False)


def upload_animation_asset(file_storage, provider: str | None = None) -> dict:
    selected_provider = _normalize_provider(provider or current_app.config.get("THEME_ANIMATION_CDN_PROVIDER", "auto"))
    raw_json, original_name = _read_and_validate_json(file_storage)

    if selected_provider in {"auto", "cloudinary"}:
        try:
            public_url = _upload_cloudinary(raw_json, original_name)
            return {
                "url": public_url,
                "provider": "cloudinary",
                "size_bytes": len(raw_json),
            }
        except ThemeAnimationUploadError:
            if selected_provider == "cloudinary":
                raise

    local_url = _save_local_static(raw_json)
    return {
        "url": local_url,
        "provider": "local",
        "size_bytes": len(raw_json),
    }
