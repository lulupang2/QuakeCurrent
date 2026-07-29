import type { EventChangePage } from "./models.js";
import {
  isEventChangeSignal,
  type EventChangeSignal,
} from "./ws-schema.js";

export type EventStreamState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed";

export interface WebSocketMessageEventLike {
  data: unknown;
}

export interface WebSocketCloseEventLike {
  code?: number;
  reason?: string;
}

export interface WebSocketLike {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: WebSocketMessageEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: WebSocketCloseEventLike) => void) | null;
  close(code?: number, reason?: string): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export interface EventStreamBackoff {
  initialMs: number;
  maximumMs: number;
  multiplier: number;
  jitter: number;
}

export interface EventStreamOptions {
  apiBaseUrl?: string;
  path?: string;
  afterSeq?: number;
  catchUp?: (afterSeq: number, limit: number) => Promise<EventChangePage>;
  catchUpPageSize?: number;
  onSignal: (signal: EventChangeSignal) => void | Promise<void>;
  onStateChange?: (state: EventStreamState) => void;
  onError?: (error: unknown) => void;
  webSocketFactory?: WebSocketFactory;
  backoff?: Partial<EventStreamBackoff>;
  random?: () => number;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  cancelSchedule?: (handle: unknown) => void;
}

export class EventStreamProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventStreamProtocolError";
  }
}

const DEFAULT_BACKOFF: EventStreamBackoff = {
  initialMs: 500,
  maximumMs: 15_000,
  multiplier: 2,
  jitter: 0.2,
};

const WS_OPEN = 1;

export class QuakeCurrentEventStream {
  private readonly apiBaseUrl: string;
  private readonly path: string;
  private readonly catchUp:
    | ((afterSeq: number, limit: number) => Promise<EventChangePage>)
    | undefined;
  private readonly catchUpPageSize: number;
  private readonly onSignal: EventStreamOptions["onSignal"];
  private readonly onStateChange:
    | ((state: EventStreamState) => void)
    | undefined;
  private readonly onError: ((error: unknown) => void) | undefined;
  private readonly createWebSocket: WebSocketFactory;
  private readonly backoff: EventStreamBackoff;
  private readonly random: () => number;
  private readonly schedule: (
    callback: () => void,
    delayMs: number,
  ) => unknown;
  private readonly cancelSchedule: (handle: unknown) => void;

  private stateValue: EventStreamState = "idle";
  private sequenceValue: number;
  private socket: WebSocketLike | null = null;
  private retryHandle: unknown;
  private retryAttempt = 0;
  private generation = 0;
  private incoming = Promise.resolve();

  constructor(options: EventStreamOptions) {
    validateSequence(options.afterSeq ?? 0, "afterSeq");
    validatePositiveInteger(options.catchUpPageSize ?? 200, "catchUpPageSize");

    this.apiBaseUrl = normalizeApiBaseUrl(
      options.apiBaseUrl ?? "http://localhost:8000",
    );
    this.path = normalizePath(options.path ?? "/v1/ws/events");
    this.sequenceValue = options.afterSeq ?? 0;
    this.catchUp = options.catchUp;
    this.catchUpPageSize = options.catchUpPageSize ?? 200;
    this.onSignal = options.onSignal;
    this.onStateChange = options.onStateChange;
    this.onError = options.onError;
    this.createWebSocket =
      options.webSocketFactory ?? defaultWebSocketFactory;
    this.backoff = {
      ...DEFAULT_BACKOFF,
      ...options.backoff,
    };
    validateBackoff(this.backoff);
    this.random = options.random ?? Math.random;
    this.schedule =
      options.schedule ??
      ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));
    this.cancelSchedule =
      options.cancelSchedule ??
      ((handle) => globalThis.clearTimeout(handle as number));
  }

  get state(): EventStreamState {
    return this.stateValue;
  }

  get sequence(): number {
    return this.sequenceValue;
  }

  get url(): string {
    return buildWebSocketUrl(
      this.apiBaseUrl,
      this.path,
      this.sequenceValue,
    );
  }

  start(): void {
    if (
      this.stateValue === "connecting" ||
      this.stateValue === "open" ||
      this.stateValue === "reconnecting"
    ) {
      return;
    }

    this.generation += 1;
    this.retryAttempt = 0;
    this.transition("connecting");
    void this.connect(this.generation);
  }

  stop(code = 1000, reason = "client stopped"): void {
    this.generation += 1;
    if (this.retryHandle !== undefined) {
      this.cancelSchedule(this.retryHandle);
      this.retryHandle = undefined;
    }

    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState <= WS_OPEN) {
      socket.close(code, reason);
    }
    this.transition("closed");
  }

  private async connect(generation: number): Promise<void> {
    try {
      await this.replayMissedChanges(generation);
      if (generation !== this.generation) {
        return;
      }

      const socket = this.createWebSocket(this.url);
      this.socket = socket;
      socket.onopen = () => {
        if (generation !== this.generation || socket !== this.socket) {
          socket.close(1000, "stale connection");
          return;
        }
        this.retryAttempt = 0;
        this.transition("open");
      };
      socket.onmessage = (event) => {
        this.incoming = this.incoming
          .then(() => this.receive(event.data, generation, socket))
          .catch((error: unknown) => {
            this.report(error);
            if (socket === this.socket) {
              // Browsers only allow application-supplied close codes in the
              // 3000–4999 range. 1011 is reserved for server-generated frames.
              socket.close(4001, "message handling failed");
            }
          });
      };
      socket.onerror = (event) => {
        this.report(event);
      };
      socket.onclose = () => {
        if (socket === this.socket) {
          this.socket = null;
        }
        if (generation === this.generation) {
          this.queueReconnect(generation);
        }
      };
    } catch (error) {
      this.report(error);
      if (generation === this.generation) {
        this.queueReconnect(generation);
      }
    }
  }

  private async receive(
    raw: unknown,
    generation: number,
    socket: WebSocketLike,
  ): Promise<void> {
    if (generation !== this.generation || socket !== this.socket) {
      return;
    }

    const signal = parseSignal(raw);
    if (signal.seq <= this.sequenceValue) {
      return;
    }

    if (signal.seq > this.sequenceValue + 1) {
      if (!this.catchUp) {
        throw new EventStreamProtocolError(
          `Sequence gap: expected ${this.sequenceValue + 1}, received ${signal.seq}.`,
        );
      }
      await this.replayMissedChanges(generation);
      if (signal.seq <= this.sequenceValue) {
        return;
      }
    }

    await this.deliver(signal);
  }

  private async replayMissedChanges(generation: number): Promise<void> {
    if (!this.catchUp) {
      return;
    }

    let pages = 0;
    while (generation === this.generation) {
      const after = this.sequenceValue;
      const page = await this.catchUp(after, this.catchUpPageSize);
      validateChangePage(page, after);

      const ordered = [...page.data].sort((left, right) => left.seq - right.seq);
      for (const change of ordered) {
        if (generation !== this.generation) {
          return;
        }
        if (change.seq <= this.sequenceValue) {
          continue;
        }
        // PostgreSQL sequences are monotonic cursors, not gap-free counters:
        // rolled-back inserts can consume values. Strict ordering is enough.
        await this.deliver(change);
      }

      if (!page.meta.has_more) {
        return;
      }
      if (this.sequenceValue === after) {
        throw new EventStreamProtocolError(
          "Catch-up page did not advance its sequence.",
        );
      }
      pages += 1;
      if (pages >= 10_000) {
        throw new EventStreamProtocolError(
          "Catch-up exceeded the safety page limit.",
        );
      }
    }
  }

  private async deliver(signal: EventChangeSignal): Promise<void> {
    await this.onSignal(signal);
    this.sequenceValue = signal.seq;
  }

  private queueReconnect(generation: number): void {
    if (generation !== this.generation || this.stateValue === "closed") {
      return;
    }

    this.transition("reconnecting");
    const exponent = this.retryAttempt;
    this.retryAttempt += 1;
    const base = Math.min(
      this.backoff.maximumMs,
      this.backoff.initialMs *
        Math.pow(this.backoff.multiplier, exponent),
    );
    const jitterScale =
      1 + (this.random() * 2 - 1) * this.backoff.jitter;
    const delay = Math.max(0, Math.round(base * jitterScale));

    this.retryHandle = this.schedule(() => {
      this.retryHandle = undefined;
      if (generation !== this.generation) {
        return;
      }
      void this.connect(generation);
    }, delay);
  }

  private transition(next: EventStreamState): void {
    if (next === this.stateValue) {
      return;
    }
    this.stateValue = next;
    this.onStateChange?.(next);
  }

  private report(error: unknown): void {
    this.onError?.(error);
  }
}

export function createEventStreamCatchUp(
  listChanges: (
    query: { after_seq: number; limit: number },
  ) => Promise<EventChangePage>,
): NonNullable<EventStreamOptions["catchUp"]> {
  return (afterSeq, limit) =>
    listChanges({ after_seq: afterSeq, limit });
}

function parseSignal(raw: unknown): EventChangeSignal {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch (error) {
      throw new EventStreamProtocolError(
        `Invalid WebSocket JSON: ${String(error)}`,
      );
    }
  }

  if (!isEventChangeSignal(value)) {
    throw new EventStreamProtocolError(
      "WebSocket frame does not match EventChangeSignal.",
    );
  }
  return value;
}

function validateChangePage(page: EventChangePage, afterSeq: number): void {
  if (
    typeof page !== "object" ||
    page === null ||
    !Array.isArray(page.data) ||
    typeof page.meta !== "object" ||
    page.meta === null
  ) {
    throw new EventStreamProtocolError("Catch-up returned an invalid page.");
  }
  validateSequence(page.meta.after_seq, "page.meta.after_seq");
  validateSequence(page.meta.next_seq, "page.meta.next_seq");
  if (typeof page.meta.has_more !== "boolean") {
    throw new EventStreamProtocolError(
      "Catch-up page has an invalid has_more value.",
    );
  }
  if (page.meta.after_seq !== afterSeq) {
    throw new EventStreamProtocolError(
      `Catch-up page started at ${page.meta.after_seq}, expected ${afterSeq}.`,
    );
  }
  for (const signal of page.data) {
    if (!isEventChangeSignal(signal)) {
      throw new EventStreamProtocolError(
        "Catch-up page contains an invalid change signal.",
      );
    }
  }
}

function normalizeApiBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("apiBaseUrl must use http or https.");
  }
  return url.toString().replace(/\/+$/, "");
}

function normalizePath(value: string): string {
  return `/${value.replace(/^\/+/, "")}`;
}

function buildWebSocketUrl(
  apiBaseUrl: string,
  path: string,
  afterSeq: number,
): string {
  const url = new URL(`${apiBaseUrl}${path}`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("after_seq", String(afterSeq));
  return url.toString();
}

function defaultWebSocketFactory(url: string): WebSocketLike {
  if (typeof globalThis.WebSocket !== "function") {
    throw new TypeError(
      "A WebSocket implementation is required in this environment.",
    );
  }
  return new globalThis.WebSocket(url) as unknown as WebSocketLike;
}

function validateSequence(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
}

function validatePositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
}

function validateBackoff(value: EventStreamBackoff): void {
  if (
    !Number.isFinite(value.initialMs) ||
    value.initialMs < 0 ||
    !Number.isFinite(value.maximumMs) ||
    value.maximumMs < value.initialMs ||
    !Number.isFinite(value.multiplier) ||
    value.multiplier < 1 ||
    !Number.isFinite(value.jitter) ||
    value.jitter < 0 ||
    value.jitter > 1
  ) {
    throw new RangeError("Invalid reconnect backoff configuration.");
  }
}
