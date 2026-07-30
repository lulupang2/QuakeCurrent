"use client";

import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer } from "@deck.gl/layers";
import {
  AttributionControl,
  Map as MapLibreMap,
  NavigationControl,
  type IControl,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import {
  magnitudeColor,
  type EarthquakeEvent,
  type TimeWindowHours,
} from "../model/earthquakes";

type EarthquakeGlobeProps = {
  events: EarthquakeEvent[];
  selectedId: string | null;
  projection: "globe" | "mercator";
  timeWindowHours: TimeWindowHours;
  onSelect: (event: EarthquakeEvent) => void;
};

const MAP_STYLE_TIMEOUT_MS = 7_000;

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    "carto-light": {
      type: "raster" as const,
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    {
      id: "paper-ocean",
      type: "background" as const,
      paint: {
        "background-color": "#dce3e3",
      },
    },
    {
      id: "carto-light",
      type: "raster" as const,
      source: "carto-light",
      paint: {
        "raster-opacity": 0.96,
        "raster-saturation": -0.2,
        "raster-contrast": 0.12,
        "raster-fade-duration": 0,
      },
    },
  ],
};

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha,
  ] as [number, number, number, number];
}

function haloRadius(event: EarthquakeEvent) {
  return 48_000 + (event.magnitude ?? 1) * 19_000;
}

export function createEarthquakeLayers(
  events: EarthquakeEvent[],
  selectedId: string | null,
  onSelect: (event: EarthquakeEvent) => void,
) {
  const selectedEvents = selectedId
    ? events.filter((event) => event.id === selectedId)
    : [];

  return [
    new ScatterplotLayer<EarthquakeEvent>({
      id: "earthquake-selection-aura",
      data: selectedEvents,
      billboard: true,
      getPosition: (event) => [event.longitude, event.latitude],
      getRadius: haloRadius,
      radiusMinPixels: 10,
      radiusMaxPixels: 48,
      getFillColor: (event) =>
        hexToRgba(magnitudeColor(event.magnitude), 18),
      filled: true,
      stroked: false,
      pickable: false,
    }),
    new ScatterplotLayer<EarthquakeEvent>({
      id: "earthquake-halo",
      data: events,
      billboard: true,
      getPosition: (event) => [event.longitude, event.latitude],
      getRadius: haloRadius,
      radiusMinPixels: 10,
      radiusMaxPixels: 48,
      filled: false,
      stroked: true,
      getLineColor: (event) =>
        hexToRgba(
          magnitudeColor(event.magnitude),
          event.id === selectedId ? 230 : 112,
        ),
      getLineWidth: (event) => (event.id === selectedId ? 2 : 1),
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 1,
      lineWidthMaxPixels: 2,
      pickable: false,
      updateTriggers: {
        getLineColor: selectedId,
        getLineWidth: selectedId,
      },
    }),
    new ScatterplotLayer<EarthquakeEvent>({
      id: "earthquake-core",
      data: events,
      billboard: true,
      getPosition: (event) => [event.longitude, event.latitude],
      getRadius: (event) => 11_000 + (event.magnitude ?? 1) * 6_500,
      radiusMinPixels: 4,
      radiusMaxPixels: 15,
      getFillColor: (event) =>
        hexToRgba(magnitudeColor(event.magnitude), 255),
      getLineColor: [255, 255, 255, 235],
      stroked: true,
      lineWidthMinPixels: 1,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 90],
      onClick: ({ object }) => {
        if (object) onSelect(object);
      },
    }),
  ];
}

export default function EarthquakeGlobe({
  events,
  selectedId,
  projection,
  timeWindowHours,
  onSelect,
}: EarthquakeGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const selectedRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [measuredFps, setMeasuredFps] = useState<number | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [132, 21],
        zoom: 1.25,
        minZoom: 0.55,
        maxZoom: 7,
        pitch: 18,
        bearing: -8,
        attributionControl: false,
        fadeDuration: 0,
        refreshExpiredTiles: false,
        cooperativeGestures: false,
      });
    } catch {
      const errorTimeout = window.setTimeout(
        () =>
          setMapError("이 환경에서는 WebGL 지도를 표시할 수 없습니다."),
        0,
      );
      return () => window.clearTimeout(errorTimeout);
    }

    mapRef.current = map;
    map.addControl(
      new AttributionControl({
        compact: true,
      }),
      "bottom-left",
    );
    map.addControl(
      new NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      "bottom-right",
    );

    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: createEarthquakeLayers(events, selectedId, (event) =>
        onSelectRef.current(event),
      ),
    });
    overlayRef.current = overlay;
    map.addControl(overlay as unknown as IControl);

    let frameRequest: number | null = null;
    const sampleFrameRate = () => {
      let frames = 0;
      const startedAt = performance.now();
      const sample = (timestamp: number) => {
        frames += 1;
        const elapsed = timestamp - startedAt;
        if (elapsed >= 1_800) {
          setMeasuredFps(Math.round((frames * 1_000) / elapsed));
          frameRequest = null;
          return;
        }
        frameRequest = window.requestAnimationFrame(sample);
      };
      frameRequest = window.requestAnimationFrame(sample);
    };

    sampleFrameRate();

    let mapInitialized = false;
    let hasFatalMapError = false;
    let styleLoadTimeout: number | null = null;

    const finishMapInitialization = () => {
      if (mapInitialized || hasFatalMapError) return;
      mapInitialized = true;
      if (styleLoadTimeout !== null) {
        window.clearTimeout(styleLoadTimeout);
        styleLoadTimeout = null;
      }

      try {
        map.setProjection({ type: projection });
      } catch {
        setMapNotice("3D 투영을 적용하지 못해 기본 지도로 표시합니다.");
      }

      setMapError(null);
      setMapReady(true);
    };

    const handleMapError = (event: { error?: Error }) => {
      const message = event.error?.message?.toLowerCase() ?? "";
      if (message.includes("webgl") || message.includes("context")) {
        hasFatalMapError = true;
        if (styleLoadTimeout !== null) {
          window.clearTimeout(styleLoadTimeout);
          styleLoadTimeout = null;
        }
        setMapError("이 환경에서는 WebGL 지도를 표시할 수 없습니다.");
      }
    };

    map.on("style.load", finishMapInitialization);
    map.on("error", handleMapError);
    styleLoadTimeout = window.setTimeout(
      () => setMapError("베이스맵을 불러오지 못했습니다."),
      MAP_STYLE_TIMEOUT_MS,
    );
    if (map.isStyleLoaded()) finishMapInitialization();

    return () => {
      overlayRef.current = null;
      mapRef.current = null;
      if (styleLoadTimeout !== null) {
        window.clearTimeout(styleLoadTimeout);
      }
      if (frameRequest !== null) window.cancelAnimationFrame(frameRequest);
      map.remove();
    };
    // The map is intentionally created once. Layers are updated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    overlayRef.current?.setProps({
      layers: createEarthquakeLayers(events, selectedId, (event) =>
        onSelectRef.current(event),
      ),
    });
  }, [events, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyProjection = () => {
      map.setProjection({ type: projection });
      map.easeTo({
        pitch: projection === "globe" ? 18 : 0,
        duration: 700,
      });
    };

    if (map.isStyleLoaded()) applyProjection();
    else map.once("style.load", applyProjection);
  }, [projection]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = events.find((event) => event.id === selectedId);
    if (!map || !selected || selectedRef.current === selected.id) return;

    selectedRef.current = selected.id;
    map.flyTo({
      center: [selected.longitude, selected.latitude],
      zoom: Math.max(map.getZoom(), projection === "globe" ? 2.8 : 3.5),
      duration: 1_050,
      essential: false,
    });
  }, [events, projection, selectedId]);

  return (
    <div className="globe-shell" data-testid="earthquake-map">
      <div className="globe-canvas" ref={containerRef} />
      <div className="globe-vignette" aria-hidden="true" />
      {!mapReady && !mapError ? (
        <div className="map-loading" role="status">
          <span />
          베이스맵을 불러오고 있습니다
        </div>
      ) : null}
      <div className="map-caption">
        <span>
          USGS · PAST {timeWindowHours}{" "}
          {timeWindowHours === 1 ? "HOUR" : "HOURS"}
        </span>
        <span className="map-fps" data-testid="map-fps">
          PERF {measuredFps === null ? "…" : measuredFps} FPS
        </span>
        <span>크기는 규모, 색상은 강도를 나타냅니다</span>
      </div>
      {mapReady && mapNotice ? (
        <div className="map-notice" role="status">
          {mapNotice}
        </div>
      ) : null}
      {mapError ? (
        <div className="map-error" role="status">
          {mapError}
        </div>
      ) : null}
    </div>
  );
}
