"""add notifications and indexes

Revision ID: i4d5e6f7g8h9
Revises: h3c4d5e6f7a8
Create Date: 2026-02-08
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "i4d5e6f7g8h9"
down_revision = "h3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("subtitle", sa.Text(), nullable=True),
        sa.Column("url", sa.String(length=500), nullable=True),
        sa.Column("icon", sa.String(length=64), nullable=True),
        sa.Column("level", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.UniqueConstraint("user_id", "kind", "source_id", name="uq_notifications_user_kind_source"),
    )

    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_kind", "notifications", ["kind"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_index("ix_notifications_read_at", "notifications", ["read_at"])
    op.create_index("ix_notifications_source_id", "notifications", ["source_id"])
    op.create_index(
        "ix_notifications_user_unread_created",
        "notifications",
        ["user_id", "read_at", "created_at"],
    )

    # Performance indexes for existing notification sources / feeds.
    op.create_index(
        "ix_chat_messages_farmer_sender_created",
        "chat_messages",
        ["farmer_id", "sender", "created_at"],
    )
    op.create_index(
        "ix_support_requests_requester_status_resolved",
        "support_requests",
        ["requester_id", "status", "resolved_at"],
    )
    op.create_index(
        "ix_support_requests_status_created",
        "support_requests",
        ["status", "created_at"],
    )
    op.create_index(
        "ix_audit_logs_created_at",
        "audit_logs",
        ["created_at"],
    )


def downgrade():
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_support_requests_status_created", table_name="support_requests")
    op.drop_index("ix_support_requests_requester_status_resolved", table_name="support_requests")
    op.drop_index("ix_chat_messages_farmer_sender_created", table_name="chat_messages")

    op.drop_index("ix_notifications_user_unread_created", table_name="notifications")
    op.drop_index("ix_notifications_source_id", table_name="notifications")
    op.drop_index("ix_notifications_read_at", table_name="notifications")
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_index("ix_notifications_kind", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")

