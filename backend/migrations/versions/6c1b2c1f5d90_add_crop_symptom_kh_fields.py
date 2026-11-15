"""add crop and symptom kh fields

Revision ID: 6c1b2c1f5d90
Revises: fbda757b2e90
Create Date: 2026-02-05 21:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "6c1b2c1f5d90"
down_revision = "fbda757b2e90"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("crops", schema=None) as batch_op:
        batch_op.add_column(sa.Column("name_kh", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("description_kh", sa.Text(), nullable=True))

    with op.batch_alter_table("symptoms", schema=None) as batch_op:
        batch_op.add_column(sa.Column("name_kh", sa.String(length=180), nullable=True))
        batch_op.add_column(sa.Column("description_kh", sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table("symptoms", schema=None) as batch_op:
        batch_op.drop_column("description_kh")
        batch_op.drop_column("name_kh")

    with op.batch_alter_table("crops", schema=None) as batch_op:
        batch_op.drop_column("description_kh")
        batch_op.drop_column("name_kh")
