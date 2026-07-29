from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from geoalchemy2.elements import WKTElement
from sqlalchemy import Select, func, literal_column, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from quakecurrent.models import EarthEvent, EventChange
from quakecurrent.schemas import (
    ChangeSignal,
    EarthquakeDetail,
    EarthquakeSummary,
)
from quakecurrent.usgs import NormalizedEarthquake


@dataclass(frozen=True, slots=True)
class BoundingBox:
    west: float
    south: float
    east: float
    north: float

    @classmethod
    def parse(cls, raw: str | None) -> "BoundingBox | None":
        if raw is None or not raw.strip():
            return None
        try:
            values = [float(part.strip()) for part in raw.split(",")]
        except ValueError as exc:
            raise ValueError("bbox must contain four numeric values") from exc
        if len(values) != 4:
            raise ValueError("bbox must be west,south,east,north")
        west, south, east, north = values
        if not -180 <= west <= 180 or not -180 <= east <= 180:
            raise ValueError("bbox longitude must be between -180 and 180")
        if not -90 <= south <= 90 or not -90 <= north <= 90:
            raise ValueError("bbox latitude must be between -90 and 90")
        if south >= north:
            raise ValueError("bbox south must be less than north")
        return cls(west=west, south=south, east=east, north=north)

    def apply(self, query: Select) -> Select:
        if self.west <= self.east:
            return query.where(
                func.ST_Intersects(
                    EarthEvent.geom,
                    func.ST_MakeEnvelope(
                        self.west,
                        self.south,
                        self.east,
                        self.north,
                        4326,
                    ),
                )
            )
        # A west value greater than east describes a box across the antimeridian.
        return query.where(
            or_(
                func.ST_Intersects(
                    EarthEvent.geom,
                    func.ST_MakeEnvelope(
                        self.west,
                        self.south,
                        180,
                        self.north,
                        4326,
                    ),
                ),
                func.ST_Intersects(
                    EarthEvent.geom,
                    func.ST_MakeEnvelope(
                        -180,
                        self.south,
                        self.east,
                        self.north,
                        4326,
                    ),
                ),
            )
        )


@dataclass(frozen=True, slots=True)
class UpsertStats:
    fetched: int
    inserted: int
    updated: int
    unchanged: int


def event_to_summary(event: EarthEvent) -> EarthquakeSummary:
    return EarthquakeSummary(
        id=event.id,
        source=event.source_key,
        external_id=event.external_id,
        title=event.title,
        magnitude=event.magnitude,
        magnitude_type=event.magnitude_type,
        place=event.place,
        occurred_at=event.occurred_at,
        updated_at=event.updated_at,
        depth_km=event.depth_km,
        longitude=event.longitude,
        latitude=event.latitude,
        tsunami=event.tsunami,
    )


def event_to_detail(event: EarthEvent) -> EarthquakeDetail:
    return EarthquakeDetail(
        **event_to_summary(event).model_dump(),
        source_updated_at=event.source_updated_at,
        felt=event.felt,
        significance=event.significance,
        status=event.status,
        alert=event.alert,
        source_url=event.source_url,
    )


def _event_values(event: NormalizedEarthquake) -> dict:
    return {
        "id": uuid.uuid4(),
        "source_key": event.source_key,
        "external_id": event.external_id,
        "title": event.title,
        "magnitude": event.magnitude,
        "magnitude_type": event.magnitude_type,
        "place": event.place,
        "occurred_at": event.occurred_at,
        "source_updated_at": event.source_updated_at,
        "depth_km": event.depth_km,
        "longitude": event.longitude,
        "latitude": event.latitude,
        "geom": WKTElement(
            f"POINT({event.longitude} {event.latitude})",
            srid=4326,
        ),
        "felt": event.felt,
        "significance": event.significance,
        "tsunami": event.tsunami,
        "status": event.status,
        "alert": event.alert,
        "source_url": event.source_url,
        "content_hash": event.content_hash,
    }


async def upsert_events(
    session: AsyncSession,
    events: list[NormalizedEarthquake],
) -> tuple[UpsertStats, list[ChangeSignal]]:
    inserted_count = 0
    updated_count = 0
    changes: list[EventChange] = []

    for event in events:
        values = _event_values(event)
        statement = insert(EarthEvent).values(**values)
        excluded = statement.excluded
        statement = statement.on_conflict_do_update(
            constraint="uq_earth_events_source_external",
            set_={
                "title": excluded.title,
                "magnitude": excluded.magnitude,
                "magnitude_type": excluded.magnitude_type,
                "place": excluded.place,
                "occurred_at": excluded.occurred_at,
                "source_updated_at": excluded.source_updated_at,
                "depth_km": excluded.depth_km,
                "longitude": excluded.longitude,
                "latitude": excluded.latitude,
                "geom": excluded.geom,
                "felt": excluded.felt,
                "significance": excluded.significance,
                "tsunami": excluded.tsunami,
                "status": excluded.status,
                "alert": excluded.alert,
                "source_url": excluded.source_url,
                "content_hash": excluded.content_hash,
                "updated_at": func.now(),
            },
            where=EarthEvent.content_hash != excluded.content_hash,
        ).returning(
            EarthEvent.id,
            literal_column("(xmax = 0)").label("was_inserted"),
        )
        row = (await session.execute(statement)).first()
        if row is None:
            continue

        operation = "created" if bool(row.was_inserted) else "updated"
        inserted_count += int(operation == "created")
        updated_count += int(operation == "updated")
        change = EventChange(event_id=row.id, operation=operation)
        session.add(change)
        changes.append(change)

    await session.flush()
    signals = [
        ChangeSignal(
            seq=change.seq,
            event_id=change.event_id,
            operation=change.operation,
            updated_at=change.updated_at,
        )
        for change in changes
    ]
    changed_count = inserted_count + updated_count
    return (
        UpsertStats(
            fetched=len(events),
            inserted=inserted_count,
            updated=updated_count,
            unchanged=len(events) - changed_count,
        ),
        signals,
    )


async def current_sequence(session: AsyncSession) -> int:
    value = await session.scalar(select(func.coalesce(func.max(EventChange.seq), 0)))
    return int(value or 0)


async def list_events(
    session: AsyncSession,
    *,
    bbox: BoundingBox | None,
    limit: int,
    snapshot_window_hours: int,
    updated_since: datetime | None = None,
) -> list[EarthEvent]:
    threshold = datetime.now(UTC) - timedelta(hours=snapshot_window_hours)
    query = select(EarthEvent).where(EarthEvent.occurred_at >= threshold)
    if bbox is not None:
        query = bbox.apply(query)
    if updated_since is not None:
        query = query.where(EarthEvent.updated_at > updated_since)
    query = query.order_by(EarthEvent.occurred_at.desc()).limit(limit)
    return list((await session.scalars(query)).all())


async def get_event(
    session: AsyncSession,
    event_id: uuid.UUID,
) -> EarthEvent | None:
    return await session.get(EarthEvent, event_id)


async def list_change_signals(
    session: AsyncSession,
    *,
    after_seq: int,
    limit: int,
) -> tuple[list[ChangeSignal], bool]:
    rows = list(
        (
            await session.scalars(
                select(EventChange)
                .where(EventChange.seq > after_seq)
                .order_by(EventChange.seq.asc())
                .limit(limit + 1)
            )
        ).all()
    )
    has_more = len(rows) > limit
    page = rows[:limit]
    return (
        [
            ChangeSignal(
                seq=row.seq,
                event_id=row.event_id,
                operation=row.operation,
                updated_at=row.updated_at,
            )
            for row in page
        ],
        has_more,
    )
