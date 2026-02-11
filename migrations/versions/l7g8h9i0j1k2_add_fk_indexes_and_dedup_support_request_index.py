"""Add FK indexes + dedup support_requests status/created index

Revision ID: l7g8h9i0j1k2
Revises: k6f7g8h9i0j1
Create Date: 2026-02-08
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "l7g8h9i0j1k2"
down_revision = "k6f7g8h9i0j1"
branch_labels = None
depends_on = None


def upgrade():
    # Foreign-key / common-filter indexes (fixes seq scans + speeds joins/deletes).
    op.create_index(
        "ix_diseases_crop_id_name",
        "diseases",
        ["crop_id", "name"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_rules_disease_id",
        "rules",
        ["disease_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_mixed_agri_facts_source_id_id",
        "mixed_agri_facts",
        ["source_id", "id"],
        if_not_exists=True,
    )

    # Expert diagnoses FK indexes (often filtered/joined in dashboards).
    op.create_index(
        "ix_expert_diagnoses_crop_created",
        "expert_diagnoses",
        ["crop_id", "created_at"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_expert_diagnoses_disease_id",
        "expert_diagnoses",
        ["disease_id"],
        if_not_exists=True,
    )

    # Audit logs: common admin filter pattern.
    op.create_index(
        "ix_audit_logs_user_created",
        "audit_logs",
        ["user_id", "created_at"],
        if_not_exists=True,
    )

    # Support requests: help joins/filters on resolver.
    op.create_index(
        "ix_support_requests_resolved_by_id",
        "support_requests",
        ["resolved_by_id"],
        if_not_exists=True,
    )

    # Association tables: add reverse-direction indexes for permission/role/symptom lookups
    # and to speed FK checks on deletes/updates.
    op.create_index(
        "ix_user_roles_role_id_user_id",
        "user_roles",
        ["role_id", "user_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_role_permissions_permission_id_role_id",
        "role_permissions",
        ["permission_id", "role_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_rule_symptoms_symptom_id_rule_id",
        "rule_symptoms",
        ["symptom_id", "rule_id"],
        if_not_exists=True,
    )

    # Deduplicate support_requests(status, created_at) indexes:
    # - c2d9a1b4e7f8 created ix_support_requests_status_created_at
    # - i4d5e6f7g8h9 created ix_support_requests_status_created
    # Keep the newer canonical name and drop the older duplicate.
    op.drop_index(
        "ix_support_requests_status_created_at",
        table_name="support_requests",
        if_exists=True,
    )


def downgrade():
    # Recreate the dropped duplicate index to restore pre-upgrade state.
    op.create_index(
        "ix_support_requests_status_created_at",
        "support_requests",
        ["status", "created_at"],
        if_not_exists=True,
    )

    op.drop_index(
        "ix_rule_symptoms_symptom_id_rule_id",
        table_name="rule_symptoms",
        if_exists=True,
    )
    op.drop_index(
        "ix_role_permissions_permission_id_role_id",
        table_name="role_permissions",
        if_exists=True,
    )
    op.drop_index(
        "ix_user_roles_role_id_user_id",
        table_name="user_roles",
        if_exists=True,
    )

    op.drop_index(
        "ix_support_requests_resolved_by_id",
        table_name="support_requests",
        if_exists=True,
    )
    op.drop_index(
        "ix_audit_logs_user_created",
        table_name="audit_logs",
        if_exists=True,
    )
    op.drop_index(
        "ix_expert_diagnoses_disease_id",
        table_name="expert_diagnoses",
        if_exists=True,
    )
    op.drop_index(
        "ix_expert_diagnoses_crop_created",
        table_name="expert_diagnoses",
        if_exists=True,
    )

    op.drop_index(
        "ix_mixed_agri_facts_source_id_id",
        table_name="mixed_agri_facts",
        if_exists=True,
    )
    op.drop_index(
        "ix_rules_disease_id",
        table_name="rules",
        if_exists=True,
    )
    op.drop_index(
        "ix_diseases_crop_id_name",
        table_name="diseases",
        if_exists=True,
    )

