import { describe, expect, it, vi } from "vitest";
import {
  createEarthquakeLayers,
  filterVisibleEarthquakes,
} from "../components/EarthquakeGlobe";
import { createDemoSnapshot } from "../model/earthquakes";

describe("earthquake map layers", () => {
  it("keeps every visible earthquake marker facing the camera", () => {
    const [event] = createDemoSnapshot(
      new Date("2026-07-31T00:00:00.000Z"),
    ).data;

    const layers = createEarthquakeLayers([event], event.id, vi.fn());

    expect(layers.map((layer) => layer.id)).toEqual([
      "earthquake-selection-aura",
      "earthquake-halo",
      "earthquake-core",
    ]);
    expect(layers.every((layer) => layer.props.billboard === true)).toBe(true);
  });

  it("removes locations hidden behind the globe from every marker layer", () => {
    const events = createDemoSnapshot(
      new Date("2026-07-31T00:00:00.000Z"),
    ).data.slice(0, 3);
    const hiddenId = events[1].id;

    const visibleEvents = filterVisibleEarthquakes(
      events,
      (event) => event.id === hiddenId,
    );
    const layers = createEarthquakeLayers(
      visibleEvents,
      events[0].id,
      vi.fn(),
    );

    expect(visibleEvents.map((event) => event.id)).not.toContain(hiddenId);
    expect(
      layers.every((layer) =>
        (layer.props.data as typeof events).every(
          (event) => event.id !== hiddenId,
        ),
      ),
    ).toBe(true);
  });
});
