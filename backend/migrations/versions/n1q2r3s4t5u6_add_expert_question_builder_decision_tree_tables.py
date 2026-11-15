"""add expert question builder decision tree tables

Revision ID: n1q2r3s4t5u6
Revises: m8n9o0p1q2r3
Create Date: 2026-02-12 11:15:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "n1q2r3s4t5u6"
down_revision = "m8n9o0p1q2r3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "expert_questions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("crop_id", sa.Integer(), nullable=True),
        sa.Column("prompt", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_root", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("image_data", sa.LargeBinary(), nullable=True),
        sa.Column("image_mimetype", sa.String(length=120), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["crop_id"], ["crops.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_expert_questions_crop_id", "expert_questions", ["crop_id"], unique=False)
    op.create_index("ix_expert_questions_category", "expert_questions", ["category"], unique=False)

    op.create_table(
        "expert_question_answers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_question_id", sa.Integer(), nullable=True),
        sa.Column("effect_type", sa.String(length=30), nullable=False, server_default="none"),
        sa.Column("symptom_id", sa.Integer(), nullable=True),
        sa.Column("category_value", sa.String(length=40), nullable=True),
        sa.Column("is_terminal", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["next_question_id"], ["expert_questions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["question_id"], ["expert_questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["symptom_id"], ["symptoms.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_expert_question_answers_question_id",
        "expert_question_answers",
        ["question_id"],
        unique=False,
    )
    op.create_index(
        "ix_expert_question_answers_next_question_id",
        "expert_question_answers",
        ["next_question_id"],
        unique=False,
    )
    op.create_index(
        "ix_expert_question_answers_symptom_id",
        "expert_question_answers",
        ["symptom_id"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_expert_question_answers_symptom_id", table_name="expert_question_answers")
    op.drop_index("ix_expert_question_answers_next_question_id", table_name="expert_question_answers")
    op.drop_index("ix_expert_question_answers_question_id", table_name="expert_question_answers")
    op.drop_table("expert_question_answers")

    op.drop_index("ix_expert_questions_category", table_name="expert_questions")
    op.drop_index("ix_expert_questions_crop_id", table_name="expert_questions")
    op.drop_table("expert_questions")
