import type { components } from "./openapi.generated.js";

type Schema<Name extends keyof components["schemas"]> =
  components["schemas"][Name];

export type HealthResponse = Schema<"HealthResponse">;
export type ReadinessResponse = HealthResponse;
export type EarthquakeSummary = Schema<"EarthquakeSummary">;
export type EarthquakeDetail = Schema<"EarthquakeDetail">;
export type SnapshotMeta = Schema<"EventListMeta">;
export type EarthquakeSnapshot = Schema<"EventListResponse">;
export type EventChange = Schema<"ChangeSignal">;
export type ChangePageMeta = Schema<"ChangeListMeta">;
export type EventChangePage = Schema<"ChangeListResponse">;

export type BoundingBox = readonly [
  west: number,
  south: number,
  east: number,
  north: number,
];

export interface ListEventsQuery {
  /**
   * WGS84 bounds in west, south, east, north order. Crossing the antimeridian
   * is represented by west being greater than east.
   */
  bbox?: BoundingBox;
  limit?: number;
  updated_since?: string;
}

export interface ListChangesQuery {
  after_seq?: number;
  limit?: number;
}
