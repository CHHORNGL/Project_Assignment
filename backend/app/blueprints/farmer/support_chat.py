from datetime import datetime, timedelta
from flask import request, jsonify, current_app
from flask_login import current_user, login_required
from app.extensions import db
from app.models import User, AdminChatMessage
from app.services.support_chat_service import (
    farmer_channel_messages_query,
    farmer_support_channels_summary,
    handle_support_attachment_upload,
    normalize_support_target,
    resolve_farmer_support_partner,
)
from app.utils.decorators import role_required
from app.utils.input_validation import support_message_fields
from app.utils.react_bootstrap import (
    build_farmer_live_chat_bootstrap,
    render_react_page,
)
from app.utils.support_chat_realtime import (
    clear_typing,
    is_typing,
    serialize_chat_message,
    set_typing,
)
from .routes import farmer_bp


def _resolve_support_admin() -> User | None:
    _, partner, _ = resolve_farmer_support_partner(
        getattr(current_user, "id", 0) or 0, target="admin"
    )
    return partner


def _parse_recipient_id(raw_value) -> int | None:
    try:
        parsed = int(raw_value)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


@farmer_bp.route("/live-chat", methods=["GET"])
@farmer_bp.route("/live-chat/", methods=["GET"])
@login_required
@role_required("farmer")
def live_chat():
    initial_target = normalize_support_target(request.args.get("target"))
    initial_recipient_id = _parse_recipient_id(request.args.get("recipient_id"))
    channels = farmer_support_channels_summary(current_user.id)
    return render_react_page(
        bootstrap_payload=build_farmer_live_chat_bootstrap(
            initial_target=initial_target,
            initial_recipient_id=initial_recipient_id,
            channels=channels,
        ),
        title="Live Chat",
    )


@farmer_bp.route("/support_chat/channels", methods=["GET"])
@login_required
@role_required("farmer")
def get_support_channels():
    return jsonify({"channels": farmer_support_channels_summary(current_user.id)})


@farmer_bp.route("/support_chat/messages", methods=["GET"])
@login_required
@role_required("farmer")
def get_support_messages():
    cutoff = datetime.utcnow() - timedelta(hours=24)
    after_id = request.args.get("after_id", type=int)
    envelope = (request.args.get("envelope") or "").strip().lower() in {"1", "true", "yes"}
    target = normalize_support_target(request.args.get("target"))
    recipient_id = _parse_recipient_id(request.args.get("recipient_id"))

    normalized_target, partner_user, candidates = resolve_farmer_support_partner(
        current_user.id, target=target, recipient_id=recipient_id
    )
    eligible_ids = {u.id for u in candidates}
    base_query = farmer_channel_messages_query(
        current_user.id, eligible_ids, cutoff, recipient_id=recipient_id
    )

    unread_incoming_ids = [
        row[0]
        for row in base_query.with_entities(AdminChatMessage.id)
        .filter(
            AdminChatMessage.receiver_id == current_user.id,
            AdminChatMessage.sender_id != current_user.id,
            AdminChatMessage.is_read.is_(False),
        )
        .all()
    ]
    if unread_incoming_ids:
        AdminChatMessage.query.filter(AdminChatMessage.id.in_(unread_incoming_ids)).update(
            {AdminChatMessage.is_read: True}, synchronize_session=False
        )
        try:
            from app.models.notification import Notification

            Notification.query.filter(
                Notification.user_id == current_user.id,
                Notification.kind == "support_chat",
                Notification.source_id.in_(list(eligible_ids) + unread_incoming_ids),
                Notification.read_at.is_(None),
            ).update({Notification.read_at: datetime.utcnow()}, synchronize_session=False)
        except Exception:
            pass
        db.session.commit()

    query = base_query
    if after_id is not None and after_id > 0:
        query = query.filter(AdminChatMessage.id > after_id)

    messages = query.order_by(AdminChatMessage.id.asc()).all()
    serialized = [serialize_chat_message(msg) for msg in messages]

    if envelope:
        check_ids = (
            [recipient_id]
            if (recipient_id and recipient_id in eligible_ids)
            else [u.id for u in candidates]
        )
        partner_typing = any(is_typing(uid, current_user.id) for uid in check_ids)
        read_ids = [
            row[0]
            for row in base_query.with_entities(AdminChatMessage.id)
            .filter(
                AdminChatMessage.sender_id == current_user.id,
                AdminChatMessage.is_read.is_(True),
            )
            .all()
        ]
        return jsonify(
            {
                "messages": serialized,
                "read_ids": read_ids,
                "partner_typing": partner_typing,
                "target": normalized_target,
                "active_recipient": (
                    {
                        "id": partner_user.id,
                        "name": partner_user.full_name or partner_user.username,
                        "role": normalized_target,
                    }
                    if partner_user
                    else None
                ),
            }
        )

    return jsonify(serialized)


@farmer_bp.route("/support_chat/typing", methods=["POST"])
@login_required
@role_required("farmer")
def farmer_typing_indicator():
    data = request.get_json(silent=True) or {}
    target = normalize_support_target(data.get("target") or request.args.get("target"))
    recipient_id = _parse_recipient_id(data.get("recipient_id") or request.args.get("recipient_id"))
    _, partner, candidates = resolve_farmer_support_partner(
        current_user.id, target=target, recipient_id=recipient_id
    )
    if recipient_id and partner and partner.id == recipient_id:
        set_typing(current_user.id, partner.id, ttl_seconds=5)
    else:
        for staff in candidates:
            set_typing(current_user.id, staff.id, ttl_seconds=5)
    return jsonify({"ok": True})

CAMBODIA_PROVINCES = [
    ("Phnom Penh", 11.5564, 104.9282),
    ("Kandal", 11.4555, 104.9458),
    ("Siem Reap", 13.3671, 103.8448),
    ("Battambang", 13.0957, 103.2022),
    ("Kampong Cham", 11.9924, 105.4645),
    ("Kampong Chhnang", 12.2500, 104.6667),
    ("Kampong Speu", 11.4533, 104.5209),
    ("Kampong Thom", 12.7111, 104.8887),
    ("Kampot", 10.6104, 104.1815),
    ("Kep", 10.4829, 104.3167),
    ("Koh Kong", 11.6153, 102.9838),
    ("Kratie", 12.4881, 106.0188),
    ("Mondulkiri", 12.4558, 107.1881),
    ("Oddar Meanchey", 14.1817, 103.5176),
    ("Pailin", 12.8489, 102.6093),
    ("Preah Sihanouk", 10.6253, 103.5234),
    ("Preah Vihear", 13.8073, 104.9817),
    ("Prey Veng", 11.4851, 105.3253),
    ("Pursat", 12.5333, 103.9167),
    ("Ratanakiri", 13.7394, 106.9873),
    ("Stung Treng", 13.5259, 105.9683),
    ("Svay Rieng", 11.0879, 105.7993),
    ("Takeo", 10.9908, 104.7850),
    ("Tboung Khmum", 11.9167, 105.6500),
    ("Banteay Meanchey", 13.5859, 102.9737),
]


def resolve_real_location(lat=None, lon=None, ip_address=None):
    """Resolve real-world place name from coordinates or client IP with resilient fallbacks."""
    resolved_lat = None
    resolved_lon = None
    place_name = None

    if lat is not None and lon is not None:
        try:
            f_lat = float(lat)
            f_lon = float(lon)
            if -90 <= f_lat <= 90 and -180 <= f_lon <= 180:
                resolved_lat = f_lat
                resolved_lon = f_lon
        except (ValueError, TypeError):
            pass

    # Check client IP if coordinates were not provided
    if (resolved_lat is None or resolved_lon is None) and ip_address:
        if ip_address not in ("127.0.0.1", "::1") and not ip_address.startswith(("10.", "172.", "192.168.")):
            try:
                import urllib.request
                import json
                ip_url = f"http://ip-api.com/json/{ip_address}?fields=status,country,regionName,city,lat,lon"
                req = urllib.request.Request(ip_url, headers={"User-Agent": "AgriSystem/2.0"})
                with urllib.request.urlopen(req, timeout=1.5) as resp:
                    geo = json.loads(resp.read().decode("utf-8"))
                    if geo.get("status") == "success" and "lat" in geo and "lon" in geo:
                        resolved_lat = float(geo["lat"])
                        resolved_lon = float(geo["lon"])
                        city = geo.get("city") or geo.get("regionName")
                        country = geo.get("country", "Cambodia")
                        place_name = f"{city}, {country}" if city else country
            except Exception:
                pass

    # Check SiteSetting for configured server location fallback
    if resolved_lat is None or resolved_lon is None:
        try:
            from app.models.site_setting import SiteSetting
            srv_lat = SiteSetting.query.get("SERVER_LOCATION_LAT")
            srv_lon = SiteSetting.query.get("SERVER_LOCATION_LON")
            srv_name = SiteSetting.query.get("SERVER_LOCATION_NAME")
            if srv_lat and srv_lon:
                resolved_lat = float(srv_lat.value)
                resolved_lon = float(srv_lon.value)
                if srv_name and srv_name.value:
                    place_name = srv_name.value
        except Exception:
            pass

    if resolved_lat is None or resolved_lon is None:
        resolved_lat = 11.5564
        resolved_lon = 104.9282
        place_name = "Phnom Penh, Cambodia"

    if not place_name:
        try:
            import urllib.request
            import json
            req_url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={resolved_lat}&lon={resolved_lon}"
            req = urllib.request.Request(
                req_url,
                headers={
                    "User-Agent": "AgriSystem/2.0 (Farmer Support Chat)",
                    "Accept-Language": "en,km",
                },
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                geo_data = json.loads(resp.read().decode("utf-8"))
                addr = geo_data.get("address", {})
                parts = []
                for key in ("village", "suburb", "town", "city", "county", "state", "province"):
                    val = addr.get(key)
                    if val and val not in parts:
                        parts.append(val)
                country = addr.get("country", "Cambodia")
                if parts:
                    selected = [parts[0], parts[-1]] if len(parts) > 1 else parts
                    place_name = f"{', '.join(selected)}, {country}"
                elif geo_data.get("display_name"):
                    place_name = geo_data.get("display_name").split(",")[0] + f", {country}"
        except Exception:
            pass

    if not place_name:
        best_dist = float("inf")
        best_prov = "Cambodia"
        for prov, p_lat, p_lon in CAMBODIA_PROVINCES:
            d = (resolved_lat - p_lat) ** 2 + (resolved_lon - p_lon) ** 2
            if d < best_dist:
                best_dist = d
                best_prov = prov
        place_name = f"{best_prov}, Cambodia"

    return {
        "success": True,
        "latitude": resolved_lat,
        "longitude": resolved_lon,
        "display_name": place_name,
        "maps_url": f"https://maps.google.com/?q={resolved_lat},{resolved_lon}",
    }


@farmer_bp.route("/support_chat/location", methods=["GET"])
@login_required
@role_required("farmer")
def get_real_location():
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
    if client_ip and "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    return jsonify(resolve_real_location(lat=lat, lon=lon, ip_address=client_ip))


@farmer_bp.route("/support_chat/location/search", methods=["GET"])
@login_required
@role_required("farmer")
def search_support_location():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([])

    results = []
    q_lower = query.lower()

    # Match in Cambodian provinces
    for prov, p_lat, p_lon in CAMBODIA_PROVINCES:
        if q_lower in prov.lower():
            results.append({
                "name": f"{prov}, Cambodia",
                "latitude": p_lat,
                "longitude": p_lon
            })

    # If query not matched or user searched specific commune/district, query Nominatim
    if len(results) < 3:
        try:
            import urllib.request
            import urllib.parse
            import json
            encoded_q = urllib.parse.quote(f"{query}, Cambodia")
            url = f"https://nominatim.openstreetmap.org/search?q={encoded_q}&countrycodes=kh&format=json&limit=5"
            req = urllib.request.Request(url, headers={"User-Agent": "AgriSystem/2.0 (Farmer Support Chat)"})
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for item in data:
                    try:
                        lat = float(item["lat"])
                        lon = float(item["lon"])
                        d_name = item.get("display_name", "")
                        parts = [p.strip() for p in d_name.split(",") if p.strip()]
                        short_name = ", ".join(parts[:3]) if len(parts) >= 3 else d_name
                        if not any(abs(r["latitude"] - lat) < 0.001 and abs(r["longitude"] - lon) < 0.001 for r in results):
                            results.append({
                                "name": short_name,
                                "latitude": lat,
                                "longitude": lon
                            })
                    except Exception:
                        pass
        except Exception:
            pass

    return jsonify(results[:5])


@farmer_bp.route("/support_chat/send", methods=["POST"])
@login_required
@role_required("farmer")
def send_support_message():
    data = request.get_json(silent=True) or {}
    message_text, attachment_url, attachment_type = support_message_fields(data)
    target = normalize_support_target(data.get("target") or request.args.get("target"))
    recipient_id = _parse_recipient_id(data.get("recipient_id") or request.args.get("recipient_id"))

    if not message_text and not attachment_url:
        return jsonify({"error": "Empty message"}), 400
    
    if attachment_type == "location" and not message_text and attachment_url:
        try:
            lat, lon = map(float, attachment_url.split(","))
            loc = resolve_real_location(lat=lat, lon=lon)
            message_text = f"📍 Location: {loc.get('display_name') or f'{lat:.4f}, {lon:.4f}'}"
        except Exception:
            message_text = "📍 Shared location"

    normalized_target, partner, candidates = resolve_farmer_support_partner(
        current_user.id, target=target, recipient_id=recipient_id
    )
    if not partner:
        return jsonify(
            {"error": "No expert available" if normalized_target == "expert" else "No admin available"}
        ), 404
    
    msg = AdminChatMessage(
        sender_id=current_user.id,
        receiver_id=partner.id,
        message=message_text,
        attachment_url=attachment_url,
        attachment_type=attachment_type
    )
    db.session.add(msg)
    clear_typing(current_user.id, partner.id)
    for staff in candidates:
        clear_typing(current_user.id, staff.id)

    try:
        from app.services.notification_service import notify_role, notify_user, _snippet
        sender_name = current_user.full_name or current_user.username
        detail = message_text or f"Sent an {attachment_type or 'attachment'}"
        is_expert = normalized_target == "expert"
        notif_title = f"Live message from {sender_name}" if is_expert else f"New message from {sender_name}"
        notif_url = "/expert/support_chats" if is_expert else "/admin/support_chats"
        notif_icon = "fas fa-user-md" if is_expert else "fas fa-headset"
        if recipient_id and partner.id == recipient_id:
            notify_user(
                user_id=partner.id,
                kind="support_chat",
                title=notif_title,
                subtitle=_snippet(detail, 60),
                url=notif_url,
                icon=notif_icon,
                level="info",
                source_id=current_user.id,
            )
        else:
            notify_role(
                role_name=normalized_target,
                kind="support_chat",
                title=notif_title,
                subtitle=_snippet(detail, 60),
                url=notif_url,
                icon=notif_icon,
                level="info",
                source_id=current_user.id,
            )
    except Exception:
        pass

    db.session.commit()
    
    return jsonify(
        {
            "success": True,
            "target": normalized_target,
            "message": serialize_chat_message(msg),
        }
    )

@farmer_bp.route("/support_chat/upload", methods=["POST"])
@login_required
@role_required("farmer")
def upload_support_attachment():
    payload, status = handle_support_attachment_upload()
    return jsonify(payload), status
