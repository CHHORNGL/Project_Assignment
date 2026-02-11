"""add notifications seen at

Revision ID: h3c4d5e6f7a8
Revises: c2d9a1b4e7f8
Create Date: 2026-02-08
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "h3c4d5e6f7a8"
down_revision = "c2d9a1b4e7f8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("notifications_seen_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_column("users", "notifications_seen_at")

