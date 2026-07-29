import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Braces,
  CheckCircle2,
  CircleDot,
  Code2,
  Database,
  GitBranch,
  Globe2,
  Layers3,
  Radio,
  Server,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import styles from "./project.module.css";

const GITHUB_REPOSITORY = "https://github.com/lulupang2/QuakeCurrent";
const VERIFY_WORKFLOW =
  "https://github.com/lulupang2/QuakeCurrent/actions/workflows/verify.yml";

export const metadata: Metadata = {
  title: "Project Brief",
  description:
    "QuakeCurrent의 문제 정의, 구현 범위, 기술 판단과 검증 증거를 빠르게 파악하도록 구성한 프로젝트 소개.",
};

const scopeItems = [
  "최근 24시간 지진이라는 수직 슬라이스와 한국어 정보 구조",
  "React·MapLibre·deck.gl 기반 데스크톱·모바일 지도 UX",
  "FastAPI·PostGIS·Celery·Redis 수집 및 변경 신호",
  "OpenAPI TypeScript 생성, 회귀 테스트와 CI 자동 검증",
];

const architecture = [
  {
    name: "USGS",
    note: "60초 조건부 수집",
    icon: Radio,
  },
  {
    name: "POSTGIS",
    note: "멱등 upsert·공간 저장",
    icon: Database,
  },
  {
    name: "FASTAPI",
    note: "REST 스냅샷·WS 신호",
    icon: Server,
  },
  {
    name: "OPENAPI TS",
    note: "생성 계약·drift gate",
    icon: Braces,
  },
  {
    name: "MAP UI",
    note: "목록·통계·3D/2D 지도",
    icon: Globe2,
  },
];

const decisions = [
  {
    number: "D-01",
    title: "작은 스냅샷은 브라우저에서 필터링",
    body: "Cycle 02의 로컬 측정에서 응답 스냅샷이 약 45KB여서 API 복잡도를 먼저 늘리지 않았다. 시간·규모·깊이 상태는 URL에 보존해 공유와 새로고침을 같은 경계로 처리했다.",
    meta: "승격 기준 · gzip 250KB 또는 계산 p95 50ms 초과",
  },
  {
    number: "D-02",
    title: "전체 데이터 대신 작은 변경 신호",
    body: "WebSocket에는 사건 본문 대신 ID·operation·sequence·updated_at 변경 메타데이터만 전달한다. 연결이 끊기면 마지막 sequence 이후의 변경을 REST로 복구한다.",
    meta: "REST snapshot + compact WebSocket signal",
  },
  {
    number: "D-03",
    title: "서버 계약에서 TypeScript를 생성",
    body: "FastAPI를 REST 계약의 유일한 원본으로 두고 OpenAPI 스냅샷과 TypeScript 타입을 생성한다. 어느 한쪽만 바뀌면 로컬과 CI가 실패한다.",
    meta: "5 paths · 11 schemas · 446 generated LOC",
  },
  {
    number: "D-04",
    title: "같은 커밋은 같은 Python 의존성으로",
    body: "uv.lock에 직접·전이 의존성과 해시를 고정했다. Python 3.12와 3.13에서 같은 계약과 테스트를 실행하고 컨테이너도 같은 lock을 소비한다.",
    meta: "uv 0.12.0 · Python 3.12 / 3.13",
  },
];

const evidence = [
  {
    label: "IDEMPOTENCY",
    value: "0 NEW / SIGNALS",
    note: "2-event fixture 재수집 · 로컬 통합",
  },
  {
    label: "API TESTS",
    value: "15 PASS",
    note: "버전별 결정론 15 · 통합 3 제외",
  },
  {
    label: "BROWSER",
    value: "10 / 10",
    note: "데스크톱·모바일 URL 흐름",
  },
  {
    label: "DRIFT GATES",
    value: "2 / 2",
    note: "FastAPI→OpenAPI→TypeScript",
  },
  {
    label: "WEB MODEL",
    value: "14 / 14",
    note: "URL 필터 · 지역화 · 시간/깊이",
  },
  {
    label: "CI",
    value: "PENDING",
    note: "현재 변경 push 후 확인",
  },
];

const workflow = [
  {
    number: "01",
    name: "PROTOTYPE",
    body: "최근 24시간 지진 탐색이라는 가장 얇은 수직 슬라이스로 사용자 동선을 먼저 확인했다.",
  },
  {
    number: "02",
    name: "PLAN",
    body: "중복 수집, 재연결 누락, 계약 불일치를 화면보다 먼저 닫아야 할 실패 경로로 정했다.",
  },
  {
    number: "03",
    name: "AUTOPILOT",
    body: "수집·타입 생성·잠금 설치·테스트·CI 검증을 반복 가능한 명령과 파이프라인으로 만들었다.",
  },
  {
    number: "04",
    name: "REVIEW",
    body: "실제 결함과 보류 범위를 숨기지 않고 수정 결과, 실행 링크, 다음 판단 기준과 함께 기록했다.",
  },
];

export default function ProjectPage() {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#project-content">
        프로젝트 소개 본문으로 건너뛰기
      </a>

      <header className={styles.siteHeader}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/project" aria-current="page">
            <CircleDot aria-hidden="true" size={18} />
            <span>
              QUAKECURRENT
              <small>PROJECT BRIEF</small>
            </span>
          </Link>

          <nav className={styles.headerNav} aria-label="프로젝트 바로가기">
            <Link href="/" aria-label="PROTOTYPE MAP — 지도 프로토타입 열기">
              <span className={styles.navLong}>PROTOTYPE</span>
              <span aria-hidden="true" className={styles.navShort}>MAP</span>
              <ArrowUpRight aria-hidden="true" size={13} />
            </Link>
            <Link href="/build-log" aria-label="BUILD LOG — 구현 로그 보기">
              <span className={styles.navLong}>BUILD LOG</span>
              <span aria-hidden="true" className={styles.navShort}>LOG</span>
            </Link>
            <a
              aria-label="GITHUB GH — 저장소 열기"
              href={GITHUB_REPOSITORY}
              rel="noreferrer"
              target="_blank"
            >
              <span className={styles.navLong}>GITHUB</span>
              <span aria-hidden="true" className={styles.navShort}>GH</span>
              <ArrowUpRight aria-hidden="true" size={13} />
            </a>
          </nav>
        </div>
      </header>

      <main className={styles.main} id="project-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="project-title">
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <Radio aria-hidden="true" size={14} />
              FULL-STACK DATA PROTOTYPE · CASE STUDY
            </span>
            <h1 id="project-title">
              지진 피드를,
              <br />
              끊겨도 복구되는
              <br />
              데이터 제품으로.
            </h1>
            <p>
              USGS 최근 24시간 지진 피드를 수집·정규화하고, REST
              스냅샷과 변경 사건만 알리는 WebSocket 신호로 3D·2D 지도에
              연결한 풀스택 프로토타입입니다.
            </p>

            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} href="/">
                프로토타입 열기
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
              <Link className={styles.secondaryAction} href="/build-log">
                구현·검증 로그 보기
              </Link>
            </div>
          </div>

          <aside className={styles.heroSummary} aria-label="프로젝트 요약">
            <div className={styles.summaryStatus}>
              <span />
              LOCAL VERIFIED · PUBLIC CI PENDING
            </div>
            <dl>
              <div>
                <dt>PRODUCT</dt>
                <dd>지진 데이터 탐색 프로토타입</dd>
              </div>
              <div>
                <dt>IMPLEMENTED SCOPE</dt>
                <dd>제품 · UI · API/데이터 · 품질/CI</dd>
              </div>
              <div>
                <dt>WORKFLOW</dt>
                <dd>Prototype → Plan → Autopilot → Review</dd>
              </div>
              <div>
                <dt>STATUS</dt>
                <dd>로컬 검증 완료 / 원격 CI 대기 / 배포 보류</dd>
              </div>
            </dl>
            <a
              className={styles.sourceLink}
              href={GITHUB_REPOSITORY}
              rel="noreferrer"
              target="_blank"
            >
              공개 저장소에서 코드 보기
              <ArrowUpRight aria-hidden="true" size={15} />
            </a>
          </aside>
        </section>

        <section className={styles.summarySection} aria-labelledby="summary-title">
          <header className={styles.sectionHeading}>
            <span>01 · PROBLEM / RESPONSE</span>
            <h2 id="summary-title">지도보다 먼저, 실패 경로를 제품 범위에 넣었습니다.</h2>
          </header>

          <div className={styles.problemGrid}>
            <article>
              <span>PROBLEM</span>
              <h3>표시보다 어려운 것은 중복·복구·계약 불일치였습니다.</h3>
              <p>
                변경 신호형 지도는 데이터를 그리는 것만으로 끝나지 않습니다. 같은
                사건의 중복 적재, 연결 단절 사이의 누락, 서버와 클라이언트 타입의
                불일치가 사용 경험을 먼저 무너뜨릴 수 있습니다.
              </p>
            </article>
            <article>
              <span>RESPONSE</span>
              <h3>멱등 저장부터 재연결과 타입 생성까지 한 흐름으로 묶었습니다.</h3>
              <p>
                source와 external_id 기반 upsert, sequence 이후 REST catch-up,
                FastAPI → OpenAPI → TypeScript 자동 검증을 하나의 수직
                슬라이스 안에서 연결했습니다.
              </p>
            </article>
          </div>

          <div className={styles.scopeBlock}>
            <div>
              <Layers3 aria-hidden="true" size={18} />
              <span>구현 범위</span>
            </div>
            <ul>
              {scopeItems.map((item) => (
                <li key={item}>
                  <CheckCircle2 aria-hidden="true" size={15} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.evidenceSection} aria-labelledby="evidence-title">
          <header className={styles.sectionHeading}>
            <span>02 · REVIEW EVIDENCE</span>
            <h2 id="evidence-title">설명 대신 다시 실행할 수 있는 증거</h2>
          </header>

          <div className={styles.evidenceGrid}>
            {evidence.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.note}</small>
              </div>
            ))}
          </div>

          <div className={styles.evidenceLinks}>
            <a href={VERIFY_WORKFLOW} rel="noreferrer" target="_blank">
              <GitBranch aria-hidden="true" size={15} />
              GitHub Actions 확인
              <ArrowUpRight aria-hidden="true" size={14} />
            </a>
            <Link href="/build-log">
              <ShieldCheck aria-hidden="true" size={15} />
              결함과 수정 증거 전체 보기
            </Link>
          </div>

          <p className={styles.disclaimer}>
            위 수치는 로컬 검증 결과이며 공개 CI는 현재 변경을 push한 뒤 다시
            확인합니다. 실제 사용자 트래픽, 프로덕션 가용성이나 운영 성능을
            의미하지 않습니다.
          </p>
        </section>

        <section className={styles.decisionSection} aria-labelledby="decision-title">
          <header className={styles.sectionHeading}>
            <span>03 · ENGINEERING DECISIONS</span>
            <h2 id="decision-title">기술 이름보다 선택 기준을 남겼습니다.</h2>
          </header>

          <div className={styles.decisionGrid}>
            {decisions.map((decision) => (
              <article key={decision.number}>
                <span>{decision.number}</span>
                <h3>{decision.title}</h3>
                <p>{decision.body}</p>
                <small>{decision.meta}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.architectureSection} aria-labelledby="architecture-title">
          <header className={styles.sectionHeading}>
            <span>04 · SYSTEM FLOW</span>
            <h2 id="architecture-title">원본 피드에서 사용자의 지도까지 이어지는 경계</h2>
          </header>

          <ol className={styles.architectureFlow}>
            {architecture.map(({ icon: Icon, name, note }, index) => (
              <li key={name}>
                <div>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon aria-hidden="true" size={18} />
                </div>
                <strong>{name}</strong>
                <small>{note}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.workflowSection} aria-labelledby="workflow-title">
          <header className={styles.sectionHeading}>
            <span>05 · ITERATION LOOP</span>
            <h2 id="workflow-title">한 번 만든 뒤 끝내지 않는 작업 방식</h2>
          </header>

          <ol className={styles.workflowGrid}>
            {workflow.map((step) => (
              <li key={step.name}>
                <span>{step.number}</span>
                <strong>{step.name}</strong>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.boundarySection} aria-labelledby="boundary-title">
          <div>
            <span className={styles.eyebrow}>
              <ShieldCheck aria-hidden="true" size={14} />
              EXPLICIT BOUNDARIES
            </span>
            <h2 id="boundary-title">완료한 것과 하지 않은 것을 함께 기록합니다.</h2>
          </div>
          <ul>
            <li>실시간 재난 경보 서비스가 아닌 개발 프로토타입입니다.</li>
            <li>API가 없을 때는 내장 데모 스냅샷임을 화면에 표시합니다.</li>
            <li>배포·실사용 트래픽·production telemetry는 현재 검증 범위에서 제외했습니다.</li>
          </ul>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <Code2 aria-hidden="true" size={18} />
          <span>
            QUAKECURRENT
            <small>FULL-STACK EARTHQUAKE DATA PROTOTYPE</small>
          </span>
        </div>
        <nav aria-label="다음 화면">
          <Link href="/">
            <ArrowLeft aria-hidden="true" size={14} />
            프로토타입 지도
          </Link>
          <Link href="/build-log">
            전체 Build Log
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </nav>
      </footer>
    </div>
  );
}
