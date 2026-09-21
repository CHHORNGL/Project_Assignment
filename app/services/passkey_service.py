"""WebAuthn / Passkey service supporting all modern platforms (Face ID, Touch ID, Windows Hello, Android, Security Keys)."""

import base64
from urllib.parse import urlparse
from flask import Request

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    ResidentKeyRequirement,
    PublicKeyCredentialDescriptor,
    AttestationConveyancePreference,
)

from app.extensions import db
from app.models.passkey import UserPasskey
from app.models.user import User


def get_webauthn_rp_and_origins(req: Request) -> tuple[str, list[str]]:
    """Determine the Relying Party ID (rp_id) and valid origins for the current request."""
    forwarded_host = req.headers.get("X-Forwarded-Host")
    host_raw = forwarded_host or req.headers.get("Host") or req.host or "agricultureexp.space"
    if "," in host_raw:
        host_raw = host_raw.split(",")[0].strip()
    host = host_raw.split(":")[0].strip().lower()

    if "agricultureexp.space" in host:
        rp_id = "agricultureexp.space"
    elif host in ("localhost", "127.0.0.1"):
        rp_id = "localhost"
    else:
        rp_id = host

    allowed_origins = [
        f"https://{rp_id}",
        f"https://www.{rp_id}",
        f"http://{rp_id}",
        f"http://www.{rp_id}",
        "https://agricultureexp.space",
        "https://www.agricultureexp.space",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    try:
        if req.host_url:
            cleaned = req.host_url.rstrip("/")
            if cleaned not in allowed_origins:
                allowed_origins.append(cleaned)
            if cleaned.startswith("http://"):
                https_version = "https://" + cleaned[7:]
                if https_version not in allowed_origins:
                    allowed_origins.append(https_version)
    except Exception:
        pass

    # Dynamically accept Origin or Referer header if matching scheme and host
    for header_name in ("Origin", "Referer"):
        candidate = req.headers.get(header_name)
        if candidate:
            try:
                parsed = urlparse(candidate)
                if parsed.scheme and parsed.netloc:
                    origin_str = f"{parsed.scheme}://{parsed.netloc}"
                    if origin_str not in allowed_origins:
                        allowed_origins.append(origin_str)
            except Exception:
                pass

    return rp_id, list(dict.fromkeys(allowed_origins))


def get_registration_options_json(user: User, req: Request) -> tuple[str, str]:
    """Generate registration options JSON and challenge (base64url) for the user."""
    rp_id, _ = get_webauthn_rp_and_origins(req)
    user_id_bytes = str(user.id).encode("utf-8")

    # Exclude already registered credentials for this user
    exclude_credentials = []
    try:
        passkeys = user.passkeys.all()
        for p in passkeys:
            try:
                exclude_credentials.append(
                    PublicKeyCredentialDescriptor(id=base64url_to_bytes(p.credential_id))
                )
            except Exception:
                pass
    except Exception:
        pass

    options = generate_registration_options(
        rp_id=rp_id,
        rp_name="Agri System",
        user_id=user_id_bytes,
        user_name=user.username,
        user_display_name=user.full_name or user.username,
        attestation=AttestationConveyancePreference.NONE,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        exclude_credentials=exclude_credentials if exclude_credentials else None,
    )

    challenge_str = bytes_to_base64url(options.challenge)
    return options_to_json(options), challenge_str


def verify_and_save_registration(user: User, payload: dict, expected_challenge_b64: str, req: Request) -> UserPasskey:
    """Verify registration credential response and save passkey to database."""
    if not payload:
        raise ValueError("No passkey payload received.")

    try:
        expected_challenge = base64url_to_bytes(expected_challenge_b64)
    except Exception:
        expected_challenge = base64.b64decode(expected_challenge_b64)

    rp_id, allowed_origins = get_webauthn_rp_and_origins(req)

    registration_verification = verify_registration_response(
        credential=payload,
        expected_challenge=expected_challenge,
        expected_rp_id=rp_id,
        expected_origin=allowed_origins,
        require_user_verification=False,
    )

    cred_id_str = bytes_to_base64url(registration_verification.credential_id)
    name = (payload.get("name") or "").strip() or "Passkey"

    existing = UserPasskey.query.filter_by(credential_id=cred_id_str).first()
    if existing:
        existing.public_key = registration_verification.credential_public_key
        existing.sign_count = registration_verification.sign_count
        existing.name = name
        passkey = existing
    else:
        passkey = UserPasskey(
            user_id=user.id,
            credential_id=cred_id_str,
            public_key=registration_verification.credential_public_key,
            sign_count=registration_verification.sign_count,
            name=name,
        )
        db.session.add(passkey)

    db.session.commit()
    return passkey


def get_authentication_options_json(req: Request) -> tuple[str, str]:
    """Generate authentication options JSON and challenge (base64url)."""
    rp_id, _ = get_webauthn_rp_and_origins(req)
    options = generate_authentication_options(
        rp_id=rp_id,
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    challenge_str = bytes_to_base64url(options.challenge)
    return options_to_json(options), challenge_str


def verify_authentication(payload: dict, expected_challenge_b64: str, req: Request) -> tuple[User, UserPasskey]:
    """Verify authentication credential response and return authenticated user and passkey."""
    if not payload:
        raise ValueError("No passkey payload received.")

    credential_id = payload.get("id")
    if not credential_id:
        raise ValueError("Missing passkey credential ID.")

    passkey = UserPasskey.query.filter_by(credential_id=credential_id).first()
    if not passkey:
        passkey = UserPasskey.query.filter(UserPasskey.credential_id.like(f"%{credential_id}%")).first()

    if not passkey:
        raise ValueError("Passkey not registered on this server.")

    user = User.query.get(passkey.user_id)
    if not user:
        raise ValueError("User account not found.")
    if not user.is_active:
        raise ValueError("User account is inactive or disabled.")

    try:
        expected_challenge = base64url_to_bytes(expected_challenge_b64)
    except Exception:
        expected_challenge = base64.b64decode(expected_challenge_b64)

    rp_id, allowed_origins = get_webauthn_rp_and_origins(req)

    auth_verification = verify_authentication_response(
        credential=payload,
        expected_challenge=expected_challenge,
        expected_rp_id=rp_id,
        expected_origin=allowed_origins,
        credential_public_key=passkey.public_key,
        credential_current_sign_count=passkey.sign_count,
        require_user_verification=False,
    )

    passkey.sign_count = auth_verification.new_sign_count
    db.session.commit()
    return user, passkey
