from __future__ import annotations

import json
from dataclasses import replace
from datetime import timedelta
from pathlib import Path

from quakecurrent.usgs import normalize_feed

FIXTURE = Path(__file__).parent / "fixtures" / "usgs_all_day.json"


def load_fixture() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_normalize_feed_deduplicates_by_latest_source_update() -> None:
    events = normalize_feed(load_fixture())

    assert [event.external_id for event in events] == [
        "us7000alpha",
        "ci408beta",
    ]
    assert events[0].magnitude == 4.3
    assert events[0].felt == 14
    assert events[0].longitude == 142.31
    assert events[0].depth_km == 31.4


def test_content_hash_is_stable_for_bookkeeping_timestamp_only() -> None:
    event = normalize_feed(load_fixture())[0]
    timestamp_only_revision = replace(
        event,
        source_updated_at=event.source_updated_at + timedelta(minutes=1),
    )

    assert timestamp_only_revision.content_hash == event.content_hash


def test_content_hash_changes_for_visible_event_revision() -> None:
    event = normalize_feed(load_fixture())[0]
    revised = replace(event, magnitude=5.1)

    assert revised.content_hash != event.content_hash
    assert len(event.content_hash) == 64
