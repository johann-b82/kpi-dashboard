"""Signage ORM models — v1.16 Digital Signage.

Eight tables for the signage CMS: media library, playlists, playlist items,
devices, device tags, two tag-map join tables, and pairing sessions.

All tables carry TIMESTAMPTZ NOT NULL `created_at` / `updated_at` columns
(decision D-12). FKs follow decision D-16: CASCADE where owning parent
controls lifetime; RESTRICT on `playlist_items.media_id` so deleting a media
row that is referenced by a playlist fails loudly instead of silently losing
playlist content. `SignagePairingSession` has a partial-unique index on
`code` scoped to rows still active (not expired, not claimed) per D-15.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class SignageMedia(Base):
    """Media library row: images, videos, PDFs, PPTX, URLs, HTML snippets."""

    __tablename__ = "signage_media"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('image','video','pdf','pptx','url','html')",
            name="ck_signage_media_kind",
        ),
        CheckConstraint(
            "conversion_status IS NULL OR conversion_status IN ('pending','processing','done','failed')",
            name="ck_signage_media_conversion_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(127), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    conversion_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    slide_paths: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    conversion_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    conversion_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    html_content: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    playlist_items: Mapped[list["SignagePlaylistItem"]] = relationship(
        "SignagePlaylistItem", back_populates="media"
    )


class SignagePlaylist(Base):
    """Ordered collection of media items, targeting devices via tag maps."""

    __tablename__ = "signage_playlists"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    items: Mapped[list["SignagePlaylistItem"]] = relationship(
        "SignagePlaylistItem",
        back_populates="playlist",
        cascade="all, delete-orphan",
        order_by="SignagePlaylistItem.position",
    )


class SignagePlaylistItem(Base):
    """One entry in a playlist; references a media row with RESTRICT on delete."""

    __tablename__ = "signage_playlist_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    playlist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("signage_playlists.id", ondelete="CASCADE"),
        nullable=False,
    )
    media_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("signage_media.id", ondelete="RESTRICT"),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_s: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("10")
    )
    transition: Mapped[str | None] = mapped_column(String(32), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    playlist: Mapped["SignagePlaylist"] = relationship(
        "SignagePlaylist", back_populates="items"
    )
    media: Mapped["SignageMedia"] = relationship(
        "SignageMedia", back_populates="playlist_items"
    )


class SignageDevice(Base):
    """Registered signage player device (Raspberry Pi kiosk)."""

    __tablename__ = "signage_devices"
    __table_args__ = (
        CheckConstraint(
            "status IN ('online','offline','pending')",
            name="ck_signage_devices_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    # Phase 42 populates; Text accommodates both opaque-sha256 and JWT formats.
    device_token_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # No FK — item may be deleted while device still cached it locally.
    current_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'offline'")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SignageDeviceTag(Base):
    """Tag label for tag-based playlist routing (e.g., lobby, production)."""

    __tablename__ = "signage_device_tags"
    __table_args__ = (
        Index("uq_signage_device_tags_name", "name", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SignageDeviceTagMap(Base):
    """Join table: which tags apply to which devices (composite PK)."""

    __tablename__ = "signage_device_tag_map"

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("signage_devices.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("signage_device_tags.id", ondelete="CASCADE"),
        primary_key=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SignagePlaylistTagMap(Base):
    """Join table: which tags a playlist targets (composite PK)."""

    __tablename__ = "signage_playlist_tag_map"

    playlist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("signage_playlists.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("signage_device_tags.id", ondelete="CASCADE"),
        primary_key=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SignagePairingSession(Base):
    """6-digit pairing code a fresh Pi displays until an admin claims it.

    Partial-unique index on `code` scoped to rows where `expires_at > now()`
    AND `claimed_at IS NULL` — guarantees only one active pairing session
    per code without blocking historical reuse of codes (D-15).
    """

    __tablename__ = "signage_pairing_sessions"
    __table_args__ = (
        Index(
            "uix_signage_pairing_sessions_code_active",
            "code",
            unique=True,
            postgresql_where=text("expires_at > now() AND claimed_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("signage_devices.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    claimed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
