"""Add mixed agriculture knowledge tables

Revision ID: f3a8c9d2e1b0
Revises: e4f1c2d3b4a5
Create Date: 2026-02-04 23:59:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f3a8c9d2e1b0"
down_revision = "e4f1c2d3b4a5"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS mixed_agri_sources (
            id SERIAL PRIMARY KEY,
            source_title TEXT NOT NULL,
            source_org TEXT NOT NULL,
            publication_year INT,
            source_type TEXT,
            source_url TEXT UNIQUE,
            accessed_at DATE NOT NULL
        );
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS mixed_agri_facts (
            id SERIAL PRIMARY KEY,
            source_id INT NOT NULL REFERENCES mixed_agri_sources(id) ON DELETE CASCADE,
            topic TEXT NOT NULL,
            region TEXT,
            fact_text TEXT NOT NULL,
            metric_value NUMERIC,
            metric_unit TEXT,
            metric_year INT,
            UNIQUE (source_id, fact_text)
        );
        """
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS mixed_agri_facts;")
    op.execute("DROP TABLE IF EXISTS mixed_agri_sources;")
