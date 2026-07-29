import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

async function render(pathname = "/") {
  const workerUrl = new URL("../../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the QuakeCurrent dashboard shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>QuakeCurrent — Earthquake Data Prototype<\/title>/i,
  );
  assert.match(html, /QUAKECURRENT/);
  assert.match(html, /SEISMIC SIGNAL \/ FULL-STACK PROTOTYPE/);
  assert.match(html, /href="\/project"/);
  assert.match(html, /og\.png/);
  assert.match(html, /FILTER SIGNALS/);
  assert.match(html, /시간 범위/);
  assert.match(html, /최소 규모/);
  assert.match(html, /깊이 범위/);
  assert.match(html, /지구가 남긴/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("server-renders filters from a shared URL", async () => {
  const response = await render(
    "/?hours=6&minMag=4&depth=deep",
  );
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /data-filter-hours="6"/);
  assert.match(html, /data-filter-min-magnitude="4"/);
  assert.match(html, /data-filter-depth="deep"/);
});

test("server-renders the workflow build log", async () => {
  const response = await render("/build-log");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>Build Log · QuakeCurrent<\/title>/i);
  assert.match(html, /PROTOTYPE/);
  assert.match(html, /AUTOPILOT/);
  assert.match(html, /REVIEW EVIDENCE/);
  assert.match(html, /CARTO raster/);
  assert.match(html, /R-06/);
  assert.match(html, /CYCLE 02 · CLOSED/);
  assert.match(html, /10 \/ 10/);
  assert.match(html, /Verify #30410815313/);
  assert.match(html, /C2-R06/);
  assert.match(html, /C2-R07/);
  assert.match(html, /CYCLE 03 · CLOSED/);
  assert.match(html, /446 LOC/);
  assert.match(html, /C3-R04/);
  assert.match(html, /Verify #30412360163/);
  assert.match(html, /CYCLE 04 · CLOSED/);
  assert.match(html, /Python 3\.12·3\.13/);
  assert.match(html, /Verify #30418181319/);
  assert.match(html, /CYCLE 05 · CLOSED/);
  assert.match(html, /C5-R04/);
  assert.match(html, /1731 × 909/);
  assert.match(html, /Verify #30420200735/);
});

test("server-renders the recruiter project brief", async () => {
  const response = await render("/project");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>Project Brief · QuakeCurrent<\/title>/i);
  assert.match(html, /지진 피드를,/);
  assert.match(html, /구현 범위/);
  assert.match(html, /ENGINEERING DECISIONS/);
  assert.match(html, /REVIEW EVIDENCE/);
  assert.match(html, /Prototype → Plan → Autopilot → Review/);
  assert.match(html, /href="\/build-log"/);
  assert.match(html, /https:\/\/github\.com\/lulupang2\/QuakeCurrent/);
  assert.match(html, /배포 보류/);
  assert.match(html, /LOCAL VERIFIED · PUBLIC CI PASS/);
  assert.doesNotMatch(html, /PUBLIC CI PENDING/);
  assert.match(
    html,
    /https:\/\/github\.com\/lulupang2\/QuakeCurrent\/actions\/runs\/30420200735/,
  );
  assert.doesNotMatch(html, /QuakeCurrentDashboard|EarthquakeGlobe/);

  const evidencePosition = html.indexOf("02 · REVIEW EVIDENCE");
  const decisionPosition = html.indexOf("03 · ENGINEERING DECISIONS");
  const architecturePosition = html.indexOf("04 · SYSTEM FLOW");
  assert.ok(evidencePosition > -1 && evidencePosition < decisionPosition);
  assert.ok(decisionPosition < architecturePosition);

  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelectorAll("h1").length, 1);
  assert.ok(document.querySelector("a[href='#project-content']"));
  assert.ok(document.querySelector("main#project-content[tabindex='-1']"));
  assert.deepEqual(
    Array.from(
      document.querySelectorAll("nav[aria-label='프로젝트 바로가기'] a"),
      (link) => link.getAttribute("aria-label"),
    ),
    [
      "PROTOTYPE MAP — 지도 프로토타입 열기",
      "BUILD LOG — 구현 로그 보기",
      "GITHUB GH — 저장소 열기",
    ],
  );

  for (const section of document.querySelectorAll("section[aria-labelledby]")) {
    const labelId = section.getAttribute("aria-labelledby");
    assert.ok(labelId && document.getElementById(labelId));
  }

  for (const link of document.querySelectorAll("a[target='_blank']")) {
    assert.match(link.getAttribute("rel") ?? "", /\bnoreferrer\b/);
  }

  const rscManifest = await readFile(
    new URL("../../dist/server/__vite_rsc_assets_manifest.js", import.meta.url),
    "utf8",
  );
  assert.match(
    rscManifest,
    /"app\/project\/page\.tsx":\s*\{\s*"js":\s*\[\]/,
  );
});
