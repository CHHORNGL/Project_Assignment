"""add diagnosis image path

Revision ID: 8b4e2a1c9f12
Revises: 7f2a3d9b4c10
Create Date: 2026-02-05 22:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8b4e2a1c9f12"
down_revision = "7f2a3d9b4c10"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("expert_diagnoses", schema=None) as batch_op:
        batch_op.add_column(sa.Column("image_path", sa.String(length=255), nullable=True))


def downgrade():
    with op.batch_alter_table("expert_diagnoses", schema=None) as batch_op:
        batch_op.drop_column("image_path")
