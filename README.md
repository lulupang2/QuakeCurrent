# QuakeCurrent

QuakeCurrent는 USGS의 `all_day.geojson` 지진 피드를 실시간으로 탐색할 수 있는
지구본으로 표현한 취업용 포트폴리오 프로젝트입니다. 구현 과정은 반복 가능한
`Prototype → Plan → Autopilot → Review` 사이클을 중심으로 구성했습니다.

Cycle 01에서는 의도적으로 최근 24시간의 지진이라는 한 가지 현상만 다뤘습니다.
호스팅 조건이 확정될 때까지 배포는 보류합니다. Cycle 02에서는 시간, 규모, 깊이
필터를 클라이언트에 추가했습니다. 원본 24시간 스냅샷은 유지하면서 하나의 필터
결과로 목록, 지도, 통계, 현재 선택을 파생하고, 선택한 필터 상태는 공유 가능한
URL에 보존합니다. Cycle 03에서는 FastAPI OpenAPI 문서와 TypeScript 생성물 사이의
drift를 로컬과 CI에서 자동으로 차단합니다. Cycle 04에서는 Python 3.12를 기본
실행 버전으로 고정하고, `uv.lock`으로 모든 전이 의존성을 잠가 개발 환경·CI·API
컨테이너가 같은 패키지 조합을 재현하도록 만들었습니다.

## 포트폴리오에서 보여주는 역량

- 제품·UX: 수직 슬라이스 범위 설정, 한국어 정보 설계, 반응형 지도와 필터 상호작용
- 프론트엔드: React 상태 경계, SSR URL 초기화, MapLibre/deck.gl, 접근 가능한
  데스크톱·모바일 컨트롤
- 백엔드·데이터: FastAPI, OpenAPI, PostGIS, Celery, Redis, WebSocket 재연결
- 품질: 결정론적 fixture, 계약 테스트, 브라우저 E2E, 로컬 통합 스택 검증, CI

Cycle 02에서 측정한 24시간 스냅샷은 약 45KB이므로 필터는 브라우저에서 처리합니다.
gzip payload가 250KB를 넘거나 중급 모바일에서 필터 계산 p95가 50ms를 넘으면 API
쿼리와 페이지네이션 승격을 다시 검토합니다. 필터 토글은 `replaceState`를 사용해
짧은 선택마다 브라우저 방문 기록이 쌓이지 않게 했습니다. 공유 URL, 새로고침,
외부 `popstate` 이동에서는 전체 필터 상태가 복원됩니다.

## 아키텍처

```text
USGS GeoJSON
  → Celery Beat (60초)
  → Celery worker / 멱등 정규화
  → PostgreSQL + PostGIS / 변경 시퀀스
  → Redis 경량 신호
  → FastAPI REST 스냅샷 + WebSocket
  → 생성된 TypeScript 클라이언트
  → Next.js / MapLibre / deck.gl
```

## 저장소 구조

```text
app/                         Next.js 라우트와 루트 레이아웃
features/earthquakes/        지진 UI, 훅, 모델, 스타일, 테스트
apps/api/                    독립 FastAPI 서비스와 수집 worker
packages/api-client/         OpenAPI REST·WebSocket TypeScript 클라이언트
platform/sites/              Vinext/Sites 빌드 어댑터와 Worker 진입점
tests/web/                   서버 렌더링 HTML 계약 테스트
scripts/                     로컬 프로덕션 실행 스크립트
```

기존 Vinext/Sites 빌드 계약을 안정적으로 유지하기 위해 웹 앱은 저장소 루트에
둡니다. 제품 코드는 기능 중심으로 구성하고, Python 서비스와 생성 클라이언트는
각각 독립적으로 테스트할 수 있습니다.

## 로컬 개발

필요한 환경:

- Node.js 22.13 이상
- Docker Desktop과 Compose
- API를 컨테이너 밖에서 실행할 경우 Python 3.12와 uv 0.12.0

백엔드 스택을 실행합니다.

```bash
docker compose up --build
```

다른 터미널에서 웹 앱을 실행합니다.

```bash
npm install
npm run dev
```

`http://localhost:3000`에서 확인할 수 있습니다. 기본 API 주소는
`http://localhost:8000`이며, `NEXT_PUBLIC_API_BASE_URL`로 변경할 수 있습니다.
API를 사용할 수 없으면 UI가 내장 데모 스냅샷임을 명확하게 표시합니다.

프로덕션과 유사한 로컬 환경은 다음과 같이 실행합니다.

```bash
npm run build
npm run start
```

## 검증

```bash
npm test
npm run test:client
npm run test:e2e
npm run typecheck
npm run lint
npm run build
npm run test:ssr
npm run check:api-contract
uv lock --project apps/api --check
```

`test:e2e`는 프로덕션 앱을 빌드한 뒤 URL 필터 보존, 새로고침 복원, 초기화,
유효하지 않은 값의 정규화, Chromium 데스크톱·모바일 동작 일치를 확인합니다.
GitHub Actions는 push와 pull request마다 API와 웹 작업을 분리해 실행합니다.
첫 원격 실행인
[Verify #30410815313](https://github.com/lulupang2/QuakeCurrent/actions/runs/30410815313)에서
commit `dce4594`의 두 작업이 모두 통과했습니다. 이는 CI 실행 증거이며 배포 또는
프로덕션 성능을 의미하지 않습니다.

## Python 의존성 재현

API 프로젝트의 직접·전이 의존성은 `apps/api/uv.lock`에 버전과 파일 해시까지
기록합니다. 다음 명령은 잠금 파일을 변경하지 않고 Python 3.12 개발 환경을 정확히
동기화합니다.

```bash
uv sync --project apps/api --python 3.12 --locked --extra dev
uv run --project apps/api --python 3.12 --locked --extra dev \
  python -m pytest -m "not integration" apps/api/tests
```

`pyproject.toml`을 바꾼 뒤 잠금 파일을 갱신하지 않으면
`uv lock --project apps/api --check`와 CI가 실패합니다. CI는 하나의 잠금 파일을
Python 3.12와 3.13에서 각각 동기화해 OpenAPI 계약과 결정론적 테스트를 확인하고,
별도 작업에서 같은 잠금 파일로 API 컨테이너를 빌드합니다.

Cycle 04 원격 실행인
[Verify #30418181319](https://github.com/lulupang2/QuakeCurrent/actions/runs/30418181319)에서
두 Python 버전의 계약 검사, 잠금 기반 API 컨테이너, 기존 웹·브라우저 검증이
모두 통과했습니다. 이 결과는 재현 가능한 빌드와 테스트의 증거이며 실제 배포나
운영 성능을 의미하지 않습니다.

## OpenAPI 계약 갱신

REST 계약의 흐름은 `FastAPI → openapi.json → TypeScript`입니다. 서버를 실행하지
않고 현재 FastAPI 앱에서 결정론적인 JSON 스냅샷을 만들며, `openapi-typescript
7.13.0`으로 런타임 의존성이 없는 타입을 생성합니다.

```bash
npm run generate:api-contract
npm run check:api-contract
```

`packages/api-client/openapi.json`과
`packages/api-client/src/openapi.generated.ts`는 함께 커밋해야 합니다. CI의 API
작업은 FastAPI와 JSON 스냅샷을 비교하고, 웹 작업은 JSON 스냅샷과 TypeScript
생성물을 비교합니다. WebSocket 프레임은 OpenAPI가 표현하지 못하므로
`packages/api-client/src/ws-schema.ts`에서 별도로 관리합니다.

Cycle 03 원격 실행인
[Verify #30412360163](https://github.com/lulupang2/QuakeCurrent/actions/runs/30412360163)에서
두 drift gate와 기존 API·웹·브라우저 검증이 모두 통과했습니다.

백엔드 실행과 테스트 방법은 `apps/api/README.md`에 정리했습니다. 각 사이클의
구현·검토 증거는 `/build-log`에서 확인할 수 있습니다.
