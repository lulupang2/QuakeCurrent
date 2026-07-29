import assert from "node:assert/strict";
import test from "node:test";

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
    /<title>QuakeCurrent — Live Earthquake Monitor<\/title>/i,
  );
  assert.match(html, /QUAKECURRENT/);
  assert.match(html, /SEISMIC SIGNAL \/ CYCLE 02/);
  assert.match(html, /og-cycle-02\.png/);
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
  assert.match(html, /remote run pending/);
  assert.match(html, /C2-R06/);
  assert.match(html, /C2-R07/);
});
