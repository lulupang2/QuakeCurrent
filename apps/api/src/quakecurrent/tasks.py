from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from quakecurrent.celery_app import celery_app
from quakecurrent.config import get_settings
from quakecurrent.ingest import ingest_once


async def _run_ingest_with_fresh_engine() -> dict:
    settings = get_settings()
    task_engine = create_async_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=2,
        max_overflow=0,
    )
    task_sessions = async_sessionmaker(task_engine, expire_on_commit=False)
    try:
        result = await ingest_once(
            settings=settings,
            session_factory=task_sessions,
        )
        return result.as_dict()
    finally:
        await task_engine.dispose()


@celery_app.task(
    name="quakecurrent.ingest_usgs_all_day",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=30,
    retry_jitter=True,
    max_retries=3,
)
def ingest_usgs_all_day() -> dict:
    return asyncio.run(_run_ingest_with_fresh_engine())
