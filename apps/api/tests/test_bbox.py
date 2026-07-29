from __future__ import annotations

import pytest

from quakecurrent.repository import BoundingBox


def test_bbox_parses_global_extent() -> None:
    bbox = BoundingBox.parse("-180,-90,180,90")

    assert bbox == BoundingBox(-180, -90, 180, 90)


def test_bbox_allows_antimeridian_crossing() -> None:
    bbox = BoundingBox.parse("170,-20,-170,20")

    assert bbox is not None
    assert bbox.west > bbox.east


@pytest.mark.parametrize(
    "value",
    [
        "1,2,3",
        "west,2,3,4",
        "-181,-20,20,30",
        "-20,40,20,30",
    ],
)
def test_bbox_rejects_invalid_values(value: str) -> None:
    with pytest.raises(ValueError):
        BoundingBox.parse(value)
