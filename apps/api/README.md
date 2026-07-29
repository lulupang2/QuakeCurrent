# QuakeCurrent API

Independent FastAPI service for the QuakeCurrent earthquake vertical slice.
It ingests the USGS all-day feed, stores normalized events in PostGIS, and
publishes compact change signals through Redis and WebSocket.

## Local stack

From the repository root:

```bash
docker compose up --build
```

The API is available at `http://localhost:8000`. Health endpoints are
`/healthz` and `/readyz`; OpenAPI is served at `/openapi.json`.

## Tests

Install the project with its development dependencies:

```powershell
cd apps/api
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest
```

On macOS or Linux, use the platform-specific virtual-environment path:

```bash
cd apps/api
python3.12 -m venv .venv
./.venv/bin/python -m pip install -e ".[dev]"
./.venv/bin/python -m pytest
```

To include the live PostGIS, REST, and WebSocket tests while the Compose stack
is running:

```powershell
cd apps/api
$env:QUAKECURRENT_TEST_DATABASE_URL='postgresql+asyncpg://quakecurrent:quakecurrent@localhost:5432/quakecurrent'
$env:QUAKECURRENT_TEST_API_URL='http://localhost:8000'
$env:QUAKECURRENT_TEST_WS_URL='ws://localhost:8000'
.\.venv\Scripts\python.exe -m pytest
```

## Package layout

```text
src/quakecurrent/
  api/             REST and WebSocket routes
  ingest.py        conditional fetch and ingestion orchestration
  repository.py    PostGIS queries and idempotent upsert
  tasks.py         Celery task entry
  usgs.py          USGS normalization adapter
alembic/           database migrations
tests/             unit, contract, and live-stack tests
```
