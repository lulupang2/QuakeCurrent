import assert from "node:assert/strict";
import test from "node:test";

import {
  QuakeCurrentApiError,
  QuakeCurrentClient,
} from "../dist/index.js";

test("listEvents emits only the requested lean query parameters", async () => {
  let capturedUrl;
  let capturedInit;
  const client = new QuakeCurrentClient({
    baseUrl: "https://api.example.test/",
    fetch: async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return Response.json({
        data: [],
        meta: {
          count: 0,
          sequence: 17,
          generated_at: "2026-07-29T00:00:00Z",
        },
      });
    },
  });

  const result = await client.listEvents({
    bbox: [120, -10, 150, 40],
    limit: 50,
    updated_since: "2026-07-28T23:59:00Z",
  });

  const url = new URL(capturedUrl);
  assert.equal(url.pathname, "/v1/events");
  assert.deepEqual(
    Object.fromEntries(url.searchParams),
    {
      bbox: "120,-10,150,40",
      limit: "50",
      updated_since: "2026-07-28T23:59:00Z",
    },
  );
  assert.equal(capturedInit.method, "GET");
  assert.equal(capturedInit.credentials, "omit");
  assert.equal(new Headers(capturedInit.headers).get("accept"), "application/json");
  assert.equal(result.meta.sequence, 17);
});

test("getEvent encodes an opaque event id", async () => {
  let capturedUrl;
  const client = new QuakeCurrentClient({
    fetch: async (url) => {
      capturedUrl = String(url);
      return Response.json({
        id: "id",
        source: "usgs",
        external_id: "us/a b",
        title: "M 4.2 - test",
        magnitude: 4.2,
        magnitude_type: "mb",
        place: "test",
        occurred_at: "2026-07-29T00:00:00Z",
        updated_at: "2026-07-29T00:00:01Z",
        longitude: 127,
        latitude: 37,
        depth_km: 10,
        tsunami: false,
        source_updated_at: "2026-07-29T00:00:01Z",
        felt: 3,
        significance: 271,
        status: "reviewed",
        alert: null,
        source_url: null,
      });
    },
  });

  await client.getEvent("us/a b");
  assert.equal(new URL(capturedUrl).pathname, "/v1/events/us%2Fa%20b");
});

test("API errors preserve status, request id, and parsed detail", async () => {
  const client = new QuakeCurrentClient({
    fetch: async () =>
      Response.json(
        { detail: "event not found" },
        {
          status: 404,
          headers: { "x-request-id": "request-7" },
        },
      ),
  });

  await assert.rejects(
    () => client.getEvent("missing"),
    (error) => {
      assert.ok(error instanceof QuakeCurrentApiError);
      assert.equal(error.status, 404);
      assert.equal(error.requestId, "request-7");
      assert.deepEqual(error.body, { detail: "event not found" });
      assert.match(error.message, /event not found/);
      return true;
    },
  );
});

test("invalid client-side bounds fail before any request", () => {
  let requests = 0;
  const client = new QuakeCurrentClient({
    fetch: async () => {
      requests += 1;
      return Response.json({});
    },
  });

  assert.throws(
    () => client.listEvents({ bbox: [0, 91, 10, 20] }),
    RangeError,
  );
  assert.equal(requests, 0);
});
