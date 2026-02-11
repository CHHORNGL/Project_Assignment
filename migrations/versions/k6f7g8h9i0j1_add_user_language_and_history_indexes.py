"""Add user language and history indexes

Revision ID: k6f7g8h9i0j1
Revises: j5e6f7g8h9i0
Create Date: 2026-02-08
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "k6f7g8h9i0j1"
down_revision = "j5e6f7g8h9i0"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("language", sa.String(length=10), nullable=False, server_default="en")
        )

    # History/performance indexes for core feeds.
    op.create_index(
        "ix_chat_sessions_farmer_type_updated",
        "chat_sessions",
        ["farmer_id", "session_type", "updated_at"],
    )
    op.create_index(
        "ix_chat_messages_session_created",
        "chat_messages",
        ["session_id", "created_at"],
    )
    op.create_index(
        "ix_expert_diagnoses_farmer_created",
        "expert_diagnoses",
        ["farmer_id", "created_at"],
    )
    op.create_index(
        "ix_expert_diagnoses_status_created",
        "expert_diagnoses",
        ["status", "created_at"],
    )
    op.create_index(
        "ix_expert_diagnoses_expert_created",
        "expert_diagnoses",
        ["expert_id", "created_at"],
    )


def downgrade():
    op.drop_index("ix_expert_diagnoses_expert_created", table_name="expert_diagnoses")
    op.drop_index("ix_expert_diagnoses_status_created", table_name="expert_diagnoses")
    op.drop_index("ix_expert_diagnoses_farmer_created", table_name="expert_diagnoses")
    op.drop_index("ix_chat_messages_session_created", table_name="chat_messages")
    op.drop_index("ix_chat_sessions_farmer_type_updated", table_name="chat_sessions")

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("language")

