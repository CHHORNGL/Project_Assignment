"""add diagnosis images table

Revision ID: 9f1d3c7a4b28
Revises: 8b4e2a1c9f12
Create Date: 2026-02-05 23:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9f1d3c7a4b28"
down_revision = "8b4e2a1c9f12"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "diagnosis_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("diagnosis_id", sa.Integer(), nullable=False),
        sa.Column("image_path", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["diagnosis_id"], ["expert_diagnoses.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_diagnosis_images_diagnosis_id", "diagnosis_images", ["diagnosis_id"])


def downgrade():
    op.drop_index("ix_diagnosis_images_diagnosis_id", table_name="diagnosis_images")
    op.drop_table("diagnosis_images")
