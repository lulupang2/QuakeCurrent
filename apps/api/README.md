# QuakeCurrent API

QuakeCurrent 지진 수직 슬라이스를 위한 독립 FastAPI 서비스입니다. USGS의 하루
피드를 수집하고, 정규화한 사건을 PostGIS에 저장한 뒤 Redis와 WebSocket으로 경량
변경 신호를 발행합니다.

## 로컬 스택

저장소 루트에서 다음 명령을 실행합니다.

```bash
docker compose up --build
```

API 주소는 `http://localhost:8000`입니다. 상태 확인 엔드포인트는 `/healthz`와
`/readyz`이며, OpenAPI 문서는 `/openapi.json`에서 제공합니다.

## OpenAPI 스냅샷

서버를 실행하지 않고 현재 FastAPI 앱에서 정렬된 OpenAPI JSON을 내보낼 수
있습니다. 저장소 루트의 통합 명령은 JSON과 TypeScript 타입을 함께 갱신합니다.

```powershell
npm run generate:api-contract
npm run check:api-contract
```

CI의 API 작업은 다음 검사로
`packages/api-client/openapi.json`이 서버 계약과 같은지 확인합니다.

```bash
python -m quakecurrent.openapi_export \
  --check packages/api-client/openapi.json
```

## 테스트

개발 의존성과 함께 프로젝트를 설치합니다.

```powershell
cd apps/api
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest
```

macOS 또는 Linux에서는 해당 운영체제의 가상환경 경로를 사용합니다.

```bash
cd apps/api
python3.12 -m venv .venv
./.venv/bin/python -m pip install -e ".[dev]"
./.venv/bin/python -m pytest
```

Compose 스택이 실행 중일 때 PostGIS, REST, WebSocket 통합 테스트까지 포함하려면
다음 환경 변수를 지정합니다.

```powershell
cd apps/api
$env:QUAKECURRENT_TEST_DATABASE_URL='postgresql+asyncpg://quakecurrent:quakecurrent@localhost:5432/quakecurrent'
$env:QUAKECURRENT_TEST_API_URL='http://localhost:8000'
$env:QUAKECURRENT_TEST_WS_URL='ws://localhost:8000'
.\.venv\Scripts\python.exe -m pytest
```

## 패키지 구조

```text
src/quakecurrent/
  api/             REST·WebSocket 라우트
  ingest.py        조건부 요청과 수집 흐름 제어
  repository.py    PostGIS 쿼리와 멱등 upsert
  tasks.py         Celery 작업 진입점
  usgs.py          USGS 정규화 어댑터
alembic/           데이터베이스 마이그레이션
tests/             단위·계약·통합 스택 테스트
```
