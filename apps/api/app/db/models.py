"""App tables (docs/DATA_MODEL.md). Better Auth owns `user`; `owner_id` is its id, no FK."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAt, UpdatedAt, UUIDPk

# Better Auth user ids are opaque strings.
OwnerId = String(255)
JsonDict = dict[str, Any]


def _fk(target: str, *, nullable: bool = False, ondelete: str = "CASCADE") -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), ForeignKey(target, ondelete=ondelete), nullable=nullable, index=True
    )


class Chat(UUIDPk, CreatedAt, UpdatedAt, Base):
    __tablename__ = "chat"
    __table_args__ = (Index("ix_chat_owner_id_updated_at", "owner_id", "updated_at"),)

    owner_id: Mapped[str] = mapped_column(OwnerId, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    idea: Mapped[str] = mapped_column(Text, nullable=False)
    # interviewing | generating | ready | failed
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="interviewing")


class Message(UUIDPk, CreatedAt, Base):
    __tablename__ = "message"
    __table_args__ = (Index("ix_message_chat_id_created_at", "chat_id", "created_at"),)

    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant | system
    # text | question_round | answers | agent_event | file | booking
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    content: Mapped[JsonDict] = mapped_column(JSONB, nullable=False)


class Plan(UUIDPk, CreatedAt, Base):
    __tablename__ = "plan"

    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    owner_id: Mapped[str] = mapped_column(OwnerId, nullable=False, index=True)
    # No FK: plan_version also points at plan (cycle). Integrity is kept by the service layer.
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    share_token: Mapped[str | None] = mapped_column(String(64), unique=True)


class PlanVersion(UUIDPk, CreatedAt, Base):
    __tablename__ = "plan_version"
    __table_args__ = (UniqueConstraint("plan_id", "number", name="uq_plan_version_plan_id_number"),)

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan.id", ondelete="CASCADE"), nullable=False
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    data: Mapped[JsonDict] = mapped_column(JSONB, nullable=False)  # full Plan shape
    price_min: Mapped[int] = mapped_column(Integer, nullable=False)
    price_max: Mapped[int] = mapped_column(Integer, nullable=False)
    weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    change_summary: Mapped[str | None] = mapped_column(Text)


class PlanFile(UUIDPk, CreatedAt, Base):
    __tablename__ = "plan_file"

    version_id: Mapped[uuid.UUID] = _fk("plan_version.id")
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # pdf | md | csv | json | mmd | zip
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_url: Mapped[str] = mapped_column(Text, nullable=False)


class AgentRun(UUIDPk, CreatedAt, Base):
    __tablename__ = "agent_run"

    chat_id: Mapped[uuid.UUID] = _fk("chat.id")
    agent: Mapped[str] = mapped_column(String(30), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    cache_read_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    cache_write_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False, server_default="0")
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(Text)


class Booking(UUIDPk, CreatedAt, Base):
    __tablename__ = "booking"

    owner_id: Mapped[str] = mapped_column(OwnerId, nullable=False, index=True)
    plan_id: Mapped[uuid.UUID | None] = _fk("plan.id", nullable=True, ondelete="SET NULL")
    calendly_event_uri: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # scheduled | cancelled …


class Lead(UUIDPk, CreatedAt, Base):
    __tablename__ = "lead"

    owner_id: Mapped[str] = mapped_column(OwnerId, nullable=False, unique=True)
    name: Mapped[str | None] = mapped_column(String(200))
    company: Mapped[str | None] = mapped_column(String(200))
    budget_range: Mapped[str | None] = mapped_column(String(50))
    # new | booked | contacted | won | lost
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="new")
    notes: Mapped[str | None] = mapped_column(Text)


class UserSettings(UpdatedAt, Base):
    __tablename__ = "user_settings"

    owner_id: Mapped[str] = mapped_column(OwnerId, primary_key=True)
    appearance: Mapped[JsonDict] = mapped_column(JSONB, nullable=False, server_default="{}")


class ProviderKey(UpdatedAt, Base):
    __tablename__ = "provider_key"

    provider: Mapped[str] = mapped_column(String(30), primary_key=True)
    ciphertext: Mapped[str] = mapped_column(Text, nullable=False)  # Fernet token
    last4: Mapped[str] = mapped_column(String(4), nullable=False)
    updated_by: Mapped[str] = mapped_column(OwnerId, nullable=False)
    last_test_ok: Mapped[bool | None] = mapped_column(Boolean)


class AppConfig(Base):
    __tablename__ = "app_config"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[JsonDict] = mapped_column(JSONB, nullable=False)
