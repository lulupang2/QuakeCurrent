from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any

import httpx
from redis.asyncio import Redis
from redis.exceptions import LockNotOwnedError
from sqlalchemy import update
from sqlalchemy.ext.asyncio import async_sessionmaker

from quakecurrent.config import Settings, get_settings
from quakecurrent.db import SessionFactory
from quakecurrent.models import IngestRun
from quakecurrent.repository import UpsertStats, upsert_events
from quakecurrent.schemas import ChangeSignal
from quakecurrent.usgs import normalize_feed

ETAG_KEY = "quakecurrent:usgs:all-day:etag"
LAST_MODIFIED_KEY = "quakecurrent:usgs:all-day:last-modified"


@dataclass(frozen=True, slots=True)
class FeedResponse:
    status_code: int
    payload: dict[str, Any] | None
    etag: str | None
    last_modified: str | None


@dataclass(frozen=True, slots=True)
class IngestResult:
    status: str
    http_status: int | None
    fetched: int
    inserted: int
    updated: int
    unchanged: int
    last_sequence: int | None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


async def fetch_usgs_feed(
    redis: Redis,
    settings: Settings,
    *,
    client: httpx.AsyncClient | None = None,
) -> FeedResponse:
    headers = {
        "Accept": "application/geo+json, application/json",
        "User-Agent": "QuakeCurrent/0.1 (+local portfolio prototype)",
    }
    etag, last_modified = await redis.mget(ETAG_KEY, LAST_MODIFIED_KEY)
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    owns_client = client is None
    if client is None:
        client = httpx.AsyncClient(
            timeout=settings.usgs_timeout_seconds,
            follow_redirects=True,
        )
    try:
        response = await client.get(settings.usgs_all_day_url, headers=headers)
        if response.status_code == 304:
            return FeedResponse(304, None, etag, last_modified)
        response.raise_for_status()
        if len(response.content) > settings.usgs_max_response_bytes:
            raise ValueError("USGS response exceeded the configured byte limit")
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("USGS response is not a JSON object")
        return FeedResponse(
            status_code=response.status_code,
            payload=payload,
            etag=response.headers.get("etag"),
            last_modified=response.headers.get("last-modified"),
        )
    finally:
        if owns_client:
            await client.aclose()


async def _create_run(
    session_factory: async_sessionmaker,
) -> IngestRun:
    async with session_factory() as session:
        run = IngestRun(source_key="usgs", status="running")
        session.add(run)
        await session.commit()
        return run


async def _finish_run(
    session_factory: async_sessionmaker,
    run_id,
    *,
    status: str,
    http_status: int | None,
    stats: UpsertStats | None = None,
    error: str | None = None,
) -> None:
    values = {
        "status": status,
        "http_status": http_status,
        "finished_at": datetime.now(UTC),
        "error": error[:1000] if error else None,
    }
    if stats is not None:
        values.update(
            fetched_count=stats.fetched,
            inserted_count=stats.inserted,
            updated_count=stats.updated,
            unchanged_count=stats.unchanged,
        )
    async with session_factory() as session:
        await session.execute(
            update(IngestRun).where(IngestRun.id == run_id).values(**values)
        )
        await session.commit()


async def _publish_signals(
    redis: Redis,
    channel: str,
    signals: list[ChangeSignal],
) -> None:
    if not signals:
        return
    pipe = redis.pipeline(transaction=False)
    for signal in signals:
        pipe.publish(channel, signal.model_dump_json())
    await pipe.execute()


async def ingest_once(
    *,
    settings: Settings | None = None,
    session_factory: async_sessionmaker = SessionFactory,
    redis: Redis | None = None,
    client: httpx.AsyncClient | None = None,
) -> IngestResult:
    settings = settings or get_settings()
    owns_redis = redis is None
    if redis is None:
        redis = Redis.from_url(settings.redis_url, decode_responses=True)

    lock = redis.lock(
        settings.ingest_lock_name,
        timeout=settings.ingest_lock_seconds,
        blocking_timeout=0,
    )
    acquired = await lock.acquire(blocking=False)
    if not acquired:
        if owns_redis:
            await redis.aclose()
        return IngestResult(
            status="skipped_locked",
            http_status=None,
            fetched=0,
            inserted=0,
            updated=0,
            unchanged=0,
            last_sequence=None,
        )

    run: IngestRun | None = None
    feed: FeedResponse | None = None
    try:
        run = await _create_run(session_factory)
        feed = await fetch_usgs_feed(redis, settings, client=client)
        if feed.status_code == 304:
            stats = UpsertStats(0, 0, 0, 0)
            await _finish_run(
                session_factory,
                run.id,
                status="not_modified",
                http_status=304,
                stats=stats,
            )
            return IngestResult(
                status="not_modified",
                http_status=304,
                fetched=0,
                inserted=0,
                updated=0,
                unchanged=0,
                last_sequence=None,
            )

        events = normalize_feed(feed.payload or {})
        async with session_factory() as session:
            async with session.begin():
                stats, signals = await upsert_events(session, events)

        await _publish_signals(redis, settings.redis_channel, signals)
        cache_values: dict[str, str] = {}
        if feed.etag:
            cache_values[ETAG_KEY] = feed.etag
        if feed.last_modified:
            cache_values[LAST_MODIFIED_KEY] = feed.last_modified
        if cache_values:
            await redis.mset(cache_values)
        await _finish_run(
            session_factory,
            run.id,
            status="succeeded",
            http_status=feed.status_code,
            stats=stats,
        )
        return IngestResult(
            status="succeeded",
            http_status=feed.status_code,
            fetched=stats.fetched,
            inserted=stats.inserted,
            updated=stats.updated,
            unchanged=stats.unchanged,
            last_sequence=signals[-1].seq if signals else None,
        )
    except Exception as exc:
        if run is not None:
            await _finish_run(
                session_factory,
                run.id,
                status="failed",
                http_status=feed.status_code if feed else None,
                error=f"{type(exc).__name__}: {exc}",
            )
        raise
    finally:
        try:
            await lock.release()
        except LockNotOwnedError:
            pass
        if owns_redis:
            await redis.aclose()
