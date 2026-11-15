"""add structured rule-based diagnosis fields

Revision ID: m8n9o0p1q2r3
Revises: l7g8h9i0j1k2
Create Date: 2026-02-12 09:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "m8n9o0p1q2r3"
down_revision = "l7g8h9i0j1k2"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("expert_diagnoses", schema=None) as batch_op:
        batch_op.add_column(sa.Column("diagnosis_category", sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column("confidence_level", sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column("selected_symptom_ids", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("denied_symptom_ids", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("clarification_answers", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("diagnosis_reason", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("diagnosis_evidence", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("prevention_recommendations", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("feedback_rating", sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column("feedback_comment", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("feedback_submitted_at", sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table("expert_diagnoses", schema=None) as batch_op:
        batch_op.drop_column("feedback_submitted_at")
        batch_op.drop_column("feedback_comment")
        batch_op.drop_column("feedback_rating")
        batch_op.drop_column("prevention_recommendations")
        batch_op.drop_column("diagnosis_evidence")
        batch_op.drop_column("diagnosis_reason")
        batch_op.drop_column("clarification_answers")
        batch_op.drop_column("denied_symptom_ids")
        batch_op.drop_column("selected_symptom_ids")
        batch_op.drop_column("confidence_level")
        batch_op.drop_column("diagnosis_category")
