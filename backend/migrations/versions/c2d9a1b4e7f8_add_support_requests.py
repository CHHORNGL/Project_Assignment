"""add support requests

Revision ID: c2d9a1b4e7f8
Revises: b6e3a9d2c4f1
Create Date: 2026-02-07 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c2d9a1b4e7f8"
down_revision = "b6e3a9d2c4f1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "support_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("requester_id", sa.Integer(), nullable=False),
        sa.Column("requester_role", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("page", sa.String(length=255), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_by_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"]),
    )
    op.create_index(
        "ix_support_requests_status_created_at",
        "support_requests",
        ["status", "created_at"],
    )


def downgrade():
    op.drop_index("ix_support_requests_status_created_at", table_name="support_requests")
    op.drop_table("support_requests")

