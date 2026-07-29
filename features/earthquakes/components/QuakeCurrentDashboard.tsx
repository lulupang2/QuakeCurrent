"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  ArrowUpRight,
  CircleDot,
  Clock3,
  Database,
  Globe2,
  ListFilter,
  Map as MapIcon,
  Radio,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Waves,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEarthquakes } from "../hooks/useEarthquakes";
import {
  DEFAULT_EARTHQUAKE_FILTERS,
  filterEarthquakes,
  magnitudeColor,
  magnitudeLabel,
  parseEarthquakeFiltersFromSearchParams,
  relativeTime,
  serializeEarthquakeFiltersToSearchParams,
  type ConnectionState,
  type DepthBand,
  type EarthquakeEvent,
  type EarthquakeFilters,
  type MinimumMagnitude,
  type TimeWindowHours,
} from "../model/earthquakes";

const EarthquakeGlobe = dynamic(() => import("./EarthquakeGlobe"), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      <span />
      지구본을 준비하고 있습니다
    </div>
  ),
});

const STATUS_COPY: Record<
  ConnectionState,
  { label: string; description: string }
> = {
  connecting: {
    label: "CONNECTING",
    description: "초기 스냅샷을 요청하고 있습니다",
  },
  live: {
    label: "LIVE",
    description: "변경 신호를 실시간으로 수신하고 있습니다",
  },
  reconnecting: {
    label: "RECONNECTING",
    description: "마지막 시퀀스부터 다시 연결하고 있습니다",
  },
  demo: {
    label: "DEMO SNAPSHOT",
    description: "API 연결 전 검증 데이터를 표시합니다",
  },
};

const TIME_WINDOW_OPTIONS: ReadonlyArray<{
  value: TimeWindowHours;
  label: string;
}> = [
  { value: 1, label: "1시간" },
  { value: 6, label: "6시간" },
  { value: 24, label: "24시간" },
];

const MAGNITUDE_OPTIONS: ReadonlyArray<{
  value: MinimumMagnitude;
  label: string;
}> = [
  { value: 0, label: "전체" },
  { value: 3, label: "M3+" },
  { value: 4, label: "M4+" },
  { value: 5, label: "M5+" },
];

const DEPTH_OPTIONS: ReadonlyArray<{
  value: DepthBand;
  label: string;
  accessibleLabel: string;
}> = [
  { value: "all", label: "전체", accessibleLabel: "모든 깊이" },
  { value: "shallow", label: "얕음", accessibleLabel: "얕음, 70킬로미터 미만" },
  {
    value: "intermediate",
    label: "중간",
    accessibleLabel: "중간, 70킬로미터 이상 300킬로미터 미만",
  },
  { value: "deep", label: "깊음", accessibleLabel: "깊음, 300킬로미터 이상" },
];

function FilterControls({
  filters,
  onChange,
}: {
  filters: EarthquakeFilters;
  onChange: (filters: EarthquakeFilters) => void;
}) {
  return (
    <div className="filter-controls">
      <div className="filter-group" role="group" aria-label="시간 범위">
        <span className="filter-group__label">시간</span>
        <div className="filter-options">
          {TIME_WINDOW_OPTIONS.map((option) => (
            <button
              aria-pressed={filters.timeWindowHours === option.value}
              key={option.value}
              onClick={() =>
                onChange({
                  ...filters,
                  timeWindowHours: option.value,
                })
              }
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group" role="group" aria-label="최소 규모">
        <span className="filter-group__label">규모</span>
        <div className="filter-options">
          {MAGNITUDE_OPTIONS.map((option) => (
            <button
              aria-pressed={filters.minimumMagnitude === option.value}
              key={option.value}
              onClick={() =>
                onChange({
                  ...filters,
                  minimumMagnitude: option.value,
                })
              }
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group" role="group" aria-label="깊이 범위">
        <span className="filter-group__label">깊이</span>
        <div className="filter-options">
          {DEPTH_OPTIONS.map((option) => (
            <button
              aria-label={option.accessibleLabel}
              aria-pressed={filters.depthBand === option.value}
              key={option.value}
              onClick={() =>
                onChange({
                  ...filters,
                  depthBand: option.value,
                })
              }
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p className="filter-depth-note">
        깊이 기준 · 얕음 d&lt;70 · 중간 70≤d&lt;300 · 깊음 d≥300 km
      </p>
    </div>
  );
}

function formatTimestamp(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function formatCoordinate(
  value: number,
  axis: "latitude" | "longitude",
) {
  const direction =
    axis === "latitude"
      ? value >= 0
        ? "북위"
        : "남위"
      : value >= 0
        ? "동경"
        : "서경";
  return `${direction} ${Math.abs(value).toFixed(2)}°`;
}

function EventDetails({
  event,
  now,
  compact = false,
}: {
  event: EarthquakeEvent | null;
  now: number;
  compact?: boolean;
}) {
  if (!event) {
    return (
      <div className="empty-detail">
        <CircleDot size={18} />
        표시할 사건이 없습니다. 필터 또는 데이터 연결을 확인하세요.
      </div>
    );
  }

  return (
    <div className={compact ? "detail-content detail-content--compact" : "detail-content"}>
      <div className="detail-kicker">
        <span
          className="magnitude-dot"
          style={{ backgroundColor: magnitudeColor(event.magnitude) }}
        />
        EARTHQUAKE DETAIL
      </div>
      <div className="detail-heading">
        <strong>{magnitudeLabel(event.magnitude)}</strong>
        <div>
          <h2>{event.place}</h2>
          <p>{relativeTime(event.occurred_at, now)}</p>
        </div>
      </div>

      <dl className="detail-grid">
        <div>
          <dt>DEPTH</dt>
          <dd>{event.depth_km.toFixed(1)} km</dd>
        </div>
        <div>
          <dt>FELT REPORTS</dt>
          <dd>{event.felt?.toLocaleString("ko-KR") ?? "—"}</dd>
        </div>
        <div>
          <dt>LATITUDE</dt>
          <dd>{formatCoordinate(event.latitude, "latitude")}</dd>
        </div>
        <div>
          <dt>LONGITUDE</dt>
          <dd>{formatCoordinate(event.longitude, "longitude")}</dd>
        </div>
      </dl>

      <div className="detail-flags">
        <span className={event.tsunami ? "flag flag--alert" : "flag"}>
          <Waves size={13} />
          TSUNAMI {event.tsunami ? "FLAGGED" : "NOT FLAGGED"}
        </span>
        <span className="flag">USGS · {event.external_id}</span>
      </div>

      <a
        className="source-link"
        href={event.source_url}
        rel="noreferrer"
        target="_blank"
      >
        USGS 원본 사건 보기
        <ArrowUpRight size={15} />
      </a>
    </div>
  );
}

function LiveStatus({
  state,
  updatedAt,
}: {
  state: ConnectionState;
  updatedAt: string;
}) {
  const copy = STATUS_COPY[state];
  return (
    <div className={`live-status live-status--${state}`} aria-live="polite">
      <span className="live-pulse" />
      <div>
        <strong>{copy.label}</strong>
        <span>{copy.description}</span>
      </div>
      <time dateTime={updatedAt}>{formatTimestamp(updatedAt)} KST</time>
    </div>
  );
}

export default function QuakeCurrentDashboard({
  initialFilters = DEFAULT_EARTHQUAKE_FILTERS,
}: {
  initialFilters?: EarthquakeFilters;
}) {
  const {
    events,
    connectionState,
    generatedAt,
    lastSequence,
    errorMessage,
    apiBaseUrl,
    reconnect,
    loadDetails,
  } = useEarthquakes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projection, setProjection] = useState<"globe" | "mercator">("globe");
  const [filters, setFilters] = useState<EarthquakeFilters>(
    initialFilters,
  );
  const [mobileSheet, setMobileSheet] = useState<
    "detail" | "filters" | null
  >(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(
      () => setNow(Date.now()),
      60_000,
    );
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 960px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setMobileSheet(null);
    };

    mobileViewport.addEventListener("change", handleViewportChange);
    return () =>
      mobileViewport.removeEventListener("change", handleViewportChange);
  }, []);

  useEffect(() => {
    const searchParams = serializeEarthquakeFiltersToSearchParams(
      filters,
      new URLSearchParams(window.location.search),
    );
    const query = searchParams.toString();
    const nextUrl = `${window.location.pathname}${
      query ? `?${query}` : ""
    }${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(
        window.history.state,
        "",
        nextUrl,
      );
    }
  }, [filters]);

  const filteredEvents = useMemo(
    () => filterEarthquakes(events, filters, now),
    [events, filters, now],
  );

  const effectiveSelectedId =
    selectedId &&
    filteredEvents.some((event) => event.id === selectedId)
      ? selectedId
      : (filteredEvents[0]?.id ?? null);

  useEffect(() => {
    if (effectiveSelectedId) void loadDetails(effectiveSelectedId);
  }, [effectiveSelectedId, loadDetails]);

  const selectedEvent =
    filteredEvents.find((event) => event.id === effectiveSelectedId) ?? null;

  const metrics = useMemo(() => {
    const magnitudes = filteredEvents
      .map((event) => event.magnitude)
      .filter((magnitude): magnitude is number => magnitude !== null);

    return {
      strongest: magnitudes.length ? Math.max(...magnitudes) : null,
      recent: filteredEvents.filter(
        (event) =>
          now - new Date(event.occurred_at).getTime() <= 60 * 60_000,
      ).length,
      shallow: filteredEvents.filter((event) => event.depth_km < 70).length,
    };
  }, [filteredEvents, now]);

  const filtersAreDefault =
    filters.timeWindowHours ===
      DEFAULT_EARTHQUAKE_FILTERS.timeWindowHours &&
    filters.minimumMagnitude ===
      DEFAULT_EARTHQUAKE_FILTERS.minimumMagnitude &&
    filters.depthBand === DEFAULT_EARTHQUAKE_FILTERS.depthBand;

  const activeFilterCount =
    Number(
      filters.timeWindowHours !==
        DEFAULT_EARTHQUAKE_FILTERS.timeWindowHours,
    ) +
    Number(
      filters.minimumMagnitude !==
        DEFAULT_EARTHQUAKE_FILTERS.minimumMagnitude,
    ) +
    Number(filters.depthBand !== DEFAULT_EARTHQUAKE_FILTERS.depthBand);

  const handleFiltersChange = useCallback(
    (nextFilters: EarthquakeFilters) => {
      const nextEvents = filterEarthquakes(events, nextFilters, now);
      setFilters(nextFilters);
      setSelectedId(
        effectiveSelectedId &&
          nextEvents.some((event) => event.id === effectiveSelectedId)
          ? effectiveSelectedId
          : (nextEvents[0]?.id ?? null),
      );
    },
    [effectiveSelectedId, events, now],
  );

  useEffect(() => {
    const handlePopState = () => {
      handleFiltersChange(
        parseEarthquakeFiltersFromSearchParams(
          new URLSearchParams(window.location.search),
        ),
      );
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [handleFiltersChange]);

  const resetFilters = () => {
    handleFiltersChange(DEFAULT_EARTHQUAKE_FILTERS);
  };

  const handleSelect = (event: EarthquakeEvent, openMobile = false) => {
    setSelectedId(event.id);
    if (openMobile) setMobileSheet("detail");
  };

  return (
    <main
      className="quakecurrent-app"
      data-filter-depth={filters.depthBand}
      data-filter-hours={filters.timeWindowHours}
      data-filter-min-magnitude={filters.minimumMagnitude}
    >
      <header className="site-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <Link href="/" className="brand-name">
              QUAKECURRENT
            </Link>
            <p>SEISMIC SIGNAL / FULL-STACK PROTOTYPE</p>
          </div>
        </div>

        <nav className="workflow-nav" aria-label="프로젝트 워크플로우">
          <span className="workflow-nav__active">01 PROTOTYPE</span>
          <span>02 PLAN</span>
          <span>03 AUTOPILOT</span>
          <Link href="/build-log">04 REVIEW</Link>
        </nav>

        <Link
          aria-label="프로젝트 소개 보기"
          className="build-log-link"
          href="/project"
        >
          PROJECT
          <ArrowUpRight size={14} />
        </Link>
      </header>

      <section className="pulse-board">
        <aside className="event-rail" aria-label="최근 지진 목록">
          <div className="rail-heading">
            <div>
              <span className="eyebrow">
                <Radio size={13} />
                PAST {filters.timeWindowHours}{" "}
                {filters.timeWindowHours === 1 ? "HOUR" : "HOURS"}
              </span>
              <h1>지구가 남긴<br />최근의 신호</h1>
            </div>
            <span className="event-count">{filteredEvents.length}</span>
          </div>

          <div className="metric-strip">
            <div>
              <span>STRONGEST</span>
              <strong>
                {metrics.strongest === null
                  ? "—"
                  : `M ${metrics.strongest.toFixed(1)}`}
              </strong>
            </div>
            <div>
              <span>LAST HOUR</span>
              <strong>{metrics.recent}</strong>
            </div>
            <div>
              <span>SHALLOW</span>
              <strong>{metrics.shallow}</strong>
            </div>
          </div>

          <section className="filter-panel" aria-label="지진 필터">
            <div className="filter-panel__head">
              <span>
                <SlidersHorizontal size={13} />
                FILTER SIGNALS
              </span>
              <button
                disabled={filtersAreDefault}
                onClick={resetFilters}
                type="button"
              >
                <RotateCcw size={12} />
                RESET
              </button>
            </div>
            <FilterControls
              filters={filters}
              onChange={handleFiltersChange}
            />
            <p className="filter-result" aria-live="polite">
              <strong>{filteredEvents.length}</strong> / {events.length} SIGNALS
            </p>
          </section>

          <div className="event-list">
            {filteredEvents.length ? (
              filteredEvents.map((event) => {
                const active = effectiveSelectedId === event.id;
                return (
                  <button
                    aria-pressed={active}
                    className={`event-row${active ? " event-row--active" : ""}`}
                    data-event-id={event.id}
                    key={event.id}
                    onClick={() => handleSelect(event)}
                    type="button"
                  >
                    <span
                      className="magnitude-badge"
                      style={{
                        borderColor: magnitudeColor(event.magnitude),
                      }}
                    >
                      {event.magnitude?.toFixed(1) ?? "—"}
                    </span>
                    <span className="event-row__copy">
                      <strong>{event.place}</strong>
                      <small>
                        {relativeTime(event.occurred_at, now)} ·{" "}
                        {event.depth_km.toFixed(0)} km
                      </small>
                    </span>
                    <span className="event-row__signal" aria-hidden="true" />
                  </button>
                );
              })
            ) : (
              <div className="event-list-empty">
                <CircleDot size={18} />
                <strong>
                  {events.length
                    ? "조건에 맞는 지진이 없습니다."
                    : "지진 데이터를 기다리고 있습니다."}
                </strong>
                <span>
                  {events.length
                    ? "필터 범위를 넓혀 다시 확인하세요."
                    : "API 연결 상태를 확인하고 잠시 기다려 주세요."}
                </span>
                {events.length ? (
                  <button onClick={resetFilters} type="button">
                    전체 조건으로 보기
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </aside>

        <section className="map-stage" aria-label="지진 위치 지도">
          <EarthquakeGlobe
            events={filteredEvents}
            onSelect={(event) => handleSelect(event)}
            projection={projection}
            selectedId={effectiveSelectedId}
            timeWindowHours={filters.timeWindowHours}
          />

          {!filteredEvents.length ? (
            <div className="map-empty-notice">
              <CircleDot size={20} />
              <div>
                <strong>
                  {events.length
                    ? "조건에 맞는 지진이 없습니다"
                    : "지진 데이터를 기다리고 있습니다"}
                </strong>
                <span>
                  {events.length
                    ? "시간·규모·깊이 조건을 조정해 보세요."
                    : "데이터 연결이 완료되면 지도에 표시됩니다."}
                </span>
              </div>
              {events.length ? (
                <button onClick={resetFilters} type="button">
                  필터 초기화
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="map-toolbar" aria-label="지도 투영 방식">
            <MapIcon size={15} aria-hidden="true" />
            <button
              aria-pressed={projection === "globe"}
              className={projection === "globe" ? "is-active" : ""}
              data-testid="projection-globe"
              onClick={() => setProjection("globe")}
              type="button"
            >
              3D
            </button>
            <button
              aria-pressed={projection === "mercator"}
              className={projection === "mercator" ? "is-active" : ""}
              data-testid="projection-flat"
              onClick={() => setProjection("mercator")}
              type="button"
            >
              2D
            </button>
          </div>

          <div className="map-index">
            <span>MAGNITUDE</span>
            <div className="legend-gradient" />
            <div className="legend-labels">
              <small>M 2</small>
              <small>M 4</small>
              <small>M 6+</small>
            </div>
          </div>
        </section>

        <aside className="detail-rail" aria-label="선택한 지진 상세">
          <div className="detail-rail__head">
            <span>SELECTED SIGNAL</span>
            <CircleDot size={16} />
          </div>
          <EventDetails event={selectedEvent} now={now} />

          <div className="pipeline-card">
            <div className="pipeline-card__title">
              <Database size={15} />
              INGEST PIPELINE
            </div>
            <div className="pipeline-steps" aria-label="데이터 파이프라인">
              <span className="is-complete">USGS</span>
              <i />
              <span className="is-complete">POSTGIS</span>
              <i />
              <span
                className={
                  connectionState === "live" ? "is-complete" : "is-waiting"
                }
              >
                WS
              </span>
            </div>
            <dl>
              <div>
                <dt>SEQUENCE</dt>
                <dd>{lastSequence || "DEMO"}</dd>
              </div>
              <div>
                <dt>POLLING</dt>
                <dd>60 SEC</dd>
              </div>
            </dl>
          </div>

          <p className="prototype-note">
            실시간 재난 경보가 아닌 개발 프로토타입입니다. 수집 시각과 원본
            출처를 함께 확인하세요.
          </p>
        </aside>
      </section>

      <footer className="signal-footer">
        <LiveStatus state={connectionState} updatedAt={generatedAt} />

        <div className="footer-telemetry">
          <span>
            <Activity size={14} />
            {filteredEvents.length} / {events.length} SIGNALS
          </span>
          <span>
            <Clock3 size={14} />
            60s POLL
          </span>
          <span className="api-address" title={apiBaseUrl}>
            API {apiBaseUrl.replace(/^https?:\/\//, "")}
          </span>
          {errorMessage ? (
            <button onClick={reconnect} type="button">
              <RefreshCw size={13} />
              API 다시 연결
            </button>
          ) : null}
        </div>
      </footer>

      <div className="mobile-summary">
        <button
          className="mobile-feed-button"
          disabled={!selectedEvent}
          onClick={() => selectedEvent && setMobileSheet("detail")}
          type="button"
        >
          <ListFilter size={16} />
          {selectedEvent ? (
            <>
              <strong>{magnitudeLabel(selectedEvent.magnitude)}</strong>
              <span>{selectedEvent.place}</span>
            </>
          ) : (
            <span>
              {events.length
                ? "조건에 맞는 사건 없음"
                : "데이터를 기다리는 중"}
            </span>
          )}
        </button>
        <button
          aria-label={`지진 필터${
            activeFilterCount ? `, ${activeFilterCount}개 적용 중` : ""
          }`}
          className={`mobile-filter-button${
            activeFilterCount ? " is-active" : ""
          }`}
          onClick={() => setMobileSheet("filters")}
          type="button"
        >
          <SlidersHorizontal size={17} />
          {activeFilterCount ? <span>{activeFilterCount}</span> : null}
        </button>
        <div className="mobile-projection">
          <button
            aria-label="3D 지구본"
            aria-pressed={projection === "globe"}
            onClick={() => setProjection("globe")}
            type="button"
          >
            <Globe2 size={16} />
          </button>
          <button
            aria-label="2D 지도"
            aria-pressed={projection === "mercator"}
            onClick={() => setProjection("mercator")}
            type="button"
          >
            <MapIcon size={16} />
          </button>
        </div>
      </div>

      <Dialog.Root
        onOpenChange={(open) => {
          if (!open) setMobileSheet(null);
        }}
        open={mobileSheet !== null}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="mobile-dialog-overlay" />
          <Dialog.Content
            className={`mobile-dialog${
              mobileSheet === "filters" ? " mobile-filter-dialog" : ""
            }`}
            key={mobileSheet}
          >
            <div className="mobile-dialog__handle" aria-hidden="true" />
            <Dialog.Close className="mobile-dialog__close" aria-label="닫기">
              <X size={18} />
            </Dialog.Close>
            {mobileSheet === "filters" ? (
              <>
                <Dialog.Title className="mobile-filter-dialog__title">
                  지진 필터
                </Dialog.Title>
                <Dialog.Description className="mobile-filter-dialog__copy">
                  목록과 지도에 표시할 시간·규모·깊이 범위를 선택하세요.
                </Dialog.Description>
                <FilterControls
                  filters={filters}
                  onChange={handleFiltersChange}
                />

                <div className="mobile-filter-metrics" aria-live="polite">
                  <div>
                    <span>RESULT</span>
                    <strong>{filteredEvents.length}</strong>
                  </div>
                  <div>
                    <span>STRONGEST</span>
                    <strong>
                      {metrics.strongest === null
                        ? "—"
                        : `M ${metrics.strongest.toFixed(1)}`}
                    </strong>
                  </div>
                  <div>
                    <span>SHALLOW</span>
                    <strong>{metrics.shallow}</strong>
                  </div>
                </div>

                <div
                  className="mobile-filter-results"
                  aria-label="필터된 지진 목록"
                >
                  {filteredEvents.length ? (
                    filteredEvents.map((event) => (
                      <button
                        aria-pressed={effectiveSelectedId === event.id}
                        key={event.id}
                        onClick={() => handleSelect(event, true)}
                        type="button"
                      >
                        <span
                          style={{
                            borderColor: magnitudeColor(event.magnitude),
                          }}
                        >
                          {event.magnitude?.toFixed(1) ?? "—"}
                        </span>
                        <strong>{event.place}</strong>
                        <small>
                          {relativeTime(event.occurred_at, now)} ·{" "}
                          {event.depth_km.toFixed(0)} km
                        </small>
                      </button>
                    ))
                  ) : (
                    <p>조건에 맞는 지진이 없습니다.</p>
                  )}
                </div>

                <div className="mobile-filter-dialog__actions">
                  <button
                    disabled={filtersAreDefault}
                    onClick={resetFilters}
                    type="button"
                  >
                    <RotateCcw size={14} />
                    초기화
                  </button>
                  <Dialog.Close asChild>
                    <button type="button">
                      {filteredEvents.length}개 결과 보기
                    </button>
                  </Dialog.Close>
                </div>
              </>
            ) : (
              <>
                <Dialog.Title className="sr-only">
                  선택한 지진 상세
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  선택한 지진의 규모, 깊이, 위치와 원본 출처입니다.
                </Dialog.Description>
                <EventDetails compact event={selectedEvent} now={now} />
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
