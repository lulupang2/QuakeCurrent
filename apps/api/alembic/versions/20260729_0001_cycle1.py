"""create Cycle 1 earthquake tables

Revision ID: 20260729_0001
Revises:
Create Date: 2026-07-29
"""

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260729_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "earth_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_key", sa.String(length=32), nullable=False),
        sa.Column("external_id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=320), nullable=False),
        sa.Column("magnitude", sa.Float(), nullable=True),
        sa.Column("magnitude_type", sa.String(length=24), nullable=True),
        sa.Column("place", sa.String(length=256), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("depth_km", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column(
            "geom",
            geoalchemy2.types.Geometry(
                geometry_type="POINT",
                srid=4326,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=False,
        ),
        sa.Column("felt", sa.Integer(), nullable=True),
        sa.Column("significance", sa.Integer(), nullable=True),
        sa.Column("tsunami", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=True),
        sa.Column("alert", sa.String(length=16), nullable=True),
        sa.Column("source_url", sa.String(length=512), nullable=True),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_key",
            "external_id",
            name="uq_earth_events_source_external",
        ),
    )
    op.create_index(
        "ix_earth_events_occurred_at",
        "earth_events",
        ["occurred_at"],
        unique=False,
    )
    op.create_index(
        "ix_earth_events_updated_at",
        "earth_events",
        ["updated_at"],
        unique=False,
    )
    op.create_index(
        "ix_earth_events_geom_gist",
        "earth_events",
        ["geom"],
        unique=False,
        postgresql_using="gist",
    )

    op.create_table(
        "event_changes",
        sa.Column(
            "seq",
            sa.BigInteger(),
            sa.Identity(always=False),
            nullable=False,
        ),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("operation", sa.String(length=16), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["earth_events.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("seq"),
    )
    op.create_index(
        "ix_event_changes_event_id",
        "event_changes",
        ["event_id"],
        unique=False,
    )

    op.create_table(
        "ingest_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_key", sa.String(length=32), nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("fetched_count", sa.Integer(), nullable=False),
        sa.Column("inserted_count", sa.Integer(), nullable=False),
        sa.Column("updated_count", sa.Integer(), nullable=False),
        sa.Column("unchanged_count", sa.Integer(), nullable=False),
        sa.Column("error", sa.String(length=1000), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ingest_runs_started_at",
        "ingest_runs",
        ["started_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_ingest_runs_started_at", table_name="ingest_runs")
    op.drop_table("ingest_runs")
    op.drop_index("ix_event_changes_event_id", table_name="event_changes")
    op.drop_table("event_changes")
    op.drop_index(
        "ix_earth_events_geom_gist",
        table_name="earth_events",
        postgresql_using="gist",
    )
    op.drop_index("ix_earth_events_updated_at", table_name="earth_events")
    op.drop_index("ix_earth_events_occurred_at", table_name="earth_events")
    op.drop_table("earth_events")
