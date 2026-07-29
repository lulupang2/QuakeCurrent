from __future__ import annotations

import asyncio

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from quakecurrent.config import get_settings
from quakecurrent.db import SessionFactory
from quakecurrent.repository import list_change_signals

router = APIRouter(prefix="/v1")


@router.websocket("/ws/events")
async def event_stream(
    websocket: WebSocket,
    after_seq: int = Query(default=0, ge=0),
) -> None:
    settings = get_settings()
    origin = websocket.headers.get("origin")
    if origin and origin not in settings.allowed_origins:
        await websocket.close(code=1008, reason="Origin is not allowed")
        return

    await websocket.accept()
    redis = websocket.app.state.redis
    pubsub = redis.pubsub()
    await pubsub.subscribe(settings.redis_channel)

    try:
        # Subscribe first. Signals published while the database catch-up runs remain
        # queued in Redis; duplicate sequences are safe for clients to ignore.
        async with SessionFactory() as session:
            signals, _ = await list_change_signals(
                session,
                after_seq=after_seq,
                limit=settings.ws_catchup_limit,
            )
        for signal in signals:
            await websocket.send_text(signal.model_dump_json())

        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True,
                timeout=1.0,
            )
            if message is not None and message.get("type") == "message":
                await websocket.send_text(message["data"])

            try:
                client_message = await asyncio.wait_for(
                    websocket.receive(),
                    timeout=0.01,
                )
            except TimeoutError:
                continue
            if client_message.get("type") == "websocket.disconnect":
                break
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        await pubsub.unsubscribe(settings.redis_channel)
        await pubsub.aclose()
