# QuakeCurrent 검증 가이드

이 문서는 변경 유형별 검증 명령과 결과를 해석하는 기준입니다. 자동화의 실제
권위 소스는 [GitHub Actions workflow](../.github/workflows/verify.yml)이며, 이
문서는 로컬 재현과 증거 표현을 안내합니다.

## 기본 원칙

- 저장소 루트에서 명령을 실행합니다.
- JavaScript는 하나의 루트 `package-lock.json`, Python은 `apps/api/uv.lock`을
  사용합니다.
- lockfile을 자동 갱신하지 않는 설치와 검사를 우선합니다.
- 생성된 계약 파일을 직접 수정하지 않습니다.
- 테스트 통과, CI 통과, 배포 검증과 운영 성능을 서로 다른 증거로 기록합니다.

## 빠른 웹 검증

```bash
npm ci
npm run check:docs
npm run check:api-client-contract
npm test
npm run test:client
npm run typecheck
npm run lint
npm run build
npm run test:ssr
npm run test:e2e:run
```

`test:e2e:run`은 기존 production build를 사용합니다. 빌드부터 브라우저 테스트까지
한 번에 실행하려면 다음 명령을 사용합니다.

```bash
npm run test:e2e
```

## API와 계약 검증

uv 0.12.0과 Python 3.12 또는 3.13을 준비합니다.

```bash
uv lock --project apps/api --check
uv sync --project apps/api --locked --extra dev
uv run --project apps/api --locked --extra dev \
  python -m pytest -m "not integration" apps/api/tests
npm run check:api-contract
npm run check:api-client-contract
```

REST 계약을 의도적으로 변경했을 때만 생성 명령을 실행하고 생성물 전체를 함께
검토합니다.

```bash
npm run generate:api-contract
git diff -- packages/api-client/openapi.json \
  packages/api-client/src/openapi.generated.ts
```

WebSocket 계약은 OpenAPI 범위 밖입니다. 다음 파일과 테스트를 같은 변경에서
확인합니다.

- `apps/api/src/quakecurrent/schemas.py`
- `packages/api-client/src/ws-schema.ts`
- `packages/api-client/tests/ws.test.mjs`
- API WebSocket·계약 테스트

## 로컬 통합 스택

PostGIS, Redis, API, Celery worker와 Beat를 실행합니다.

```bash
docker compose up --build
```

기본 확인 주소:

- API health: `http://localhost:8000/healthz`
- API readiness: `http://localhost:8000/readyz`
- OpenAPI: `http://localhost:8000/openapi.json`
- Web: `http://localhost:3000`

Compose 스택이 준비된 뒤 PostGIS·REST·WebSocket 통합 테스트를 포함하려면
[API README](../apps/api/README.md)의 환경 변수를 설정하고 전체 pytest를
실행합니다. 외부 서비스가 필요한 테스트는 결정론적 CI 테스트와 구분합니다.

## 변경 유형별 최소 검증

| 변경 | 최소 검증 |
| --- | --- |
| 필터·URL 모델 | `npm test`, `npm run test:ssr`, `npm run test:e2e` |
| React UI·접근성 | typecheck, lint, build, SSR, 데스크톱·모바일 브라우저 |
| 지도·WebGL | build, E2E, 실제 basemap·projection·오류 상태 수동 확인 |
| REST API | API tests, 두 OpenAPI drift gate, client tests |
| WebSocket·재연결 | API WS tests, client tests, local stack |
| DB·repository | Alembic 검토, API tests, PostGIS integration |
| workspace·빌드 설정 | `npm ci`, 전체 웹 검증, CI 경로·artifact 확인 |
| Python 의존성 | `uv lock --project apps/api --check`, Python 3.12·3.13 CI, container build |
| 문서만 변경 | `npm run check:docs`, 명령·경로와 현재 코드 사실 확인 |

## CI가 검증하는 범위

### API matrix

- Python 3.12와 3.13
- `uv.lock` 최신 여부와 locked sync
- FastAPI → OpenAPI snapshot drift
- 외부 서비스가 필요 없는 결정론적 API 테스트

### API container

- 동일한 `uv.lock` 기반 image build
- runtime package import
- non-root 사용자 실행

### Web

- root `npm ci`
- 저장소 Markdown 상대 링크
- OpenAPI snapshot → TypeScript drift
- web unit, API client, type와 lint
- Vinext production build와 SSR route
- Chromium desktop·mobile E2E
- 성공·실패와 관계없이 Playwright artifact 업로드 시도

CI는 실제 배포, 장기 traffic, 운영 DB migration과 production telemetry를
검증하지 않습니다.

workflow는 `main` push와 pull request에서 실행되며, 같은 ref의 이전 실행은 새
실행이 시작되면 취소됩니다. Playwright artifact는 실패 여부와 관계없이 수집을
시도하고 7일 동안 보관합니다.

## Review 기록 규칙

검증 결과를 기록할 때 다음을 함께 남깁니다.

- 대상 commit
- 실행 환경과 명령
- 통과·실패·제외된 테스트 수
- 발견한 결함과 수정 또는 보류 이유
- 공개 CI라면 실행 링크
- 배포 검증이라면 환경과 시점
- 실행하지 못한 검사와 차단 이유
- 현재 범위 밖이라 실행하지 않은 항목

과거 수치는 `/build-log`에 남기고, 현재 명령과 정책은 이 문서에 유지합니다.
이전 commit의 CI 통과를 현재 HEAD의 증거로 재사용하지 않습니다.
