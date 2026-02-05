"""add chat session type

Revision ID: g1a2b3c4d5e6
Revises: f3a8c9d2e1b0
Create Date: 2026-02-05
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "g1a2b3c4d5e6"
down_revision = "f3a8c9d2e1b0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "chat_sessions",
        sa.Column("session_type", sa.String(length=20), nullable=False, server_default="ai")
    )
    op.execute(
        "UPDATE chat_sessions SET session_type = 'rule' "
        "WHERE lower(title) LIKE 'rule chat%'"
    )


def downgrade():
    op.drop_column("chat_sessions", "session_type")
