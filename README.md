# QuakeCurrent

QuakeCurrent is a hiring-portfolio vertical slice that turns the USGS
`all_day.geojson` earthquake feed into a live, explorable globe. The project is
organized around a repeatable `Prototype → Plan → Autopilot → Review` cycle.

Cycle 01 deliberately contains one phenomenon only: earthquakes from the past
24 hours. Deployment is deferred until the hosting constraints are known.
Cycle 02 closes a client-side filter iteration for time, magnitude, and depth.
It keeps the raw 24-hour snapshot intact, derives the list, map, metrics, and
current selection from one filtered result, and preserves the selected state in
a shareable URL.

## Portfolio scope

- Product and UX: vertical-slice scoping, Korean information design, responsive
  map and filter interactions
- Frontend: React state boundaries, SSR URL hydration, MapLibre/deck.gl, and
  accessible desktop/mobile controls
- Backend and data: FastAPI, OpenAPI, PostGIS, Celery, Redis, and WebSocket
  catch-up
- Quality: deterministic fixtures, contract tests, browser E2E, local live-stack
  verification, and CI definitions

Cycle 02 deliberately keeps filtering in the browser because the measured
24-hour snapshot is about 45KB. API query and pagination are reconsidered if
the gzip payload exceeds 250KB or filter computation exceeds 50ms p95 on a
mid-range mobile device. Filter toggles use `replaceState` so three quick
choices do not create three browser-history entries; shared URLs, reloads, and
external `popstate` navigation still restore the complete state.

## Architecture

```text
USGS GeoJSON
  → Celery Beat (60 s)
  → Celery worker / idempotent normalization
  → PostgreSQL + PostGIS / change sequence
  → Redis compact signal
  → FastAPI REST snapshot + WebSocket
  → generated TypeScript client
  → Next.js / MapLibre / deck.gl
```

## Repository structure

```text
app/                         Next.js routes and root layout
features/earthquakes/        Earthquake UI, hooks, model, styles, and tests
apps/api/                    Independent FastAPI service and ingestion workers
packages/api-client/         OpenAPI REST and typed WebSocket client
platform/sites/              Vinext/Sites build adapter and Worker entry
tests/web/                   Rendered HTML contract tests
scripts/                     Local production runtime
```

The web app intentionally remains at the repository root so the existing
Vinext/Sites build contract stays stable. Product code is feature-oriented,
while the Python service and generated client remain independently testable.

## Local development

Prerequisites:

- Node.js 22.13+
- Docker Desktop with Compose

Start the backend stack:

```bash
docker compose up --build
```

Start the web app in a second terminal:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The API is expected at
`http://localhost:8000`; set `NEXT_PUBLIC_API_BASE_URL` to override it. When the
API is unavailable, the UI clearly labels and displays a small built-in demo
snapshot.

For a production-like local preview:

```bash
npm run build
npm run start
```

## Verification

```bash
npm test
npm run test:client
npm run test:e2e
npm run typecheck
npm run lint
npm run build
npm run test:ssr
```

`test:e2e` builds the production app and verifies URL filter persistence,
reload restoration, reset behavior, invalid-value normalization, and desktop /
mobile parity in Chromium. GitHub Actions is configured with separate API and
web jobs for pushes and pull requests. The repository has not had its first
remote push yet, so this is CI configuration evidence rather than a hosted
green-run claim.

Backend commands and tests are documented in `apps/api/README.md`. Actual cycle
evidence is presented at `/build-log`.
