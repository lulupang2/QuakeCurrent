"""USGS feed normalization for QuakeCurrent."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any


class InvalidFeedError(ValueError):
    """Raised when a USGS payload is not usable as a GeoJSON feed."""


@dataclass(frozen=True, slots=True)
class NormalizedEarthquake:
    source_key: str
    external_id: str
    title: str
    magnitude: float | None
    magnitude_type: str | None
    place: str | None
    occurred_at: datetime
    source_updated_at: datetime
    depth_km: float
    longitude: float
    latitude: float
    felt: int | None
    significance: int | None
    tsunami: bool
    status: str | None
    alert: str | None
    source_url: str | None

    @property
    def content_hash(self) -> str:
        return content_hash(self)


def _datetime_from_millis(value: Any, field_name: str) -> datetime:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise InvalidFeedError(f"{field_name} must be an epoch millisecond value")
    try:
        return datetime.fromtimestamp(value / 1000, tz=UTC)
    except (OverflowError, OSError, ValueError) as exc:
        raise InvalidFeedError(f"{field_name} is outside the datetime range") from exc


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return int(value)


def _optional_text(value: Any, max_length: int) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value[:max_length] if value else None


def normalize_feature(feature: dict[str, Any]) -> NormalizedEarthquake:
    external_id = feature.get("id")
    if not isinstance(external_id, str) or not external_id.strip():
        raise InvalidFeedError("feature.id is required")

    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") != "Point":
        raise InvalidFeedError(f"{external_id}: geometry must be a Point")
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) < 3:
        raise InvalidFeedError(f"{external_id}: three coordinates are required")

    longitude = _optional_float(coordinates[0])
    latitude = _optional_float(coordinates[1])
    depth_km = _optional_float(coordinates[2])
    if longitude is None or not -180 <= longitude <= 180:
        raise InvalidFeedError(f"{external_id}: longitude is invalid")
    if latitude is None or not -90 <= latitude <= 90:
        raise InvalidFeedError(f"{external_id}: latitude is invalid")
    if depth_km is None:
        raise InvalidFeedError(f"{external_id}: depth is invalid")

    properties = feature.get("properties")
    if not isinstance(properties, dict):
        raise InvalidFeedError(f"{external_id}: properties are required")

    occurred_at = _datetime_from_millis(properties.get("time"), "time")
    updated_value = properties.get("updated", properties.get("time"))
    source_updated_at = _datetime_from_millis(updated_value, "updated")
    place = _optional_text(properties.get("place"), 256)
    title = _optional_text(properties.get("title"), 320)
    if title is None:
        magnitude = _optional_float(properties.get("mag"))
        magnitude_label = "Unknown" if magnitude is None else f"M {magnitude:.1f}"
        title = f"{magnitude_label} · {place or 'Unspecified location'}"

    return NormalizedEarthquake(
        source_key="usgs",
        external_id=external_id.strip()[:128],
        title=title,
        magnitude=_optional_float(properties.get("mag")),
        magnitude_type=_optional_text(properties.get("magType"), 24),
        place=place,
        occurred_at=occurred_at,
        source_updated_at=source_updated_at,
        depth_km=depth_km,
        longitude=longitude,
        latitude=latitude,
        felt=_optional_int(properties.get("felt")),
        significance=_optional_int(properties.get("sig")),
        tsunami=properties.get("tsunami") == 1,
        status=_optional_text(properties.get("status"), 24),
        alert=_optional_text(properties.get("alert"), 16),
        source_url=_optional_text(properties.get("url"), 512),
    )


def normalize_feed(payload: dict[str, Any]) -> list[NormalizedEarthquake]:
    if payload.get("type") != "FeatureCollection":
        raise InvalidFeedError("USGS payload must be a FeatureCollection")
    features = payload.get("features")
    if not isinstance(features, list):
        raise InvalidFeedError("USGS payload must contain a features array")

    latest_by_id: dict[str, NormalizedEarthquake] = {}
    for raw_feature in features:
        if not isinstance(raw_feature, dict):
            continue
        try:
            event = normalize_feature(raw_feature)
        except InvalidFeedError:
            continue
        previous = latest_by_id.get(event.external_id)
        if previous is None or event.source_updated_at >= previous.source_updated_at:
            latest_by_id[event.external_id] = event

    return sorted(
        latest_by_id.values(),
        key=lambda event: (event.occurred_at, event.external_id),
        reverse=True,
    )


def content_hash(event: NormalizedEarthquake) -> str:
    payload = asdict(event)
    # An upstream bookkeeping timestamp alone should not produce a UI change.
    payload.pop("source_updated_at")
    for key, value in payload.items():
        if isinstance(value, datetime):
            payload[key] = value.astimezone(UTC).isoformat(timespec="milliseconds")
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()
