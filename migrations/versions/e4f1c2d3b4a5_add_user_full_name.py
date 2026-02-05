"""Add full name to users

Revision ID: e4f1c2d3b4a5
Revises: d3e2f1a4b5c6
Create Date: 2026-02-04 22:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e4f1c2d3b4a5"
down_revision = "d3e2f1a4b5c6"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("full_name", sa.String(length=120), nullable=True))


def downgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("full_name")
