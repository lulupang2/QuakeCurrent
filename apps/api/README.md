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
uv run --project apps/api --locked --extra dev \
  python -m quakecurrent.openapi_export \
  --check packages/api-client/openapi.json
```

## 테스트

Python 버전은 `apps/api/.python-version`, 직접·전이 의존성 버전은
`apps/api/uv.lock`에서 관리합니다. uv 0.12.0을 설치한 뒤 저장소 루트에서 잠금
파일을 변경하지 않는 고정 설치를 실행합니다.

Windows:

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://astral.sh/uv/0.12.0/install.ps1 | iex"
uv --version
```

macOS 또는 Linux:

```bash
curl -LsSf https://astral.sh/uv/0.12.0/install.sh | sh
uv --version
```

개발 의존성을 동기화하고 테스트합니다.

```powershell
uv sync --project apps/api --locked --extra dev
uv run --project apps/api --locked --extra dev python -m pytest
```

명령은 Windows, macOS, Linux에서 같습니다. `--locked`는 `pyproject.toml`과
`uv.lock`이 어긋났을 때 잠금 파일을 자동 갱신하지 않고 실패하게 합니다. 의존성을
추가하거나 범위를 변경한 뒤에는 잠금 파일을 갱신하고 함께 커밋합니다.

```bash
uv lock --project apps/api
uv lock --project apps/api --check
```

CI는 잠금 파일 최신 여부를 먼저 확인한 뒤 같은 잠금 파일로 Python 3.12와 3.13을
각각 검증합니다. 3.12 검증은 지원하는 최소 버전과의 호환성을, 3.13 검증은 현재
개발 환경과의 호환성을 확인합니다.

Compose 스택이 실행 중일 때 PostGIS, REST, WebSocket 통합 테스트까지 포함하려면
다음 환경 변수를 지정합니다.

```powershell
cd apps/api
$env:QUAKECURRENT_TEST_DATABASE_URL='postgresql+asyncpg://quakecurrent:quakecurrent@localhost:5432/quakecurrent'
$env:QUAKECURRENT_TEST_API_URL='http://localhost:8000'
$env:QUAKECURRENT_TEST_WS_URL='ws://localhost:8000'
uv run --locked --extra dev python -m pytest
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
