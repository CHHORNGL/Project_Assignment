"""add dynamic theme manager tables

Revision ID: s9t8u7v6w5x4
Revises: r2t4y6u8i0o1
Create Date: 2026-02-20 02:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "s9t8u7v6w5x4"
down_revision = "r2t4y6u8i0o1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "theme_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scope", sa.String(length=32), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("tokens_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], name="fk_theme_profiles_created_by_id_users"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scope", "slug", name="uq_theme_profiles_scope_slug"),
    )
    op.create_index("ix_theme_profiles_scope", "theme_profiles", ["scope"], unique=False)
    op.create_index("ix_theme_profiles_is_active", "theme_profiles", ["is_active"], unique=False)
    op.create_index("ix_theme_profiles_created_by_id", "theme_profiles", ["created_by_id"], unique=False)
    op.create_index("ix_theme_profiles_created_at", "theme_profiles", ["created_at"], unique=False)
    op.create_index("ix_theme_profiles_updated_at", "theme_profiles", ["updated_at"], unique=False)

    op.create_table(
        "theme_runtime_states",
        sa.Column("scope", sa.String(length=32), nullable=False),
        sa.Column("active_profile_id", sa.Integer(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("auto_schedule_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("cache_ttl_seconds", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("radius_mode", sa.String(length=16), nullable=False, server_default="soft"),
        sa.Column("density_mode", sa.String(length=16), nullable=False, server_default="comfortable"),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["active_profile_id"],
            ["theme_profiles.id"],
            name="fk_theme_runtime_states_active_profile_id_theme_profiles",
        ),
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"], name="fk_theme_runtime_states_updated_by_id_users"),
        sa.PrimaryKeyConstraint("scope"),
    )
    op.create_index("ix_theme_runtime_states_active_profile_id", "theme_runtime_states", ["active_profile_id"], unique=False)
    op.create_index("ix_theme_runtime_states_updated_by_id", "theme_runtime_states", ["updated_by_id"], unique=False)
    op.create_index("ix_theme_runtime_states_updated_at", "theme_runtime_states", ["updated_at"], unique=False)

    op.create_table(
        "theme_schedules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scope", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("profile_id", sa.Integer(), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"),
        sa.Column("weekdays_json", sa.String(length=64), nullable=True),
        sa.Column("start_time", sa.String(length=5), nullable=True),
        sa.Column("end_time", sa.String(length=5), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], name="fk_theme_schedules_created_by_id_users"),
        sa.ForeignKeyConstraint(["profile_id"], ["theme_profiles.id"], name="fk_theme_schedules_profile_id_theme_profiles"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_theme_schedules_scope", "theme_schedules", ["scope"], unique=False)
    op.create_index("ix_theme_schedules_profile_id", "theme_schedules", ["profile_id"], unique=False)
    op.create_index("ix_theme_schedules_priority", "theme_schedules", ["priority"], unique=False)
    op.create_index("ix_theme_schedules_is_enabled", "theme_schedules", ["is_enabled"], unique=False)
    op.create_index("ix_theme_schedules_created_by_id", "theme_schedules", ["created_by_id"], unique=False)
    op.create_index("ix_theme_schedules_created_at", "theme_schedules", ["created_at"], unique=False)
    op.create_index("ix_theme_schedules_updated_at", "theme_schedules", ["updated_at"], unique=False)


def downgrade():
    op.drop_index("ix_theme_schedules_updated_at", table_name="theme_schedules")
    op.drop_index("ix_theme_schedules_created_at", table_name="theme_schedules")
    op.drop_index("ix_theme_schedules_created_by_id", table_name="theme_schedules")
    op.drop_index("ix_theme_schedules_is_enabled", table_name="theme_schedules")
    op.drop_index("ix_theme_schedules_priority", table_name="theme_schedules")
    op.drop_index("ix_theme_schedules_profile_id", table_name="theme_schedules")
    op.drop_index("ix_theme_schedules_scope", table_name="theme_schedules")
    op.drop_table("theme_schedules")

    op.drop_index("ix_theme_runtime_states_updated_at", table_name="theme_runtime_states")
    op.drop_index("ix_theme_runtime_states_updated_by_id", table_name="theme_runtime_states")
    op.drop_index("ix_theme_runtime_states_active_profile_id", table_name="theme_runtime_states")
    op.drop_table("theme_runtime_states")

    op.drop_index("ix_theme_profiles_updated_at", table_name="theme_profiles")
    op.drop_index("ix_theme_profiles_created_at", table_name="theme_profiles")
    op.drop_index("ix_theme_profiles_created_by_id", table_name="theme_profiles")
    op.drop_index("ix_theme_profiles_is_active", table_name="theme_profiles")
    op.drop_index("ix_theme_profiles_scope", table_name="theme_profiles")
    op.drop_table("theme_profiles")
