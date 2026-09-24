"""Add Khmer cause explanation and prevention tips to diseases.

Revision ID: w4x5y6z7a8b9
Revises: v3w4x5y6z7a8
"""

from alembic import op
import sqlalchemy as sa


revision = "w4x5y6z7a8b9"
down_revision = "v3w4x5y6z7a8"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE diseases ADD COLUMN IF NOT EXISTS cause_explanation_kh TEXT;")
    op.execute("ALTER TABLE diseases ADD COLUMN IF NOT EXISTS prevention_tips_kh TEXT;")


def downgrade():
    op.execute("ALTER TABLE diseases DROP COLUMN IF EXISTS prevention_tips_kh;")
    op.execute("ALTER TABLE diseases DROP COLUMN IF EXISTS cause_explanation_kh;")
