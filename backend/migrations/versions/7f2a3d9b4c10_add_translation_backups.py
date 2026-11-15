"""add translation backups

Revision ID: 7f2a3d9b4c10
Revises: 6c1b2c1f5d90
Create Date: 2026-02-05 22:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "7f2a3d9b4c10"
down_revision = "6c1b2c1f5d90"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "translation_backups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scope", sa.String(length=32), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table("translation_backups")
