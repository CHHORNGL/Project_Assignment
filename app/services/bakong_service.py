import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from bakong_khqr import KHQR

from app.extensions import db
from app.models.payment_transaction import PaymentTransaction
from app.models.premium_coupon import PremiumCoupon
from app.models.site_setting import SiteSetting
from app.models.user import User

logger = logging.getLogger(__name__)


def get_bakong_config() -> dict[str, str]:
    """
    Retrieve Bakong KHQR settings from SiteSetting database or fall back to environment variables.
    """
    def _val(key: str, env_key: str, default: str = "") -> str:
        s = SiteSetting.query.get(key)
        if s and s.value and s.value.strip():
            return s.value.strip()
        return os.getenv(env_key, default).strip()

    return {
        "token": _val(
            "bakong_token",
            "BAKONG_TOKEN",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiZDcwMjUxZGM4NTQ1NGMzNCJ9LCJpYXQiOjE3OTEwNDg4NzQsImV4cCI6MTc5ODgyNDg3NH0.XQXkwMI-Ss5NFVvE2WviF3K89YKe9bhCiLWrCtKxWF8",
        ),
        "account_id": _val("bakong_account_id", "BAKONG_ACCOUNT_ID", "seavik_mao@bkrt"),
        "merchant_name": _val("bakong_merchant_name", "BAKONG_MERCHANT_NAME", "Seavik Mao"),
        "merchant_city": _val("bakong_merchant_city", "BAKONG_MERCHANT_CITY", "Phnom Penh"),
        "currency": _val("bakong_currency", "BAKONG_CURRENCY", "USD").upper(),
        "store_label": _val("bakong_store_label", "BAKONG_STORE_LABEL", "Agri System Pro"),
    }


def get_khqr_client() -> KHQR:
    """
    Initialize the KHQR SDK client with the configured Bakong token.
    """
    config = get_bakong_config()
    return KHQR(bakong_token=config["token"])


def generate_clean_khqr_image(qr_string: str, currency: str = "USD") -> str | None:
    """
    Generate an ultra-crisp, professional QR code image with the central Bakong currency badge,
    sized and padded perfectly for in-app checkout display without redundant outer card framing.
    """
    try:
        import base64
        import io
        from importlib import resources
        from PIL import Image, ImageDraw
        import qrcode

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=12,
            border=2,
        )
        qr.add_data(qr_string)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")

        asset_name = "USD.png" if (currency or "USD").upper() == "USD" else "KHR.png"
        try:
            icon_bytes = resources.files("bakong_khqr.sdk.assets").joinpath(asset_name).read_bytes()
            icon = Image.open(io.BytesIO(icon_bytes)).convert("RGBA")
        except Exception:
            icon_bytes = resources.files("bakong_khqr.sdk.assets").joinpath("khqr.png").read_bytes()
            icon = Image.open(io.BytesIO(icon_bytes)).convert("RGBA")

        qr_w, qr_h = img.size
        icon_w = max(24, int(qr_w * 0.22))
        icon_h = icon_w
        icon = icon.resize((icon_w, icon_h), Image.Resampling.LANCZOS)

        pad = max(4, int(icon_w * 0.14))
        badge_size = icon_w + pad * 2
        badge = Image.new("RGBA", (badge_size, badge_size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(badge)
        draw.rounded_rectangle(
            [0, 0, badge_size, badge_size],
            radius=int(badge_size * 0.28),
            fill=(255, 255, 255, 255),
            outline=(225, 36, 42, 230),
            width=2,
        )
        badge.paste(icon, (pad, pad), icon)

        offset = ((qr_w - badge_size) // 2, (qr_h - badge_size) // 2)
        img.paste(badge, offset, badge)

        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:
        logger.warning(f"Failed to generate clean KHQR image: {e}")
        return None


def create_khqr_payment(
    user: User,
    amount: float,
    billing_interval: str = "monthly",
    coupon_code: str | None = None,
    currency: str | None = None,
) -> dict[str, Any]:
    """
    Generate a compliant Bakong KHQR code and record the pending transaction.
    """
    config = get_bakong_config()
    final_currency = (currency or config["currency"]).upper()
    amount_float = round(float(amount), 2)

    bill_number = f"BILL{user.id}{int(time.time())}"[-25:]

    client = get_khqr_client()
    try:
        res = client.create_qr(
            amount=amount_float,
            account_id=config["account_id"],
            merchant_name=config["merchant_name"],
            merchant_city=config["merchant_city"],
            currency=final_currency,
            store_label=config["store_label"],
            bill_number=bill_number,
        )
    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to generate Bakong KHQR: {e}")
        return {
            "success": False,
            "message": f"Unable to generate Bakong QR code: {e!s}",
        }

    # Generate clean, high-resolution QR image for UI display
    qr_image_data_uri = generate_clean_khqr_image(str(res), currency=final_currency)
    if not qr_image_data_uri:
        try:
            qr_image_data_uri = client.qr_image(str(res), format="base64_uri")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Failed to generate fallback QR image: {e}")
            qr_image_data_uri = None

    # Generate Bakong mobile banking deep link
    try:
        deeplink = client.generate_deeplink(
            str(res),
            appName="AgriSystemPro",
            appIconUrl="https://bakong.nbc.gov.kh/images/logo.svg",
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Failed to generate deep link: {e}")
        deeplink = None

    # Safely extract md5
    res_md5 = getattr(res, "md5", None)
    if not res_md5 and isinstance(res, dict):
        res_md5 = res.get("md5")

    # Persist pending transaction
    tx = PaymentTransaction(
        user_id=user.id,
        payment_method="BAKONG_KHQR",
        bill_number=bill_number,
        md5=str(res_md5) if res_md5 else None,
        qr_string=str(res),
        deeplink=str(deeplink) if deeplink else None,
        amount=amount_float,
        currency=final_currency,
        billing_interval=billing_interval,
        status="PENDING",
        coupon_code=coupon_code.strip().upper() if coupon_code else None,
        account_id=config["account_id"],
    )
    db.session.add(tx)
    db.session.commit()

    return {
        "success": True,
        "transaction_id": tx.id,
        "md5": str(res_md5) if res_md5 else None,
        "qr_image": qr_image_data_uri,
        "qr_string": str(res),
        "deeplink": deeplink,
        "amount": amount_float,
        "currency": final_currency,
        "bill_number": bill_number,
        "merchant_name": config["merchant_name"],
        "account_id": config["account_id"],
        "billing_interval": billing_interval,
    }


def verify_khqr_payment(md5: str) -> dict[str, Any]:
    """
    Check the transaction status with Bakong NBC and upgrade the user if paid.
    """
    if not md5:
        return {"success": False, "status": "ERROR", "message": "MD5 hash is required."}

    tx = PaymentTransaction.query.filter_by(md5=md5).first()
    if not tx:
        return {"success": False, "status": "NOT_FOUND", "message": "Transaction not found."}

    # If already verified
    if tx.status == "PAID":
        return {
            "success": True,
            "status": "PAID",
            "message": "Payment has already been confirmed.",
            "transaction": tx.to_dict(),
        }

    client = get_khqr_client()
    try:
        api_status = client.check_payment(md5)
        # check_payment returns 'PAID', 'UNPAID', or tuple ('PAID', code)
        if isinstance(api_status, tuple):
            status_str = str(api_status[0]).upper()
        else:
            status_str = str(api_status).upper()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Bakong check_payment check error for md5 {md5}: {e}")
        status_str = "UNPAID"

    if status_str == "PAID":
        now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
        tx.status = "PAID"
        tx.paid_at = now_dt

        # Update coupon usage if applicable
        if tx.coupon_code:
            coupon = PremiumCoupon.query.filter_by(code=tx.coupon_code).first()
            if coupon and coupon.is_valid()[0]:
                coupon.times_used += 1

        # Grant Premium access to user
        days_to_add = 365 if tx.billing_interval == "yearly" else 30
        user = tx.user
        if user:
            user.is_premium = True
            if user.premium_expires_at and user.premium_expires_at > now_dt:
                user.premium_expires_at = user.premium_expires_at + timedelta(days=days_to_add)
            else:
                user.premium_expires_at = now_dt + timedelta(days=days_to_add)

            # User notification
            try:
                from app.services.notification_service import notify_user
                notify_user(
                    user_id=user.id,
                    kind="premium_upgrade",
                    title="Bakong KHQR Payment Approved! 👑",
                    subtitle=(
                        f"Your {tx.billing_interval.capitalize()} VIP Pro membership is active until "
                        f"{user.premium_expires_at.strftime('%Y-%m-%d')}."
                    ),
                    url="/farmer/dashboard",
                    icon="fas fa-crown",
                    level="success",
                )
            except Exception as notify_err:  # noqa: BLE001
                logger.debug(f"Notification bypassed: {notify_err}")

            # Audit log
            try:
                from app.services.audit_service import log_action
                log_action(
                    "bakong_payment_success",
                    detail=(
                        f"User @{user.username} paid ${tx.amount:.2f} {tx.currency} via Bakong KHQR "
                        f"(Bill: {tx.bill_number}, MD5: {md5}, Interval: {tx.billing_interval})"
                    ),
                )
            except Exception as audit_err:  # noqa: BLE001
                logger.debug(f"Audit log bypassed: {audit_err}")

        db.session.commit()
        return {
            "success": True,
            "status": "PAID",
            "message": "Payment verified successfully! Your account has been upgraded.",
            "transaction": tx.to_dict(),
        }

    return {
        "success": True,
        "status": status_str if status_str in ("UNPAID", "PENDING", "EXPIRED") else "UNPAID",
        "message": "Payment is waiting for confirmation.",
        "transaction": tx.to_dict(),
    }
