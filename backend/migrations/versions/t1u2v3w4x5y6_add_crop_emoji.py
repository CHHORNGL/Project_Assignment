"""add crop emoji field

Revision ID: t1u2v3w4x5y6
Revises: s9t8u7v6w5x4
Create Date: 2026-04-25 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "t1u2v3w4x5y6"
down_revision = "s9t8u7v6w5x4"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("crops", schema=None) as batch_op:
        batch_op.add_column(sa.Column("emoji", sa.String(length=8), nullable=True))


def downgrade():
    with op.batch_alter_table("crops", schema=None) as batch_op:
        batch_op.drop_column("emoji")
