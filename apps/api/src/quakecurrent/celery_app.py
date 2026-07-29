from __future__ import annotations

from celery import Celery

from quakecurrent.config import get_settings

settings = get_settings()

celery_app = Celery(
    "quakecurrent",
    broker=settings.redis_url,
    include=["quakecurrent.tasks"],
)
celery_app.conf.update(
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "collect-usgs-all-day-every-minute": {
            "task": "quakecurrent.ingest_usgs_all_day",
            "schedule": 60.0,
        }
    },
    task_acks_late=True,
    task_ignore_result=True,
    task_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)
