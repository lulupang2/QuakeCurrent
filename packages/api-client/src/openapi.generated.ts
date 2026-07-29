/**
 * REST schema contract generated from FastAPI's OpenAPI document.
 *
 * This bootstrap copy is checked in so the web app remains type-safe before the
 * local API is running. Regenerate it from `/openapi.json` whenever a Pydantic
 * response model or REST route changes. Do not add WebSocket messages here:
 * OpenAPI does not describe that transport.
 */

export interface paths {
  "/healthz": {
    get: operations["healthz"];
  };
  "/readyz": {
    get: operations["readyz"];
  };
  "/v1/events": {
    get: operations["list_events"];
  };
  "/v1/events/changes": {
    get: operations["list_event_changes"];
  };
  "/v1/events/{event_id}": {
    get: operations["get_event"];
  };
}

export interface operations {
  healthz: {
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["HealthResponse"];
        };
      };
    };
  };
  readyz: {
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["HealthResponse"];
        };
      };
    };
  };
  list_events: {
    parameters: {
      query: {
        bbox?: string | null;
        limit?: number;
        updated_since?: string | null;
      };
    };
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["EventListResponse"];
        };
      };
    };
  };
  list_event_changes: {
    parameters: {
      query: {
        after_seq?: number;
        limit?: number;
      };
    };
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["ChangeListResponse"];
        };
      };
    };
  };
  get_event: {
    parameters: {
      path: {
        event_id: string;
      };
    };
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["EarthquakeDetail"];
        };
      };
    };
  };
}

export interface components {
  schemas: {
    HealthResponse: {
      status: "ok" | "not_ready";
      service: string;
    };
    EarthquakeSummary: {
      id: string;
      source: string;
      external_id: string;
      title: string;
      magnitude: number | null;
      magnitude_type: string | null;
      place: string | null;
      occurred_at: string;
      updated_at: string;
      longitude: number;
      latitude: number;
      depth_km: number;
      tsunami: boolean;
    };
    EarthquakeDetail: components["schemas"]["EarthquakeSummary"] & {
      source_updated_at: string;
      felt: number | null;
      significance: number | null;
      status: string | null;
      alert: string | null;
      source_url: string | null;
    };
    EventListMeta: {
      count: number;
      sequence: number;
      generated_at: string;
    };
    EventListResponse: {
      data: components["schemas"]["EarthquakeSummary"][];
      meta: components["schemas"]["EventListMeta"];
    };
    ChangeSignal: {
      seq: number;
      event_id: string;
      operation: "created" | "updated" | "deleted";
      updated_at: string;
    };
    ChangeListMeta: {
      after_seq: number;
      next_seq: number;
      has_more: boolean;
    };
    ChangeListResponse: {
      data: components["schemas"]["ChangeSignal"][];
      meta: components["schemas"]["ChangeListMeta"];
    };
  };
}
