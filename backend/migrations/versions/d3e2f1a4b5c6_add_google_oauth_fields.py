"""Add Google OAuth fields to users

Revision ID: d3e2f1a4b5c6
Revises: c9a1b2d3e4f5
Create Date: 2026-02-04 21:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d3e2f1a4b5c6"
down_revision = "c9a1b2d3e4f5"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("email", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("google_sub", sa.String(length=255), nullable=True))
        batch_op.create_unique_constraint("uq_users_email", ["email"])
        batch_op.create_unique_constraint("uq_users_google_sub", ["google_sub"])


def downgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_constraint("uq_users_google_sub", type_="unique")
        batch_op.drop_constraint("uq_users_email", type_="unique")
        batch_op.drop_column("google_sub")
        batch_op.drop_column("email")
