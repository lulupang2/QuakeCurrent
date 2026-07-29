from __future__ import annotations

import json
import os
from dataclasses import replace
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from quakecurrent.models import Base
from quakecurrent.repository import current_sequence, upsert_events
from quakecurrent.usgs import normalize_feed

FIXTURE = Path(__file__).parent / "fixtures" / "usgs_all_day.json"
DATABASE_URL = os.getenv("QUAKECURRENT_TEST_DATABASE_URL")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not DATABASE_URL,
        reason="QUAKECURRENT_TEST_DATABASE_URL is not set",
    ),
]


@pytest.mark.asyncio
async def test_upsert_is_idempotent_and_sequences_real_changes() -> None:
    engine = create_async_engine(DATABASE_URL)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    events = normalize_feed(json.loads(FIXTURE.read_text(encoding="utf-8")))

    async with engine.begin() as connection:
        await connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await connection.run_sync(Base.metadata.create_all)

    try:
        async with sessions() as session:
            transaction = await session.begin()
            first, first_signals = await upsert_events(session, events)
            second, second_signals = await upsert_events(session, events)
            revised_events = [
                replace(events[0], magnitude=(events[0].magnitude or 0) + 0.1),
                events[1],
            ]
            third, third_signals = await upsert_events(session, revised_events)
            sequence = await current_sequence(session)

            assert first.inserted == 2
            assert first.updated == 0
            assert len(first_signals) == 2
            assert second.unchanged == 2
            assert second_signals == []
            assert third.updated == 1
            assert third.unchanged == 1
            assert len(third_signals) == 1
            assert sequence >= third_signals[-1].seq
            await transaction.rollback()
    finally:
        await engine.dispose()
