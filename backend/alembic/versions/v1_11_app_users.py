"""v1.11: add app_users table for OIDC identity persistence (KPO-06).

Revision ID: v1_11_app_users
Revises: a1b2c3d4e5f7
Create Date: 2026-04-15
"""
import sqlalchemy as sa
from alembic import op


revision = "v1_11_app_users"
down_revision = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("sub", sa.Text, nullable=False),
        sa.Column("email", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "last_seen_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("sub", name="uq_app_users_sub"),
    )


def downgrade() -> None:
    op.drop_table("app_users")
