"""add visual decision tree metadata for expert question builder

Revision ID: p7q8r9s0t1u2
Revises: n1q2r3s4t5u6
Create Date: 2026-02-12 12:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "p7q8r9s0t1u2"
down_revision = "n1q2r3s4t5u6"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("expert_questions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("rule_code", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("canvas_x", sa.Float(), nullable=False, server_default="120"))
        batch_op.add_column(sa.Column("canvas_y", sa.Float(), nullable=False, server_default="120"))
        batch_op.create_index("ix_expert_questions_rule_code", ["rule_code"], unique=True)

    with op.batch_alter_table("expert_question_answers", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("condition_type", sa.String(length=20), nullable=False, server_default="branch")
        )
        batch_op.add_column(sa.Column("final_diagnosis", sa.String(length=200), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id FROM expert_questions ORDER BY id ASC")).fetchall()
    for row in rows:
        bind.execute(
            sa.text("UPDATE expert_questions SET rule_code = :rule_code WHERE id = :qid"),
            {
                "rule_code": f"RULE-{row.id}",
                "qid": row.id,
            },
        )


def downgrade():
    with op.batch_alter_table("expert_question_answers", schema=None) as batch_op:
        batch_op.drop_column("final_diagnosis")
        batch_op.drop_column("condition_type")

    with op.batch_alter_table("expert_questions", schema=None) as batch_op:
        batch_op.drop_index("ix_expert_questions_rule_code")
        batch_op.drop_column("canvas_y")
        batch_op.drop_column("canvas_x")
        batch_op.drop_column("rule_code")
