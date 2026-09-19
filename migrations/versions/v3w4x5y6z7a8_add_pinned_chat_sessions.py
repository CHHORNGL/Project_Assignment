"""Add pin state to farmer chat sessions.

Revision ID: v3w4x5y6z7a8
Revises: u2v3w4x5y6z7
"""

from alembic import op
import sqlalchemy as sa


revision = "v3w4x5y6z7a8"
down_revision = "u2v3w4x5y6z7"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("chat_sessions", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("is_pinned", sa.Boolean(), server_default=sa.false(), nullable=False)
        )


def downgrade():
    with op.batch_alter_table("chat_sessions", schema=None) as batch_op:
        batch_op.drop_column("is_pinned")
