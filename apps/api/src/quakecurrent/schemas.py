"""QuakeCurrent API schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class EarthquakeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source: str
    external_id: str
    title: str
    magnitude: float | None
    magnitude_type: str | None
    place: str | None
    occurred_at: datetime
    updated_at: datetime
    depth_km: float
    longitude: float
    latitude: float
    tsunami: bool


class EarthquakeDetail(EarthquakeSummary):
    source_updated_at: datetime
    felt: int | None
    significance: int | None
    status: str | None
    alert: str | None
    source_url: str | None


class EventListMeta(BaseModel):
    count: int = Field(ge=0)
    sequence: int = Field(ge=0)
    generated_at: datetime


class EventListResponse(BaseModel):
    data: list[EarthquakeSummary]
    meta: EventListMeta


class ChangeSignal(BaseModel):
    seq: int = Field(ge=1)
    event_id: uuid.UUID
    operation: Literal["created", "updated", "deleted"]
    updated_at: datetime


class ChangeListMeta(BaseModel):
    after_seq: int = Field(ge=0)
    next_seq: int = Field(ge=0)
    has_more: bool


class ChangeListResponse(BaseModel):
    data: list[ChangeSignal]
    meta: ChangeListMeta


class HealthResponse(BaseModel):
    status: Literal["ok", "not_ready"]
    service: str


class ApiErrorResponse(BaseModel):
    detail: str
