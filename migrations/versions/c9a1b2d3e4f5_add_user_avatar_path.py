"""Add user avatar path

Revision ID: c9a1b2d3e4f5
Revises: b6f2a9a9c6a4
Create Date: 2026-02-04 19:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c9a1b2d3e4f5"
down_revision = "b6f2a9a9c6a4"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("avatar_path", sa.String(length=255), nullable=True))


def downgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("avatar_path")
