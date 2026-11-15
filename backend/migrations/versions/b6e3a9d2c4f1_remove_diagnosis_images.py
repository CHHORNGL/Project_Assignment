"""remove diagnosis images

Revision ID: b6e3a9d2c4f1
Revises: 9f1d3c7a4b28
Create Date: 2026-02-06 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b6e3a9d2c4f1"
down_revision = "9f1d3c7a4b28"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index("ix_diagnosis_images_diagnosis_id", table_name="diagnosis_images")
    op.drop_table("diagnosis_images")
    with op.batch_alter_table("expert_diagnoses") as batch_op:
        batch_op.drop_column("image_path")


def downgrade():
    with op.batch_alter_table("expert_diagnoses") as batch_op:
        batch_op.add_column(sa.Column("image_path", sa.String(length=255), nullable=True))
    op.create_table(
        "diagnosis_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("diagnosis_id", sa.Integer(), nullable=False),
        sa.Column("image_path", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["diagnosis_id"], ["expert_diagnoses.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_diagnosis_images_diagnosis_id", "diagnosis_images", ["diagnosis_id"])
