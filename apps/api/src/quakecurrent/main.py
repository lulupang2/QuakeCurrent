from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy import text

from quakecurrent import __version__
from quakecurrent.api.routes import router as event_router
from quakecurrent.api.websocket import router as websocket_router
from quakecurrent.config import get_settings
from quakecurrent.db import SessionFactory, engine
from quakecurrent.schemas import HealthResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        health_check_interval=30,
    )
    yield
    await app.state.redis.aclose()
    await engine.dispose()


app = FastAPI(
    title="QuakeCurrent API",
    summary="Live USGS earthquake snapshot and change signals",
    description=(
        "Cycle 1 API for a live-only earthquake vertical slice. "
        "The REST snapshot is the source of truth; WebSocket messages are "
        "compact invalidation signals."
    ),
    version=__version__,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type", "If-None-Match"],
    expose_headers=["ETag"],
)
app.include_router(event_router)
app.include_router(websocket_router)


@app.get(
    "/healthz",
    response_model=HealthResponse,
    tags=["operations"],
    operation_id="healthz",
)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="quakecurrent-api")


@app.get(
    "/readyz",
    response_model=HealthResponse,
    responses={503: {"model": HealthResponse}},
    tags=["operations"],
    operation_id="readyz",
)
async def readiness() -> HealthResponse | JSONResponse:
    try:
        async with asyncio.timeout(2):
            async with SessionFactory() as session:
                await session.execute(text("SELECT 1"))
            await app.state.redis.ping()
    except Exception:
        payload = HealthResponse(
            status="not_ready",
            service="quakecurrent-api",
        )
        return JSONResponse(status_code=503, content=payload.model_dump())
    return HealthResponse(status="ok", service="quakecurrent-api")
