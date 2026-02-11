from __future__ import annotations

import os
import sys
from datetime import datetime

from flask import url_for

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app import create_app
from app.extensions import db
from app.models.audit_log import AuditLog
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.notification import Notification
from app.models.role import Role
from app.models.support_request import SupportRequest
from app.models.user import User


def _snippet(text: str | None, max_len: int = 60) -> str:
    s = (text or "").strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 3] + "..."


def _action_meta(action: str):
    action_map = {
        "CREATE_USER": ("fas fa-user-plus", "success", "User created"),
        "BAN_USER": ("fas fa-user-slash", "danger", "User banned"),
        "UNBAN_USER": ("fas fa-user-check", "success", "User unbanned"),
        "CHANGE_ROLE": ("fas fa-user-tag", "info", "Role updated"),
    }
    return action_map.get(action, ("fas fa-bell", "info", action.replace("_", " ").title()))


def backfill() -> int:
    """
    One-time bootstrap:
    Convert existing ChatMessage/SupportRequest/AuditLog history into Notification rows,
    so the new notification system doesn't look empty after migrations.
    """
    app = create_app()
    inserted = 0

    with app.app_context():
        existing = {
            (u, k, s)
            for (u, k, s) in db.session.query(
                Notification.user_id, Notification.kind, Notification.source_id
            ).all()
        }

        # Build URLs using Flask routing (request context required for url_for).
        with app.test_request_context("/"):
            admin_support_url = url_for("admin.support_requests")
            admin_audit_url = url_for("admin.audit_logs")

            # Roles -> users
            admins = []
            experts = []
            admin_role = Role.query.filter_by(name="admin").first()
            if admin_role:
                admins = admin_role.users.filter(User.is_active.is_(True)).all()
            expert_role = Role.query.filter_by(name="expert").first()
            if expert_role:
                experts = expert_role.users.filter(User.is_active.is_(True)).all()

            # Preload global history once.
            farmer_msgs = (
                ChatMessage.query
                .join(ChatSession, ChatSession.id == ChatMessage.session_id)
                .filter(ChatMessage.sender == "farmer", ChatSession.session_type == "ai")
                .order_by(ChatMessage.created_at.asc())
                .all()
            )
            expert_msgs = (
                ChatMessage.query
                .filter(ChatMessage.sender == "expert", ChatMessage.farmer_id.isnot(None))
                .order_by(ChatMessage.created_at.asc())
                .all()
            )
            support_all = (
                SupportRequest.query
                .order_by(SupportRequest.created_at.asc())
                .all()
            )
            support_resolved = (
                SupportRequest.query
                .filter(SupportRequest.status == "resolved", SupportRequest.resolved_at.isnot(None))
                .order_by(SupportRequest.resolved_at.asc())
                .all()
            )
            audit_logs = (
                AuditLog.query
                .order_by(AuditLog.created_at.asc())
                .all()
            )

            # Admin notifications: audit logs + support requests.
            for admin in admins:
                read_cutoff = getattr(admin, "notifications_seen_at", None) or datetime.utcnow()

                for req in support_all:
                    key = (admin.id, "support_request_open", req.id)
                    if key in existing:
                        continue
                    n = Notification(
                        user_id=admin.id,
                        kind="support_request_open",
                        title="Support request",
                        subtitle=_snippet(req.message),
                        url=admin_support_url,
                        icon="fas fa-life-ring",
                        level="danger" if req.status == "open" else "info",
                        source_id=req.id,
                        created_at=req.created_at,
                        read_at=read_cutoff if req.created_at <= read_cutoff else None,
                    )
                    db.session.add(n)
                    existing.add(key)
                    inserted += 1

                for log in audit_logs:
                    key = (admin.id, "audit_log", log.id)
                    if key in existing:
                        continue
                    icon, level, title = _action_meta(log.action or "")
                    subtitle_parts = []
                    if getattr(log, "target_user", None):
                        subtitle_parts.append(log.target_user)
                    if getattr(log, "detail", None):
                        subtitle_parts.append(log.detail)
                    subtitle = " - ".join(subtitle_parts) if subtitle_parts else "System activity"
                    n = Notification(
                        user_id=admin.id,
                        kind="audit_log",
                        title=title,
                        subtitle=subtitle,
                        url=admin_audit_url,
                        icon=icon,
                        level=level,
                        source_id=log.id,
                        created_at=log.created_at,
                        read_at=read_cutoff if log.created_at <= read_cutoff else None,
                    )
                    db.session.add(n)
                    existing.add(key)
                    inserted += 1

            # Expert notifications: new farmer messages + resolved support replies.
            for expert in experts:
                read_cutoff = getattr(expert, "notifications_seen_at", None) or datetime.utcnow()

                for msg in farmer_msgs:
                    if not msg.session_id:
                        continue
                    key = (expert.id, "chat_farmer_message", msg.id)
                    if key in existing:
                        continue
                    n = Notification(
                        user_id=expert.id,
                        kind="chat_farmer_message",
                        title="New farmer message",
                        subtitle=_snippet(msg.message),
                        url=url_for("expert.reply_chat_session", session_id=msg.session_id),
                        icon="fas fa-comment-dots",
                        level="info",
                        source_id=msg.id,
                        created_at=msg.created_at,
                        read_at=read_cutoff if msg.created_at <= read_cutoff else None,
                    )
                    db.session.add(n)
                    existing.add(key)
                    inserted += 1

                for req in support_resolved:
                    if req.requester_id != expert.id:
                        continue
                    key = (expert.id, "support_request_resolved", req.id)
                    if key in existing:
                        continue
                    snippet = _snippet(req.message)
                    subtitle = "Your support request was resolved." if not snippet else f"Resolved: {snippet}"
                    n = Notification(
                        user_id=expert.id,
                        kind="support_request_resolved",
                        title="Admin replied",
                        subtitle=subtitle,
                        url=None,
                        icon="fas fa-life-ring",
                        level="info",
                        source_id=req.id,
                        created_at=req.resolved_at or req.created_at,
                        read_at=read_cutoff if (req.resolved_at or req.created_at) <= read_cutoff else None,
                    )
                    db.session.add(n)
                    existing.add(key)
                    inserted += 1

            # Farmer notifications: expert replies + resolved support replies.
            farmers = []
            farmer_role = Role.query.filter_by(name="farmer").first()
            if farmer_role:
                farmers = farmer_role.users.filter(User.is_active.is_(True)).all()
            for farmer in farmers:
                read_cutoff = getattr(farmer, "notifications_seen_at", None) or datetime.utcnow()

                for msg in expert_msgs:
                    if msg.farmer_id != farmer.id:
                        continue
                    key = (farmer.id, "chat_expert_reply", msg.id)
                    if key in existing:
                        continue
                    url = url_for("farmer.chat", session_id=msg.session_id) if msg.session_id else url_for("farmer.chat")
                    n = Notification(
                        user_id=farmer.id,
                        kind="chat_expert_reply",
                        title="Expert replied",
                        subtitle=_snippet(msg.message),
                        url=url,
                        icon="fas fa-user-md",
                        level="success",
                        source_id=msg.id,
                        created_at=msg.created_at,
                        read_at=read_cutoff if msg.created_at <= read_cutoff else None,
                    )
                    db.session.add(n)
                    existing.add(key)
                    inserted += 1

                for req in support_resolved:
                    if req.requester_id != farmer.id:
                        continue
                    key = (farmer.id, "support_request_resolved", req.id)
                    if key in existing:
                        continue
                    snippet = _snippet(req.message)
                    subtitle = "Your support request was resolved." if not snippet else f"Resolved: {snippet}"
                    created_at = req.resolved_at or req.created_at
                    n = Notification(
                        user_id=farmer.id,
                        kind="support_request_resolved",
                        title="Admin replied",
                        subtitle=subtitle,
                        url=None,
                        icon="fas fa-life-ring",
                        level="info",
                        source_id=req.id,
                        created_at=created_at,
                        read_at=read_cutoff if created_at <= read_cutoff else None,
                    )
                    db.session.add(n)
                    existing.add(key)
                    inserted += 1

        db.session.commit()

    return inserted


if __name__ == "__main__":
    count = backfill()
    print(f"Backfill complete. Inserted {count} notification(s).")
