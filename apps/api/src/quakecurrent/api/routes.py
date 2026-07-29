from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from quakecurrent.config import get_settings
from quakecurrent.db import get_session
from quakecurrent.repository import (
    BoundingBox,
    current_sequence,
    event_to_detail,
    event_to_summary,
    get_event,
    list_change_signals,
    list_events,
)
from quakecurrent.schemas import (
    ChangeListMeta,
    ChangeListResponse,
    EarthquakeDetail,
    EventListMeta,
    EventListResponse,
)

router = APIRouter(prefix="/v1")


def _etag_for_snapshot(
    sequence: int,
    bbox: str | None,
    limit: int,
    updated_since: datetime | None,
) -> str:
    key = (
        f"{sequence}|{bbox or ''}|{limit}|"
        f"{updated_since.isoformat() if updated_since else ''}"
    )
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]
    return f'W/"{digest}"'


@router.get("/events", response_model=EventListResponse)
async def events_snapshot(
    request: Request,
    response: Response,
    bbox: str | None = Query(
        default=None,
        description="west,south,east,north; west > east crosses the antimeridian",
        examples=["-180,-90,180,90"],
    ),
    limit: int = Query(default=250, ge=1, le=500),
    updated_since: datetime | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> EventListResponse | Response:
    try:
        parsed_bbox = BoundingBox.parse(bbox)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    sequence = await current_sequence(session)
    etag = _etag_for_snapshot(sequence, bbox, limit, updated_since)
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})

    settings = get_settings()
    rows = await list_events(
        session,
        bbox=parsed_bbox,
        limit=limit,
        snapshot_window_hours=settings.snapshot_window_hours,
        updated_since=updated_since,
    )
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "no-cache"
    return EventListResponse(
        data=[event_to_summary(event) for event in rows],
        meta=EventListMeta(
            count=len(rows),
            sequence=sequence,
            generated_at=datetime.now(UTC),
        ),
    )


@router.get("/events/changes", response_model=ChangeListResponse)
async def event_changes(
    after_seq: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> ChangeListResponse:
    signals, has_more = await list_change_signals(
        session,
        after_seq=after_seq,
        limit=limit,
    )
    next_seq = signals[-1].seq if signals else after_seq
    return ChangeListResponse(
        data=signals,
        meta=ChangeListMeta(
            after_seq=after_seq,
            next_seq=next_seq,
            has_more=has_more,
        ),
    )


@router.get("/events/{event_id}", response_model=EarthquakeDetail)
async def event_detail(
    event_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> EarthquakeDetail:
    event = await get_event(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Earthquake event not found")
    return event_to_detail(event)
