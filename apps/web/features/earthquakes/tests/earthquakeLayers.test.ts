import { describe, expect, it, vi } from "vitest";
import { createEarthquakeLayers } from "../components/EarthquakeGlobe";
import { createDemoSnapshot } from "../model/earthquakes";

describe("earthquake map layers", () => {
  it("keeps every earthquake marker facing the camera", () => {
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
});
