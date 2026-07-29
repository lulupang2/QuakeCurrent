from __future__ import annotations

import asyncio
import json
import os
import time

import httpx
import pytest
import websockets

API_URL = os.getenv("QUAKECURRENT_TEST_API_URL")
WS_URL = os.getenv("QUAKECURRENT_TEST_WS_URL")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not API_URL or not WS_URL,
        reason="live stack URLs are not set",
    ),
]


def _wait_for_snapshot(
    client: httpx.Client,
    *,
    limit: int,
    timeout_seconds: float = 75,
) -> httpx.Response:
    deadline = time.monotonic() + timeout_seconds
    while True:
        response = client.get("/v1/events", params={"limit": limit})
        response.raise_for_status()
        if response.json()["data"]:
            return response
        if time.monotonic() >= deadline:
            pytest.fail("initial USGS ingestion did not populate the live stack")
        time.sleep(1)


async def _wait_for_async_snapshot(
    client: httpx.AsyncClient,
    *,
    limit: int,
    timeout_seconds: float = 75,
) -> dict:
    deadline = time.monotonic() + timeout_seconds
    while True:
        response = await client.get("/v1/events", params={"limit": limit})
        response.raise_for_status()
        snapshot = response.json()
        if snapshot["data"]:
            return snapshot
        if time.monotonic() >= deadline:
            pytest.fail("initial USGS ingestion did not populate the live stack")
        await asyncio.sleep(1)


def test_live_rest_snapshot_etag_catchup_and_detail() -> None:
    with httpx.Client(base_url=API_URL, timeout=5) as client:
        readiness = client.get("/readyz")
        snapshot = _wait_for_snapshot(client, limit=2)
        spatial_snapshot = client.get(
            "/v1/events",
            params={"limit": 2, "bbox": "-180,-90,180,90"},
        )
        etag = snapshot.headers["etag"]
        not_modified = client.get(
            "/v1/events",
            params={"limit": 2},
            headers={"If-None-Match": etag},
        )
        changes = client.get(
            "/v1/events/changes",
            params={"after_seq": 0, "limit": 3},
        )
        detail = client.get(f"/v1/events/{snapshot.json()['data'][0]['id']}")

    assert readiness.status_code == 200
    assert snapshot.status_code == 200
    assert snapshot.json()["meta"]["count"] == 2
    assert spatial_snapshot.status_code == 200
    assert spatial_snapshot.json()["meta"]["count"] == 2
    assert not_modified.status_code == 304
    assert changes.status_code == 200
    assert changes.json()["data"]
    assert detail.status_code == 200
    assert detail.json()["external_id"]


@pytest.mark.asyncio
async def test_live_websocket_reconnect_catches_up_from_sequence() -> None:
    async with httpx.AsyncClient(base_url=API_URL, timeout=5) as client:
        snapshot = await _wait_for_async_snapshot(client, limit=1)
    sequence = snapshot["meta"]["sequence"]

    async with websockets.connect(
        f"{WS_URL}/v1/ws/events?after_seq={max(0, sequence - 1)}",
        origin="http://localhost:3000",
        open_timeout=5,
    ) as websocket:
        signal = json.loads(await websocket.recv())

    assert signal["seq"] >= sequence
    assert set(signal) == {"seq", "event_id", "operation", "updated_at"}
    assert signal["operation"] in {"created", "updated", "deleted"}
