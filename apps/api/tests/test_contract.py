from __future__ import annotations

from quakecurrent.celery_app import celery_app
from quakecurrent.api.websocket import router as websocket_router
from quakecurrent.main import app, health
from quakecurrent.tasks import ingest_usgs_all_day


def test_openapi_exposes_cycle_one_contract() -> None:
    document = app.openapi()
    paths = document["paths"]

    assert document["info"]["title"] == "QuakeCurrent API"
    assert "/v1/events" in paths
    assert "/v1/events/changes" in paths
    assert "/v1/events/{event_id}" in paths
    assert "/healthz" in paths
    assert "/readyz" in paths
    assert any(
        getattr(route, "path", None) == "/v1/ws/events"
        for route in websocket_router.routes
    )


def test_contract_wire_fields_remain_snake_case() -> None:
    schemas = app.openapi()["components"]["schemas"]
    summary_fields = schemas["EarthquakeSummary"]["properties"]
    change_fields = schemas["ChangeSignal"]["properties"]

    assert "external_id" in summary_fields
    assert "occurred_at" in summary_fields
    assert "magnitude_type" in summary_fields
    assert set(change_fields) == {
        "seq",
        "event_id",
        "operation",
        "updated_at",
    }


async def test_service_and_worker_use_quakecurrent_identity() -> None:
    response = await health()

    assert response.service == "quakecurrent-api"
    assert celery_app.conf.include == ["quakecurrent.tasks"]
    assert ingest_usgs_all_day.name == "quakecurrent.ingest_usgs_all_day"
