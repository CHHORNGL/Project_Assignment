"""add disease agriculture taxonomy fields

Revision ID: r2t4y6u8i0o1
Revises: q1w2e3r4t5y6
Create Date: 2026-02-12 16:55:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "r2t4y6u8i0o1"
down_revision = "q1w2e3r4t5y6"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("diseases", schema=None) as batch_op:
        batch_op.add_column(sa.Column("agriculture_category", sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column("agriculture_sub_category", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("reference_scope", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("visual_input_notes", sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table("diseases", schema=None) as batch_op:
        batch_op.drop_column("visual_input_notes")
        batch_op.drop_column("reference_scope")
        batch_op.drop_column("agriculture_sub_category")
        batch_op.drop_column("agriculture_category")
