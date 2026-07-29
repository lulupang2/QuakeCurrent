import {
  ArrowLeft,
  Braces,
  Cable,
  Check,
  CircleDot,
  Download,
  GitBranch,
  Gauge,
  Globe2,
  PackageCheck,
  Radio,
  RefreshCw,
  Server,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Build Log",
  description:
    "QuakeCurrent Cycle 01–02의 Prototype → Plan → Autopilot → Review 구현 기록.",
};

const stages = [
  {
    number: "01",
    name: "PROTOTYPE",
    headline: "가장 얇은 수직 슬라이스로 위험을 먼저 확인했다.",
    body: "USGS 24시간 피드 하나, 지도 하나, 상세 패널 하나만 연결했다. 여러 재난 데이터와 AI 설명은 의도적으로 다음 사이클로 미뤘다.",
    deliverables: [
      "한국어 사건 정보 + MapLibre 3D 지구본 + deck.gl 포인트",
      "사건 선택과 위치·규모·깊이 상세",
      "API 장애 시 명확히 표시되는 데모 스냅샷",
    ],
  },
  {
    number: "02",
    name: "PLAN",
    headline: "화면보다 계약과 실패 경로를 먼저 고정했다.",
    body: "브라우저가 USGS를 직접 호출하지 않도록 독립 FastAPI 경계를 두고, REST 스냅샷 뒤에는 작은 WebSocket 변경 신호만 흐르게 설계했다.",
    deliverables: [
      "FastAPI OpenAPI → TypeScript REST 클라이언트",
      "WebSocket 별도 타입 + 마지막 sequence 기반 재연결",
      "source + external_id 멱등 키와 content hash",
    ],
  },
  {
    number: "03",
    name: "AUTOPILOT",
    headline: "수집부터 갱신 신호까지 사람이 없어도 반복된다.",
    body: "Celery Beat가 60초마다 수집을 예약하고 worker가 정규화·upsert한다. 내용이 실제로 달라진 사건만 sequence를 만들고 Redis로 발행한다.",
    deliverables: [
      "PostgreSQL/PostGIS + Alembic 마이그레이션",
      "Celery Beat / worker / Redis 로컬 스택",
      "신규·수정 사건만 전달하는 compact change signal",
    ],
  },
  {
    number: "04",
    name: "REVIEW",
    headline: "보이는 완성도와 데이터 무결성을 같은 기준으로 검토했다.",
    body: "결정론적 fixture, 계약 테스트, 프로덕션 빌드, 로컬 Docker 스택과 외부 타일 소스를 함께 확인했다. 한국어 안내와 수치용 글꼴 역할도 분리했다. 아래 수치는 이번 로컬 실행에서 기록한 결과다.",
    deliverables: [
      "동일 피드 재수집 시 중복 신규 행 0건",
      "WebSocket 종료 후 마지막 sequence 기반 catch-up",
      "프로덕션 빌드·베이스맵 렌더링·한국어 사건 정보 검증",
    ],
  },
];

const reviewChecks = [
  {
    icon: GitBranch,
    label: "IDEMPOTENCY",
    value: "0 DUPLICATES",
    note: "2차 fixture: 2 unchanged / 0 signal",
  },
  {
    icon: Cable,
    label: "RECONNECT",
    value: "PASS",
    note: "after_seq REST catch-up + WS resume",
  },
  {
    icon: Gauge,
    label: "WEB BUILD",
    value: "PASS",
    note: "Cycle 01 local · web 7/7 · SSR 2/2",
  },
  {
    icon: Server,
    label: "API TESTS",
    value: "15 / 15",
    note: "live PostGIS · REST · WebSocket",
  },
  {
    icon: Braces,
    label: "CLIENT TESTS",
    value: "9 / 9",
    note: "REST contract + WebSocket state machine",
  },
  {
    icon: Download,
    label: "SNAPSHOT",
    value: "45 KB",
    note: "120 events · compact REST payload",
  },
  {
    icon: PackageCheck,
    label: "MAP CHUNK",
    value: "404 KB",
    note: "gzip · lazy-loaded after shell",
  },
  {
    icon: Globe2,
    label: "BASEMAP SOURCE",
    value: "200 OK",
    note: "CARTO raster · inline style",
  },
];

const reviewFindings = [
  {
    number: "R-01",
    title: "지도 캔버스가 목록 높이를 따라 8,675px까지 늘어났다.",
    resolution:
      "앱 셸을 100dvh로 고정하고 목록·상세만 독립 스크롤 영역으로 분리했다.",
  },
  {
    number: "R-02",
    title: "브라우저가 클라이언트의 WebSocket close code 1011을 거부했다.",
    resolution:
      "서버 예약 코드 대신 애플리케이션 범위의 4001을 사용하고 회귀 테스트를 추가했다.",
  },
  {
    number: "R-03",
    title: "PostgreSQL sequence를 빈틈없는 카운터로 잘못 가정했다.",
    resolution:
      "롤백이 번호를 소비할 수 있으므로 연속성이 아닌 단조 증가 cursor로 검증하도록 바꿨다.",
  },
  {
    number: "R-04",
    title: "외부 벡터 스타일과 조기 projection 적용이 지도 초기화 경로를 불안정하게 만들었다.",
    resolution:
      "검증된 CARTO 래스터 스타일을 인라인하고 MapLibre style.load 이후에만 projection을 적용했다.",
  },
  {
    number: "R-05",
    title: "한국어 로딩·좌표 문구가 데이터용 모노스페이스를 상속했다.",
    resolution:
      "LINE Seed Sans KR을 자체 포함하고 한글 안내는 sans, 영문 코드와 수치는 mono라는 역할로 분리했다.",
  },
  {
    number: "R-06",
    title: "벡터 스타일은 준비됐지만 실제 지구 표면 레이어가 렌더링되지 않았다.",
    resolution:
      "외부 스타일·글리프 의존성을 제거하고 경량 래스터를 기본 베이스맵으로 고정해 렌더 경로를 단순화했다.",
  },
];

const cycleTwoStages = [
  {
    name: "PROTOTYPE",
    body: "시간·최소 규모·깊이를 바꾸면 원본 24시간 스냅샷은 유지하고 목록·통계·지도·선택만 하나의 파생 결과로 갱신한다.",
  },
  {
    name: "PLAN",
    body: "URL을 공유 가능한 상태 경계로 선택했다. 기본값은 생략하고 다른 query와 hash는 보존하며, 즉시 필터 토글은 replaceState로 기록 과잉을 막는다.",
  },
  {
    name: "AUTOPILOT",
    body: "순수 URL 모델, SSR 계약, 결정론적 데모 스냅샷, 데스크톱·모바일 브라우저 흐름을 자동화하고 API와 웹 검증을 CI 두 작업으로 정의했다.",
  },
  {
    name: "REVIEW",
    body: "1440×900과 390×844에서 직접 확인하고 테스트 경쟁 조건, 지도 범위 표기, 텍스트 대비, 모션 감소, 늦은 지도 로딩 복구를 수정했다.",
  },
];

const cycleTwoChecks = [
  {
    label: "FILTER MODEL",
    value: "14 / 14",
    note: "whitelist · defaults · round-trip",
  },
  {
    label: "API LOCAL",
    value: "15 / 15",
    note: "12 deterministic + 3 live stack",
  },
  {
    label: "CLIENT",
    value: "9 / 9",
    note: "REST contract + realtime state",
  },
  {
    label: "SSR",
    value: "3 / 3",
    note: "shell · shared URL · build log",
  },
  {
    label: "BROWSER",
    value: "10 / 10",
    note: "desktop + Pixel 7 profiles",
  },
  {
    label: "VIEWPORT",
    value: "2 / 2",
    note: "1440×900 · 390×844",
  },
  {
    label: "CONSOLE",
    value: "0 ERRORS",
    note: "local production browser review",
  },
  {
    label: "CI",
    value: "PASS",
    note: "API + web · run #30410815313",
  },
];

const cycleTwoFindings = [
  {
    number: "C2-R01",
    title: "6시간 필터에서도 지도 설명이 PAST 24 HOURS로 남았다.",
    resolution:
      "활성 시간 범위를 지도 컴포넌트 계약에 추가하고 브라우저 회귀 검증에 포함했다.",
  },
  {
    number: "C2-R02",
    title: "규모색을 작은 숫자 글자색으로 사용해 명도 대비가 부족했다.",
    resolution:
      "숫자는 잉크색으로 고정하고 규모색은 테두리와 지도 신호에만 남겼다.",
  },
  {
    number: "C2-R03",
    title: "선택 위치 이동이 운영체제의 모션 감소 설정을 무시했다.",
    resolution:
      "필수 애니메이션 지정을 제거하고 늦게 성공한 style.load가 임시 오류를 해제하도록 했다.",
  },
  {
    number: "C2-R04",
    title: "필터 URL에서 같은 경로의 브랜드 링크로 이동하면 상태가 남을 수 있었다.",
    resolution:
      "서버가 계산한 필터 키로 대시보드를 재마운트하고 실제 링크 이동 테스트를 추가했다.",
  },
  {
    number: "C2-R05",
    title: "모바일 history 테스트가 hydration과 경쟁해 간헐적으로 실패했다.",
    resolution:
      "실제 UI로 첫 상태를 만든 뒤 popstate를 발생시켜 제품 흐름과 테스트 시점을 일치시켰다.",
  },
  {
    number: "C2-R06",
    title: "실행 전인 원격 CI를 이미 반복 실행되는 것처럼 표현했다.",
    resolution:
      "로컬 통과와 CI 구성을 분리해 기록하고 첫 push 전 상태임을 명시했다.",
  },
  {
    number: "C2-R07",
    title: "지도 하단의 활성 시간 라벨과 베이스맵 출처가 겹쳤다.",
    resolution:
      "데스크톱에서 시간 라벨만 출처 위로 분리하고, 모바일 상단 배치는 그대로 유지한 뒤 실제 경계 상자로 겹침 0건을 확인했다.",
  },
];

export default function BuildLogPage() {
  return (
    <main className="build-log-page">
      <header className="build-log-header">
        <Link href="/" className="back-link">
          <ArrowLeft size={15} />
          LIVE MAP
        </Link>
        <div className="build-log-brand">
          <CircleDot size={19} />
          QUAKECURRENT / CYCLES 01—02
        </div>
        <span>LOCAL REVIEW · 2026-07-29</span>
      </header>

      <section className="build-log-hero">
        <span className="eyebrow">
          <RefreshCw size={14} />
          ITERATION IS THE PRODUCT
        </span>
        <h1>
          작은 동작을 만들고,
          <br />
          증거로 다음 결정을 내린다.
        </h1>
        <p>
          이 페이지는 결과물의 장식이 아니라 구현 기록입니다. 같은 지진 수직
          슬라이스를 두 번 순환하며 무엇을 만들고, 자동화하고, 검토했는지
          보여줍니다.
        </p>
      </section>

      <section className="cycle-flow" aria-label="프로젝트 사이클">
        {stages.map((stage) => (
          <article className="cycle-stage" key={stage.name}>
            <div className="cycle-stage__index">
              <span>{stage.number}</span>
              <i />
            </div>
            <div className="cycle-stage__body">
              <p>{stage.name}</p>
              <h2>{stage.headline}</h2>
              <div className="cycle-stage__copy">
                <p>{stage.body}</p>
                <ul>
                  {stage.deliverables.map((deliverable) => (
                    <li key={deliverable}>
                      <Check size={13} />
                      {deliverable}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="review-evidence">
        <div className="review-evidence__heading">
          <span>CYCLE 01 · REVIEW EVIDENCE</span>
          <h2>느낌이 아니라 실행 결과로 닫는 사이클</h2>
        </div>
        <div className="review-grid">
          {reviewChecks.map(({ icon: Icon, label, value, note }) => (
            <div className="review-card" key={label}>
              <Icon size={18} />
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          ))}
        </div>
        <div className="review-findings">
          <div className="review-findings__label">
            <Radio size={14} />
            REVIEW에서 발견해 닫은 결함
          </div>
          <div className="review-findings__list">
            {reviewFindings.map((finding) => (
              <article key={finding.number}>
                <span>{finding.number}</span>
                <div>
                  <h3>{finding.title}</h3>
                  <p>{finding.resolution}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <p className="review-disclaimer">
          배포 지표는 이번 사이클에서 제외했습니다. 인프라 선택이 확정된 뒤
          동일한 Review 단계에 production telemetry를 추가합니다.
        </p>

        <section
          aria-labelledby="cycle-two-title"
          className="cycle-two-review"
        >
          <header className="cycle-two-review__header">
            <span>CYCLE 02 · CLOSED · 2026-07-29</span>
            <h2 id="cycle-two-title">
              URL을 공유 가능한 제품 상태로 만들고, 자동 검증으로 닫았다.
            </h2>
            <p>
              현재 24시간 스냅샷은 약 45KB라 클라이언트 필터가 더 단순하다.
              gzip payload가 250KB를 넘거나 중급 모바일의 필터 계산 p95가
              50ms를 넘으면 API query와 pagination 승격을 다시 검토한다.
            </p>
          </header>

          <div className="cycle-two-flow">
            {cycleTwoStages.map((stage, index) => (
              <article key={stage.name}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{stage.name}</strong>
                  <p>{stage.body}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="cycle-two-checks">
            {cycleTwoChecks.map((check) => (
              <div key={check.label}>
                <span>{check.label}</span>
                <strong>{check.value}</strong>
                <small>{check.note}</small>
              </div>
            ))}
          </div>

          <div className="cycle-two-findings">
            <div className="cycle-two-findings__label">
              <Radio size={14} />
              CYCLE 02 REVIEW에서 닫은 결함
            </div>
            <div>
              {cycleTwoFindings.map((finding) => (
                <article key={finding.number}>
                  <span>{finding.number}</span>
                  <div>
                    <h3>{finding.title}</h3>
                    <p>{finding.resolution}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <p className="cycle-two-review__note">
            위 수치는 2026-07-29 로컬 실행 결과다. GitHub Actions{" "}
            <a
              href="https://github.com/lulupang2/QuakeCurrent/actions/runs/30410815313"
              target="_blank"
              rel="noreferrer"
            >
              Verify #30410815313
            </a>
            에서 commit dce4594의 API와 웹 작업이 모두 통과했다. 이는 원격 CI
            증거이며 배포 성능으로 표현하지 않는다. OpenAPI 재생성 drift
            gate와 production telemetry는 다음 사이클의 검토 항목이다.
          </p>
        </section>
      </section>

      <footer className="build-log-footer">
        <span>QUAKECURRENT · LIVE EARTHQUAKE MONITOR</span>
        <Link href="/">
          프로토타입 열기
          <ArrowLeft size={14} />
        </Link>
      </footer>
    </main>
  );
}
