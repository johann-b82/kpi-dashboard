"""v1.11: rename default app_settings.app_name KPI Light → KPI Dashboard (Phase 30.1, D-04).

Revision ID: v1_11_rename_app_name
Revises: v1_11_app_users
Create Date: 2026-04-15
"""
from alembic import op


revision = "v1_11_rename_app_name"
down_revision = "v1_11_app_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE app_settings
        SET app_name = 'KPI Dashboard'
        WHERE app_name = 'KPI Light'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE app_settings
        SET app_name = 'KPI Light'
        WHERE app_name = 'KPI Dashboard'
        """
    )
