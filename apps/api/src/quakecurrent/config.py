from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    service_name: str = "QuakeCurrent API"
    environment: str = "development"
    database_url: str = (
        "postgresql+asyncpg://quakecurrent:quakecurrent@localhost:5432/quakecurrent"
    )
    redis_url: str = "redis://localhost:6379/0"
    usgs_all_day_url: str = (
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/"
        "all_day.geojson"
    )
    allowed_origins_raw: str = Field(
        default="http://localhost:3000",
        validation_alias="ALLOWED_ORIGINS",
    )
    snapshot_window_hours: int = Field(default=30, ge=24, le=168)
    usgs_timeout_seconds: float = Field(default=15, gt=0, le=60)
    usgs_max_response_bytes: int = Field(
        default=8_000_000,
        ge=100_000,
        le=25_000_000,
    )
    change_page_size: int = Field(default=200, ge=1, le=500)
    ws_catchup_limit: int = Field(default=500, ge=1, le=2_000)
    redis_channel: str = "quakecurrent:event-changes"
    ingest_lock_name: str = "quakecurrent:ingest:usgs-all-day"
    ingest_lock_seconds: int = Field(default=55, ge=10, le=300)

    @property
    def allowed_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.allowed_origins_raw.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
