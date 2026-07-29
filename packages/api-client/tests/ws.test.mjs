import assert from "node:assert/strict";
import test from "node:test";

import {
  QuakeCurrentEventStream,
  EventStreamProtocolError,
} from "../dist/index.js";

class FakeWebSocket {
  readyState = 0;
  onopen = null;
  onmessage = null;
  onerror = null;
  onclose = null;
  closeCalls = [];

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  message(value) {
    this.onmessage?.({
      data: typeof value === "string" ? value : JSON.stringify(value),
    });
  }

  close(code, reason) {
    this.readyState = 3;
    this.closeCalls.push({ code, reason });
    this.onclose?.({ code, reason });
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("connects with the snapshot sequence and ignores duplicate signals", async () => {
  const sockets = [];
  const urls = [];
  const delivered = [];
  const stream = new QuakeCurrentEventStream({
    apiBaseUrl: "https://api.example.test/",
    afterSeq: 41,
    onSignal: (signal) => delivered.push(signal.seq),
    webSocketFactory: (url) => {
      urls.push(url);
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    },
  });

  stream.start();
  await tick();
  sockets[0].open();
  sockets[0].message({
    seq: 42,
    event_id: "event-1",
    operation: "created",
    updated_at: "2026-07-29T00:00:00Z",
  });
  sockets[0].message({
    seq: 42,
    event_id: "event-1",
    operation: "created",
    updated_at: "2026-07-29T00:00:00Z",
  });
  await tick();

  const url = new URL(urls[0]);
  assert.equal(url.protocol, "wss:");
  assert.equal(url.pathname, "/v1/ws/events");
  assert.equal(url.searchParams.get("after_seq"), "41");
  assert.deepEqual(delivered, [42]);
  assert.equal(stream.sequence, 42);
  assert.equal(stream.state, "open");

  stream.stop();
});

test("REST catch-up closes a sequence gap before delivering the live frame", async () => {
  const sockets = [];
  const delivered = [];
  const catchUps = [];
  let liveGapAvailable = false;
  const stream = new QuakeCurrentEventStream({
    afterSeq: 10,
    catchUp: async (afterSeq, limit) => {
      catchUps.push({ afterSeq, limit });
      return {
        data:
          liveGapAvailable && afterSeq === 10
            ? [
                {
                  seq: 11,
                  event_id: "event-11",
                  operation: "created",
                  updated_at: "2026-07-29T00:00:11Z",
                },
              ]
            : [],
        meta: {
          after_seq: afterSeq,
          next_seq:
            liveGapAvailable && afterSeq === 10 ? 11 : afterSeq,
          has_more: false,
        },
      };
    },
    onSignal: (signal) => delivered.push(signal.seq),
    webSocketFactory: () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    },
  });

  stream.start();
  await tick();
  sockets[0].open();

  // Simulate an unseen event becoming available to the REST catch-up endpoint.
  liveGapAvailable = true;

  sockets[0].message({
    seq: 12,
    event_id: "event-12",
    operation: "updated",
    updated_at: "2026-07-29T00:00:12Z",
  });
  await tick();

  assert.deepEqual(delivered, [11, 12]);
  assert.equal(stream.sequence, 12);
  assert.ok(catchUps.some(({ afterSeq }) => afterSeq === 10));
  stream.stop();
});

test("accepts monotonic database sequence gaps after catch-up", async () => {
  const sockets = [];
  const delivered = [];
  const stream = new QuakeCurrentEventStream({
    afterSeq: 11,
    catchUp: async (afterSeq) => ({
      data:
        afterSeq === 11
          ? [
              {
                seq: 15,
                event_id: "event-15",
                operation: "created",
                updated_at: "2026-07-29T00:00:15Z",
              },
            ]
          : [],
      meta: {
        after_seq: afterSeq,
        next_seq: afterSeq === 11 ? 15 : afterSeq,
        has_more: false,
      },
    }),
    onSignal: (signal) => delivered.push(signal.seq),
    webSocketFactory: () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    },
  });

  stream.start();
  await tick();
  sockets[0].open();

  assert.deepEqual(delivered, [15]);
  assert.equal(stream.sequence, 15);
  stream.stop();
});

test("reconnects with exponential backoff and the last acknowledged sequence", async () => {
  const sockets = [];
  const urls = [];
  const delays = [];
  const scheduled = [];
  const stream = new QuakeCurrentEventStream({
    afterSeq: 7,
    onSignal: () => {},
    backoff: {
      initialMs: 250,
      maximumMs: 2_000,
      multiplier: 2,
      jitter: 0,
    },
    random: () => 0.5,
    schedule: (callback, delay) => {
      delays.push(delay);
      scheduled.push(callback);
      return callback;
    },
    cancelSchedule: () => {},
    webSocketFactory: (url) => {
      urls.push(url);
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    },
  });

  stream.start();
  await tick();
  sockets[0].close(1006, "network");
  assert.deepEqual(delays, [250]);

  scheduled.shift()();
  await tick();
  sockets[1].close(1006, "network");
  assert.deepEqual(delays, [250, 500]);

  assert.equal(new URL(urls[1]).searchParams.get("after_seq"), "7");
  stream.stop();
});

test("malformed frames are reported and retried from the prior sequence", async () => {
  const sockets = [];
  const errors = [];
  const scheduled = [];
  const stream = new QuakeCurrentEventStream({
    afterSeq: 3,
    onSignal: () => {},
    onError: (error) => errors.push(error),
    schedule: (callback) => {
      scheduled.push(callback);
      return callback;
    },
    cancelSchedule: () => {},
    webSocketFactory: () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    },
  });

  stream.start();
  await tick();
  sockets[0].open();
  sockets[0].message("{bad json");
  await tick();

  assert.ok(errors.some((error) => error instanceof EventStreamProtocolError));
  assert.equal(stream.sequence, 3);
  assert.equal(stream.state, "reconnecting");
  assert.equal(scheduled.length, 1);
  assert.equal(sockets[0].closeCalls[0].code, 4001);
  stream.stop();
});
