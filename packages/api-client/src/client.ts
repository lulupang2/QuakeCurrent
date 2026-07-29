import type {
  EarthquakeDetail,
  EarthquakeSnapshot,
  EventChangePage,
  HealthResponse,
  ListChangesQuery,
  ListEventsQuery,
  ReadinessResponse,
} from "./models.js";

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface QuakeCurrentClientOptions {
  baseUrl?: string;
  fetch?: FetchLike;
  headers?: HeadersInit;
}

export interface ApiRequestOptions {
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export class QuakeCurrentApiError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  readonly body: unknown;

  constructor(
    message: string,
    options: {
      status: number;
      requestId: string | null;
      body: unknown;
    },
  ) {
    super(message);
    this.name = "QuakeCurrentApiError";
    this.status = options.status;
    this.requestId = options.requestId;
    this.body = options.body;
  }
}

const DEFAULT_BASE_URL = "http://localhost:8000";

export class QuakeCurrentClient {
  readonly baseUrl: string;

  private readonly fetchImpl: FetchLike;
  private readonly defaultHeaders: Headers;

  constructor(options: QuakeCurrentClientOptions = {}) {
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new TypeError(
        "A Fetch API implementation is required in this environment.",
      );
    }

    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.defaultHeaders = new Headers(options.headers);
    if (!this.defaultHeaders.has("accept")) {
      this.defaultHeaders.set("accept", "application/json");
    }
  }

  health(options?: ApiRequestOptions): Promise<HealthResponse> {
    return this.get("/healthz", undefined, options);
  }

  readiness(options?: ApiRequestOptions): Promise<ReadinessResponse> {
    return this.get("/readyz", undefined, options);
  }

  listEvents(
    query: ListEventsQuery = {},
    options?: ApiRequestOptions,
  ): Promise<EarthquakeSnapshot> {
    validateLimit(query.limit);
    if (query.bbox) {
      validateBoundingBox(query.bbox);
    }

    return this.get(
      "/v1/events",
      {
        bbox: query.bbox?.join(","),
        limit: query.limit,
        updated_since: query.updated_since,
      },
      options,
    );
  }

  listChanges(
    query: ListChangesQuery = {},
    options?: ApiRequestOptions,
  ): Promise<EventChangePage> {
    validateSequence(query.after_seq, "after_seq");
    validateLimit(query.limit);

    return this.get(
      "/v1/events/changes",
      {
        after_seq: query.after_seq,
        limit: query.limit,
      },
      options,
    );
  }

  getEvent(
    eventId: string,
    options?: ApiRequestOptions,
  ): Promise<EarthquakeDetail> {
    if (eventId.trim().length === 0) {
      throw new TypeError("eventId must not be empty.");
    }

    return this.get(
      `/v1/events/${encodeURIComponent(eventId)}`,
      undefined,
      options,
    );
  }

  private async get<T>(
    pathname: string,
    query?: Record<string, string | number | undefined>,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${pathname}`);
    if (query) {
      for (const [name, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(name, String(value));
        }
      }
    }

    const headers = new Headers(this.defaultHeaders);
    new Headers(options?.headers).forEach((value, name) => {
      headers.set(name, value);
    });

    const requestInit: RequestInit = {
      method: "GET",
      headers,
      credentials: "omit",
    };
    if (options?.signal) {
      requestInit.signal = options.signal;
    }

    const response = await this.fetchImpl(url, requestInit);

    if (!response.ok) {
      const body = await readErrorBody(response);
      const detail =
        isDetailBody(body) && typeof body.detail === "string"
          ? `: ${body.detail}`
          : "";
      throw new QuakeCurrentApiError(
        `QuakeCurrent API request failed (${response.status})${detail}`,
        {
          status: response.status,
          requestId: response.headers.get("x-request-id"),
          body,
        },
      );
    }

    return (await response.json()) as T;
  }
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("baseUrl must use http or https.");
  }
  return url.toString().replace(/\/+$/, "");
}

function validateLimit(value: number | undefined): void {
  if (
    value !== undefined &&
    (!Number.isSafeInteger(value) || value < 1)
  ) {
    throw new RangeError("limit must be a positive safe integer.");
  }
}

function validateSequence(
  value: number | undefined,
  label: string,
): void {
  if (
    value !== undefined &&
    (!Number.isSafeInteger(value) || value < 0)
  ) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
}

function validateBoundingBox(
  bbox: readonly [number, number, number, number],
): void {
  if (!bbox.every(Number.isFinite)) {
    throw new RangeError("bbox coordinates must be finite numbers.");
  }

  const [, south, , north] = bbox;
  if (
    south < -90 ||
    south > 90 ||
    north < -90 ||
    north > 90 ||
    south > north
  ) {
    throw new RangeError(
      "bbox latitude must be between -90 and 90, with south <= north.",
    );
  }
}

async function readErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

function isDetailBody(value: unknown): value is { detail: unknown } {
  return typeof value === "object" && value !== null && "detail" in value;
}
