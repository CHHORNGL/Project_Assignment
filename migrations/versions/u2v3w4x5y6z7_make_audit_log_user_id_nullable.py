"""make audit_log user_id nullable for unauthenticated security events

Revision ID: u2v3w4x5y6z7
Revises: a75c737e72fb
Create Date: 2026-09-14 22:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'u2v3w4x5y6z7'
down_revision = 'a75c737e72fb'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.alter_column('user_id',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade():
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.alter_column('user_id',
               existing_type=sa.INTEGER(),
               nullable=False)
