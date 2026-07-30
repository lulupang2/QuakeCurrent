# QuakeCurrent SSOT

이 문서는 QuakeCurrent의 제품 수준 단일 기준점입니다. 구현 세부의 원본을
복제하지 않고, 현재 범위와 상태를 고정하며 각 기술 영역의 실제 권위 소스를
가리킵니다.

## 현재 상태

| 항목 | 현재 기준 |
| --- | --- |
| 서비스명 | QuakeCurrent |
| 성격 | 지진 데이터 수집·탐색 과정을 보여주는 취업용 풀스택 포트폴리오 |
| 데이터 원천 | USGS `all_day.geojson` |
| 핵심 개발 방식 | Prototype → Plan → Autopilot → Review 반복 |
| 저장소 구조 | `apps/web`, `apps/api`, `packages/api-client` |
| 기본 웹 주소 | `http://localhost:3000` |
| 기본 API 주소 | `http://localhost:8000` |
| 배포 상태 | 보류. 호스팅 조건이 확정되기 전에는 운영 성능을 주장하지 않음 |
| 기준 런타임 | Node.js 22.13 이상, Python 3.12·3.13, uv 0.12.0 |

## 해결하려는 문제

최근 지진을 지도에서 빠르게 탐색하고, 하나의 사건을 목록·지도·상세 정보에서
일관되게 선택할 수 있게 합니다. 결과물뿐 아니라 범위 설정, 계약 자동화와 검토
증거를 함께 보여주는 것이 프로젝트의 목적입니다.

주요 독자는 다음과 같습니다.

- 제품을 직접 확인하는 채용 담당자와 면접관
- 프론트엔드·백엔드·계약·CI 경계를 검토하는 개발자
- 반복 가능한 개발 과정을 확인하려는 저장소 방문자

## 현재 구현 범위

### 웹

- `/`: 최근 지진 목록, 통계, 상세 정보와 MapLibre/deck.gl 지도
- `/project`: 문제, 구현 범위, 기술 판단과 검증 증거를 요약한 채용용 브리프
- `/build-log`: 각 개발 사이클의 구현·자동화·검토 기록
- 시간 `1·6·24시간`, 최소 규모 `0·3·4·5`, 깊이 구간 필터
- 기본값을 생략하고 다른 query와 hash를 보존하는 공유 가능한 URL 상태
- 2D·3D 투영 전환, 사건 선택과 지도 이동, 한국어 위치 표현
- 초기 API 스냅샷 요청 실패 시 10건의 검증용 데모 스냅샷을 표시하고 15초마다
  bootstrap 재시도

### API와 데이터

- Celery Beat가 60초마다 USGS 하루 피드 수집을 예약
- Redis lock과 HTTP 조건부 요청으로 중복 수집과 불필요한 전송을 제한
- `source + external_id` 기준 멱등 정규화·upsert
- PostgreSQL/PostGIS에 사건, 수집 실행과 변경 시퀀스 저장
- REST 스냅샷·변경 목록·상세 조회와 `healthz`·`readyz`
- Redis Pub/Sub과 WebSocket을 통한 작은 변경 신호
- 마지막 처리 시퀀스 이후 REST catch-up 뒤 WebSocket 재연결

PostgreSQL의 사건과 변경 로그가 영속 복구 기준입니다. Redis Pub/Sub은 빠른 전달을
위한 비영속 계층이며 그 자체를 데이터 원본으로 사용하지 않습니다.

### 계약과 자동화

- FastAPI에서 결정론적 OpenAPI 스냅샷 생성
- OpenAPI 스냅샷에서 런타임 의존성이 없는 TypeScript 타입 생성
- REST·WebSocket 클라이언트와 재연결 상태 머신을 독립 패키지로 제공
- 웹, API, 컨테이너와 계약 드리프트를 GitHub Actions에서 분리 검증

## 현재 비범위

- 실제 프로덕션 배포, SLA, production telemetry와 실사용 트래픽 지표
- 재난 경보·대피 판단을 제공하는 운영 서비스
- 로그인, 권한, 개인화, 사용자 저장 데이터
- rate limiting, 운영 monitoring·alert, backup·복구와 고가용성
- 지진 이외의 재난 데이터와 여러 외부 데이터 원천 통합
- AI 요약·설명 또는 자동 의사결정
- 알림 발송, 구독, 장기 분석과 과거 전체 데이터 탐색
- DB retention·cleanup과 원천에서 사라진 사건의 삭제 동기화
- 서버 측 UI 필터·페이지네이션으로의 전환

비범위를 구현 범위로 승격할 때는 [결정 기록](./DECISIONS.md)에 이유와 검증 조건을
추가하고, 이 문서를 먼저 갱신합니다.

## 트래픽과 필터 기준

데이터 시간 경계는 서로 다릅니다.

- 원천 피드: USGS `all_day`, 약 24시간
- API 기본 조회 창: 최근 30시간
- 웹 요청: 최신순 최대 120건
- UI 기본 필터: 최근 24시간

따라서 120건을 넘는 전 지구 사건을 웹이 항상 모두 보유한다고 가정하지 않습니다.
시간·규모·깊이 필터는 받은 스냅샷 안에서 브라우저가 계산합니다. Cycle 02
측정값은 약 45KB였으며 운영 지표가 아니라 당시 의사결정 근거입니다.

다음 중 하나를 확인하면 API query와 페이지네이션 승격을 재검토합니다.

- gzip 스냅샷 payload가 250KB를 초과
- 중급 모바일에서 필터 계산 p95가 50ms를 초과
- 브라우저 메모리나 지도 렌더링이 데이터 증가로 불안정
- 공유 URL이 서버 쿼리와 동일한 결과를 재현해야 하는 운영 요구 발생

## 권위 소스

| 영역 | 권위 소스 | 파생물·설명 |
| --- | --- | --- |
| 제품 범위·상태·비범위 | 이 문서 | 루트 README, `/project` |
| 저장소 경계와 npm 명령 | [`package.json`](../package.json), [`apps/web/package.json`](../apps/web/package.json) | `package-lock.json` |
| 웹 라우트와 UI 동작 | [`apps/web/app`](../apps/web/app), [`apps/web/features`](../apps/web/features) | 웹 화면, Build Log |
| REST 서버 계약 | [`routes.py`](../apps/api/src/quakecurrent/api/routes.py)와 [`schemas.py`](../apps/api/src/quakecurrent/schemas.py) | `packages/api-client/openapi.json`, 생성 TypeScript |
| WebSocket wire 계약 | API [`ChangeSignal`](../apps/api/src/quakecurrent/schemas.py) | `packages/api-client/src/ws-schema.ts` |
| DB 변경 이력 | [`apps/api/alembic`](../apps/api/alembic) | SQLAlchemy 모델 |
| JavaScript 의존성 해석 | [`package-lock.json`](../package-lock.json) | 각 `package.json`의 선언 범위 |
| Python 의존성 해석 | [`apps/api/uv.lock`](../apps/api/uv.lock) | `apps/api/pyproject.toml`의 선언 범위 |
| 로컬 스택 topology·override | [`docker-compose.yml`](../docker-compose.yml) | API·worker·DB·Redis 실행 예시 |
| API 설정 기본값·검증 | [`config.py`](../apps/api/src/quakecurrent/config.py) | `.env.example`, Compose 환경 override |
| 자동 검증 계약 | [`.github/workflows/verify.yml`](../.github/workflows/verify.yml) | 검증 가이드와 Build Log |
| 역사적 실행 증거 | `/build-log`, 공개 GitHub Actions 실행 | README의 요약 |

REST 계약의 변경 방향은 다음과 같습니다.

```text
FastAPI route·schema
  → packages/api-client/openapi.json
  → packages/api-client/src/openapi.generated.ts
  → TypeScript client와 web
```

WebSocket은 OpenAPI가 표현하지 못하므로 API Pydantic 모델과 TypeScript
`ws-schema.ts`를 같은 변경에서 수정하고 양쪽 테스트로 고정합니다.

## 환경 경계

| 변수 | 역할 | 기본값·기준 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | 웹에서 사용할 API 기준 주소 | `http://localhost:8000` |
| `DATABASE_URL` | API·worker의 PostgreSQL/PostGIS 연결 | 로컬 Compose 기준값 |
| `REDIS_URL` | Celery broker, lock, Pub/Sub 연결 | 로컬 Compose 기준값 |
| `USGS_ALL_DAY_URL` | 수집할 USGS 피드 | 공식 하루 GeoJSON 피드 |
| `ALLOWED_ORIGINS` | REST CORS와 WebSocket origin 허용 목록 | `http://localhost:3000` |
| `SNAPSHOT_WINDOW_HOURS` | API 스냅샷 조회 범위 | 30시간 |

전체 기본값과 유효 범위는
[`apps/api/src/quakecurrent/config.py`](../apps/api/src/quakecurrent/config.py)가
권위 소스입니다. 비밀값을 저장소에 커밋하지 않습니다.

## 알려진 한계와 정합성 과제

- `deleted` operation은 계약과 client 처리에는 있지만 현재 수집기는
  `created·updated`만 생성합니다.
- DB retention·cleanup 작업이 없어 데이터는 누적되고 REST 조회 창만 제한됩니다.
- WebSocket 서버의 `seq`는 1 이상이지만 TypeScript runtime guard는 현재 0도
  허용합니다. 서버 계약을 기준으로 맞추고 교차 언어 회귀 테스트를 추가해야 합니다.
- `CHANGE_PAGE_SIZE` 설정은 현재 REST route의 기본 `200`과 연결되지 않습니다.
- REST 생성 타입은 compile-time 계약이며 응답 본문을 runtime schema로 검증하지
  않습니다.
- Redis Pub/Sub 신호가 유실되면 DB change log로 재연결 시 복구할 수 있지만, 이미
  연결된 client가 다음 재연결 전 즉시 누락을 감지한다고 보장하지 않습니다.
- 수집 lock lease는 55초이며 자동 연장하지 않으므로 실행이 이를 넘는 환경에서는
  중첩 가능성을 별도로 다뤄야 합니다.
- 저장소 전체 소스 라이선스는 아직 선언하지 않았고, 포함한 LINE Seed Sans KR
  폰트의 OFL만 별도로 보관합니다.

## 변경 전파 규칙

| 변경 | 같은 변경에서 확인할 항목 |
| --- | --- |
| 제품 범위·비범위 | SSOT, `/project`, README, 결정 기록 |
| REST 경로·응답 | FastAPI schema·route, OpenAPI 재생성, client·web 테스트 |
| WebSocket 프레임 | API schema, TypeScript schema, catch-up·재연결 테스트 |
| DB 모델 | Alembic migration, repository, 통합 테스트 |
| 필터 URL | 순수 모델 테스트, SSR, 데스크톱·모바일 E2E |
| workspace 경계 | package manifest·lock, 루트 명령, CI 경로, README |
| 의존성 | manifest와 해당 lockfile, 타입·테스트·빌드 |
| 검증 수치·상태 | 검증 가이드, Build Log, 과장되지 않은 증거 수준 |
