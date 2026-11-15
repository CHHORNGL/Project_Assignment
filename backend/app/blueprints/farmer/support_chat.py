from app.utils.input_validation import support_message_fields
import os
from datetime import datetime, timedelta
from flask import request, jsonify, current_app
from flask_login import current_user, login_required
from app.extensions import db
from app.models import User, AdminChatMessage
from app.utils.decorators import role_required
from app.utils.support_attachments import save_support_attachment, SupportAttachmentError
from .routes import farmer_bp

@farmer_bp.route("/support_chat/messages", methods=["GET"])
@login_required
@role_required("farmer")
def get_support_messages():
    cutoff = datetime.utcnow() - timedelta(hours=24)
    messages = AdminChatMessage.query.filter(
        db.or_(
            AdminChatMessage.sender_id == current_user.id,
            AdminChatMessage.receiver_id == current_user.id
        ),
        AdminChatMessage.created_at >= cutoff
    ).order_by(AdminChatMessage.created_at.asc()).all()

    return jsonify([{
        "id": msg.id,
        "sender_id": msg.sender_id,
        "message": msg.message,
        "attachment_url": msg.attachment_url,
        "attachment_type": msg.attachment_type,
        "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M:%S")
    } for msg in messages])

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
            req = urllib.request.Request(req_url, headers={"User-Agent": "AgriSystem/2.0 (Farmer Support Chat)"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                geo_data = json.loads(resp.read().decode("utf-8"))
                addr = geo_data.get("address", {})
                parts = []
                for key in ("village", "suburb", "town", "city", "county", "state"):
                    val = addr.get(key)
                    if val and val not in parts:
                        parts.append(val)
                country = addr.get("country", "Cambodia")
                if parts:
                    place_name = f"{', '.join(parts[:2])}, {country}"
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
    data = request.get_json()
    message_text, attachment_url, attachment_type = support_message_fields(data)

    if not message_text and not attachment_url:
        return jsonify({"error": "Empty message"}), 400
    
    if attachment_type == "location" and not message_text and attachment_url:
        try:
            lat, lon = map(float, attachment_url.split(","))
            loc = resolve_real_location(lat=lat, lon=lon)
            message_text = f"📍 Location: {loc.get('display_name') or f'{lat:.4f}, {lon:.4f}'}"
        except Exception:
            message_text = "📍 Shared location"

    admin = User.query.filter(User.roles.any(name='admin')).first()
    if not admin:
        return jsonify({"error": "No admin available"}), 404
    
    msg = AdminChatMessage(
        sender_id=current_user.id,
        receiver_id=admin.id,
        message=message_text,
        attachment_url=attachment_url,
        attachment_type=attachment_type
    )
    db.session.add(msg)

    try:
        from app.services.notification_service import notify_role, _snippet
        sender_name = current_user.full_name or current_user.username
        detail = message_text or f"Sent an {attachment_type or 'attachment'}"
        notify_role(
            role_name="admin",
            kind="support_chat",
            title=f"New message from {sender_name}",
            subtitle=_snippet(detail, 60),
            url="/admin/support_chats",
            icon="fas fa-headset",
            level="info",
            source_id=current_user.id,
        )
    except Exception:
        pass

    db.session.commit()
    
    return jsonify({"success": True})

@farmer_bp.route("/support_chat/upload", methods=["POST"])
@login_required
@role_required("farmer")
def upload_support_attachment():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    try:
        upload_dir = os.path.join(current_app.root_path, 'static', 'uploads', 'chats')
        filename, mime_type = save_support_attachment(request.files['file'], upload_dir)
    except SupportAttachmentError as error:
        return jsonify({'error': str(error)}), error.status_code
    except Exception:
        current_app.logger.exception("Support attachment upload failed")
        return jsonify({'error': 'Could not save attachment'}), 500
    from flask import url_for
    return jsonify({'url': url_for('static', filename=f'uploads/chats/{filename}'), 'mime_type': mime_type})
