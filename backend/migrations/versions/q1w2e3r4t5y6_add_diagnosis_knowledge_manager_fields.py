"""add diagnosis knowledge manager fields

Revision ID: q1w2e3r4t5y6
Revises: p7q8r9s0t1u2
Create Date: 2026-02-12 16:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "q1w2e3r4t5y6"
down_revision = "p7q8r9s0t1u2"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("diseases", schema=None) as batch_op:
        batch_op.add_column(sa.Column("cause_explanation", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("prevention_tips", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("reference_links", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("knowledge_image_data", sa.LargeBinary(), nullable=True))
        batch_op.add_column(sa.Column("knowledge_image_mimetype", sa.String(length=120), nullable=True))


def downgrade():
    with op.batch_alter_table("diseases", schema=None) as batch_op:
        batch_op.drop_column("knowledge_image_mimetype")
        batch_op.drop_column("knowledge_image_data")
        batch_op.drop_column("reference_links")
        batch_op.drop_column("prevention_tips")
        batch_op.drop_column("cause_explanation")
