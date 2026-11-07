"""initial app tables

Creates every FastAPI-owned table from docs/DATA_MODEL.md. Better Auth tables (`user`, ...)
are not touched. `CREATE EXTENSION vector` is deferred to the M4 Mem0 migration (DECISIONS #28).

Revision ID: 10f12e62ab43
Revises:
Create Date: 2026-11-07 10:55:08.084283

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "10f12e62ab43"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create app tables (reviewed autogenerate output)."""
    op.create_table(
        "app_config",
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_app_config")),
    )
    op.create_table(
        "chat",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("owner_id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("idea", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="interviewing", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat")),
    )
    op.create_index("ix_chat_owner_id_updated_at", "chat", ["owner_id", "updated_at"], unique=False)
    op.create_table(
        "lead",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("owner_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.Column("company", sa.String(length=200), nullable=True),
        sa.Column("budget_range", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="new", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lead")),
        sa.UniqueConstraint("owner_id", name=op.f("uq_lead_owner_id")),
    )
    op.create_table(
        "provider_key",
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("ciphertext", sa.Text(), nullable=False),
        sa.Column("last4", sa.String(length=4), nullable=False),
        sa.Column("updated_by", sa.String(length=255), nullable=False),
        sa.Column("last_test_ok", sa.Boolean(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("provider", name=op.f("pk_provider_key")),
    )
    op.create_table(
        "user_settings",
        sa.Column("owner_id", sa.String(length=255), nullable=False),
        sa.Column(
            "appearance",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("owner_id", name=op.f("pk_user_settings")),
    )
    op.create_table(
        "agent_run",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("chat_id", sa.UUID(), nullable=False),
        sa.Column("agent", sa.String(length=30), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("input_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("output_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "cost_usd", sa.Numeric(precision=10, scale=6), server_default="0", nullable=False
        ),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["chat_id"], ["chat.id"], name=op.f("fk_agent_run_chat_id_chat"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_run")),
    )
    op.create_index(op.f("ix_agent_run_chat_id"), "agent_run", ["chat_id"], unique=False)
    op.create_table(
        "message",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("chat_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["chat_id"], ["chat.id"], name=op.f("fk_message_chat_id_chat"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_message")),
    )
    op.create_index(
        "ix_message_chat_id_created_at", "message", ["chat_id", "created_at"], unique=False
    )
    op.create_table(
        "plan",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("chat_id", sa.UUID(), nullable=False),
        sa.Column("owner_id", sa.String(length=255), nullable=False),
        sa.Column("current_version_id", sa.UUID(), nullable=True),
        sa.Column("share_token", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["chat_id"], ["chat.id"], name=op.f("fk_plan_chat_id_chat"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan")),
        sa.UniqueConstraint("chat_id", name=op.f("uq_plan_chat_id")),
        sa.UniqueConstraint("share_token", name=op.f("uq_plan_share_token")),
    )
    op.create_index(op.f("ix_plan_owner_id"), "plan", ["owner_id"], unique=False)
    op.create_table(
        "booking",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("owner_id", sa.String(length=255), nullable=False),
        sa.Column("plan_id", sa.UUID(), nullable=True),
        sa.Column("calendly_event_uri", sa.Text(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["plan_id"], ["plan.id"], name=op.f("fk_booking_plan_id_plan"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_booking")),
        sa.UniqueConstraint("calendly_event_uri", name=op.f("uq_booking_calendly_event_uri")),
    )
    op.create_index(op.f("ix_booking_owner_id"), "booking", ["owner_id"], unique=False)
    op.create_index(op.f("ix_booking_plan_id"), "booking", ["plan_id"], unique=False)
    op.create_table(
        "plan_version",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("plan_id", sa.UUID(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("price_min", sa.Integer(), nullable=False),
        sa.Column("price_max", sa.Integer(), nullable=False),
        sa.Column("weeks", sa.Integer(), nullable=False),
        sa.Column("change_summary", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["plan_id"], ["plan.id"], name=op.f("fk_plan_version_plan_id_plan"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_version")),
        sa.UniqueConstraint("plan_id", "number", name="uq_plan_version_plan_id_number"),
    )
    op.create_table(
        "plan_file",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("version_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_url", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["version_id"],
            ["plan_version.id"],
            name=op.f("fk_plan_file_version_id_plan_version"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_file")),
    )
    op.create_index(op.f("ix_plan_file_version_id"), "plan_file", ["version_id"], unique=False)


def downgrade() -> None:
    """Drop app tables in reverse dependency order (local / Neon branch only)."""
    op.drop_index(op.f("ix_plan_file_version_id"), table_name="plan_file")
    op.drop_table("plan_file")
    op.drop_table("plan_version")
    op.drop_index(op.f("ix_booking_plan_id"), table_name="booking")
    op.drop_index(op.f("ix_booking_owner_id"), table_name="booking")
    op.drop_table("booking")
    op.drop_index(op.f("ix_plan_owner_id"), table_name="plan")
    op.drop_table("plan")
    op.drop_index("ix_message_chat_id_created_at", table_name="message")
    op.drop_table("message")
    op.drop_index(op.f("ix_agent_run_chat_id"), table_name="agent_run")
    op.drop_table("agent_run")
    op.drop_table("user_settings")
    op.drop_table("provider_key")
    op.drop_table("lead")
    op.drop_index("ix_chat_owner_id_updated_at", table_name="chat")
    op.drop_table("chat")
    op.drop_table("app_config")
