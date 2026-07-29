import { describe, expect, it } from "vitest";
import {
  buildApiUrl,
  buildWebSocketUrl,
  createDemoSnapshot,
  DEFAULT_EARTHQUAKE_FILTERS,
  filterEarthquakes,
  localizeUsgsPlace,
  magnitudeColor,
  normalizeEarthquake,
  parseEarthquakeFiltersFromSearchParams,
  relativeTime,
  serializeEarthquakeFiltersToSearchParams,
  sortByMostRecent,
} from "../model/earthquakes";

describe("earthquake presentation helpers", () => {
  it("creates a deterministic, recent demo snapshot for a supplied clock", () => {
    const now = new Date("2026-07-29T12:00:00.000Z");
    const snapshot = createDemoSnapshot(now);

    expect(snapshot.meta.generated_at).toBe(now.toISOString());
    expect(snapshot.data).toHaveLength(10);
    expect(snapshot.data[0].occurred_at).toBe("2026-07-29T11:52:00.000Z");
    expect(snapshot.data[0].source_url).toMatch(/^https:\/\/earthquake\.usgs\.gov/);
  });

  it("sorts without mutating the source array", () => {
    const snapshot = createDemoSnapshot(
      new Date("2026-07-29T12:00:00.000Z"),
    );
    const source = [snapshot.data[2], snapshot.data[0], snapshot.data[1]];
    const sorted = sortByMostRecent(source);

    expect(sorted.map((event) => event.id)).toEqual([
      "demo-01",
      "demo-02",
      "demo-03",
    ]);
    expect(source[0].id).toBe("demo-03");
  });

  it("builds REST and WebSocket endpoints without duplicate slashes", () => {
    expect(buildApiUrl("http://localhost:8000/", "/v1/events")).toBe(
      "http://localhost:8000/v1/events",
    );
    expect(buildWebSocketUrl("https://api.example.com/", 42)).toBe(
      "wss://api.example.com/v1/ws/events?after_seq=42",
    );
  });

  it("keeps time and magnitude signals readable", () => {
    expect(
      relativeTime("2026-07-29T11:30:00.000Z", Date.parse("2026-07-29T12:00:00.000Z")),
    ).toBe("30분 전");
    expect(magnitudeColor(5.5)).toBe("#ff4d3d");
    expect(magnitudeColor(null)).toBe("#8892a0");
  });

  it("localizes USGS distance, direction, and region suffixes", () => {
    expect(localizeUsgsPlace("6 km E of Home Gardens, CA")).toBe(
      "Home Gardens, 캘리포니아주 동쪽 6km",
    );
    expect(localizeUsgsPlace("10 km WNW of Honmachi, Japan")).toBe(
      "Honmachi, 일본 서북서쪽 10km",
    );
    expect(localizeUsgsPlace("South of Fiji")).toBe("피지 남쪽");
  });

  it("preserves unknown proper nouns and handles missing locations", () => {
    expect(localizeUsgsPlace("Atlantis")).toBe("Atlantis");
    expect(localizeUsgsPlace("쿠릴 열도 동쪽 해역")).toBe(
      "쿠릴 열도 동쪽 해역",
    );
    expect(localizeUsgsPlace(null)).toBe("위치 정보 없음");
  });

  it("applies localization at the presentation-model boundary", () => {
    const snapshot = createDemoSnapshot(
      new Date("2026-07-29T12:00:00.000Z"),
    );
    const normalized = normalizeEarthquake({
      ...snapshot.data[0],
      place: "4 km SSW of Indios, Puerto Rico",
    });

    expect(normalized.place).toBe("Indios, 푸에르토리코 남남서쪽 4km");
  });

  it("parses valid URL filters and falls back for invalid values", () => {
    expect(
      parseEarthquakeFiltersFromSearchParams(
        new URLSearchParams(
          "hours=6&minMag=4&depth=intermediate",
        ),
      ),
    ).toEqual({
      timeWindowHours: 6,
      minimumMagnitude: 4,
      depthBand: "intermediate",
    });

    expect(
      parseEarthquakeFiltersFromSearchParams(
        new URLSearchParams(
          "hours=01&minMag=4.0&depth=DEEP",
        ),
      ),
    ).toEqual(DEFAULT_EARTHQUAKE_FILTERS);

    expect(
      parseEarthquakeFiltersFromSearchParams(
        new URLSearchParams(
          "hours=1&hours=6&minMag=5&depth=unknown",
        ),
      ),
    ).toEqual({
      timeWindowHours: 24,
      minimumMagnitude: 5,
      depthBand: "all",
    });
  });

  it("serializes non-default filters and preserves unrelated URL state", () => {
    const searchParams = serializeEarthquakeFiltersToSearchParams(
      {
        timeWindowHours: 1,
        minimumMagnitude: 5,
        depthBand: "deep",
      },
      new URLSearchParams("view=globe&hours=24&hours=6"),
    );

    expect(searchParams.get("view")).toBe("globe");
    expect(searchParams.getAll("hours")).toEqual(["1"]);
    expect(searchParams.get("minMag")).toBe("5");
    expect(searchParams.get("depth")).toBe("deep");

    const resetParams = serializeEarthquakeFiltersToSearchParams(
      DEFAULT_EARTHQUAKE_FILTERS,
      searchParams,
    );
    expect(resetParams.toString()).toBe("view=globe");
  });

  it("round-trips every non-default URL filter", () => {
    const filters = {
      timeWindowHours: 6,
      minimumMagnitude: 3,
      depthBand: "shallow",
    } as const;
    const searchParams =
      serializeEarthquakeFiltersToSearchParams(filters);

    expect(
      parseEarthquakeFiltersFromSearchParams(searchParams),
    ).toEqual(filters);
  });

  it("filters time windows with an inclusive cutoff", () => {
    const now = Date.parse("2026-07-29T12:00:00.000Z");
    const base = createDemoSnapshot(new Date(now)).data[0];
    const events = [
      {
        ...base,
        id: "inside",
        occurred_at: new Date(now - 59 * 60_000).toISOString(),
      },
      {
        ...base,
        id: "now",
        occurred_at: new Date(now).toISOString(),
      },
      {
        ...base,
        id: "boundary",
        occurred_at: new Date(now - 60 * 60_000).toISOString(),
      },
      {
        ...base,
        id: "outside",
        occurred_at: new Date(now - 60 * 60_000 - 1).toISOString(),
      },
      {
        ...base,
        id: "future",
        occurred_at: new Date(now + 1).toISOString(),
      },
      {
        ...base,
        id: "invalid",
        occurred_at: "not-a-timestamp",
      },
    ];

    const sourceIds = events.map((event) => event.id);
    const filtered = filterEarthquakes(
      events,
      { ...DEFAULT_EARTHQUAKE_FILTERS, timeWindowHours: 1 },
      now,
    );

    expect(filtered.map((event) => event.id)).toEqual([
      "inside",
      "now",
      "boundary",
    ]);
    expect(filtered).not.toBe(events);
    expect(events.map((event) => event.id)).toEqual(sourceIds);
  });

  it("maps every supported time window to its requested range", () => {
    const now = Date.parse("2026-07-29T12:00:00.000Z");
    const base = createDemoSnapshot(new Date(now)).data[0];
    const events = [
      { ...base, id: "now", occurred_at: new Date(now).toISOString() },
      {
        ...base,
        id: "two-hours",
        occurred_at: new Date(now - 2 * 60 * 60_000).toISOString(),
      },
      {
        ...base,
        id: "eight-hours",
        occurred_at: new Date(now - 8 * 60 * 60_000).toISOString(),
      },
      {
        ...base,
        id: "twenty-five-hours",
        occurred_at: new Date(now - 25 * 60 * 60_000).toISOString(),
      },
    ];

    expect(
      filterEarthquakes(
        events,
        { ...DEFAULT_EARTHQUAKE_FILTERS, timeWindowHours: 1 },
        now,
      ).map((event) => event.id),
    ).toEqual(["now"]);
    expect(
      filterEarthquakes(
        events,
        { ...DEFAULT_EARTHQUAKE_FILTERS, timeWindowHours: 6 },
        now,
      ).map((event) => event.id),
    ).toEqual(["now", "two-hours"]);
    expect(
      filterEarthquakes(
        events,
        { ...DEFAULT_EARTHQUAKE_FILTERS, timeWindowHours: 24 },
        now,
      ).map((event) => event.id),
    ).toEqual(["now", "two-hours", "eight-hours"]);
  });

  it("handles magnitude thresholds and missing magnitudes", () => {
    const now = Date.parse("2026-07-29T12:00:00.000Z");
    const base = createDemoSnapshot(new Date(now)).data[0];
    const events = [
      { ...base, id: "unknown", magnitude: null },
      { ...base, id: "below-three", magnitude: 2.999 },
      { ...base, id: "three", magnitude: 3 },
      { ...base, id: "below-four", magnitude: 3.999 },
      { ...base, id: "four", magnitude: 4 },
      { ...base, id: "below-five", magnitude: 4.999 },
      { ...base, id: "five", magnitude: 5 },
    ];

    expect(
      filterEarthquakes(events, DEFAULT_EARTHQUAKE_FILTERS, now),
    ).toHaveLength(7);
    expect(
      filterEarthquakes(
        events,
        { ...DEFAULT_EARTHQUAKE_FILTERS, minimumMagnitude: 3 },
        now,
      ).map((event) => event.id),
    ).toEqual(["three", "below-four", "four", "below-five", "five"]);
    expect(
      filterEarthquakes(
        events,
        { ...DEFAULT_EARTHQUAKE_FILTERS, minimumMagnitude: 4 },
        now,
      ).map((event) => event.id),
    ).toEqual(["four", "below-five", "five"]);
    expect(
      filterEarthquakes(
        events,
        { ...DEFAULT_EARTHQUAKE_FILTERS, minimumMagnitude: 5 },
        now,
      ).map((event) => event.id),
    ).toEqual(["five"]);
  });

  it("uses explicit depth boundaries and composes every filter", () => {
    const now = Date.parse("2026-07-29T12:00:00.000Z");
    const base = createDemoSnapshot(new Date(now)).data[0];
    const events = [
      { ...base, id: "shallow", depth_km: 69.999, magnitude: 5.1 },
      { ...base, id: "intermediate-start", depth_km: 70, magnitude: 5.1 },
      {
        ...base,
        id: "intermediate-end",
        depth_km: 299.999,
        magnitude: 4.9,
      },
      { ...base, id: "deep", depth_km: 300, magnitude: 5.4 },
      {
        ...base,
        id: "deep-old",
        depth_km: 450,
        magnitude: 5.8,
        occurred_at: new Date(now - 7 * 60 * 60_000).toISOString(),
      },
    ];

    expect(
      filterEarthquakes(
        events,
        { ...DEFAULT_EARTHQUAKE_FILTERS, depthBand: "shallow" },
        now,
      ).map((event) => event.id),
    ).toEqual(["shallow"]);
    expect(
      filterEarthquakes(
        events,
        { ...DEFAULT_EARTHQUAKE_FILTERS, depthBand: "intermediate" },
        now,
      ).map((event) => event.id),
    ).toEqual(["intermediate-start", "intermediate-end"]);
    expect(
      filterEarthquakes(
        events,
        { ...DEFAULT_EARTHQUAKE_FILTERS, depthBand: "deep" },
        now,
      ).map((event) => event.id),
    ).toEqual(["deep", "deep-old"]);
    expect(
      filterEarthquakes(
        events,
        {
          timeWindowHours: 6,
          minimumMagnitude: 5,
          depthBand: "deep",
        },
        now,
      ).map((event) => event.id),
    ).toEqual(["deep"]);
  });
});
