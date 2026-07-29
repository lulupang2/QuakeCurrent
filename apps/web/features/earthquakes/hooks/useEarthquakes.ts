"use client";

import {
  QuakeCurrentClient,
  RealtimeEventsClient,
  createEventStreamCatchUp,
  type EarthquakeDetail,
  type EventChangeSignal,
  type EventStreamState,
} from "@quakecurrent/api-client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDemoSnapshot,
  normalizeEarthquake,
  sortByMostRecent,
  type ConnectionState,
  type EarthquakeEvent,
} from "../model/earthquakes";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

type UseEarthquakesResult = {
  events: EarthquakeEvent[];
  connectionState: ConnectionState;
  generatedAt: string;
  lastSequence: number;
  errorMessage: string | null;
  apiBaseUrl: string;
  reconnect: () => void;
  loadDetails: (eventId: string) => Promise<void>;
};

function toConnectionState(
  state: EventStreamState,
  hasSnapshot: boolean,
): ConnectionState | null {
  if (state === "open") return "live";
  if (state === "reconnecting") return "reconnecting";
  if (state === "connecting") {
    return hasSnapshot ? "reconnecting" : "connecting";
  }
  return null;
}

export function useEarthquakes(): UseEarthquakesResult {
  const demoSnapshotRef = useRef<ReturnType<typeof createDemoSnapshot> | null>(
    null,
  );
  const clientRef = useRef(
    new QuakeCurrentClient({
      baseUrl: API_BASE_URL,
    }),
  );
  const streamRef = useRef<InstanceType<typeof RealtimeEventsClient> | null>(
    null,
  );
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectRef = useRef<() => void>(() => undefined);
  const detailsLoadedRef = useRef(new Set<string>());
  const sequenceRef = useRef(0);
  const liveSnapshotRef = useRef(false);

  const [events, setEvents] = useState<EarthquakeEvent[]>([]);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [generatedAt, setGeneratedAt] = useState(
    "1970-01-01T00:00:00.000Z",
  );
  const [lastSequence, setLastSequence] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applyEvent = useCallback((event: EarthquakeDetail) => {
    const normalized = normalizeEarthquake(event);
    setEvents((current) =>
      sortByMostRecent([
        normalized,
        ...current.filter((item) => item.id !== normalized.id),
      ]),
    );
    setGeneratedAt(new Date().toISOString());
  }, []);

  const loadDetails = useCallback(
    async (eventId: string) => {
      if (
        !liveSnapshotRef.current ||
        detailsLoadedRef.current.has(eventId)
      ) {
        return;
      }

      detailsLoadedRef.current.add(eventId);
      try {
        const event = await clientRef.current.getEvent(eventId);
        applyEvent(event);
      } catch {
        detailsLoadedRef.current.delete(eventId);
      }
    },
    [applyEvent],
  );

  useEffect(() => {
    let disposed = false;

    const scheduleBootstrap = () => {
      if (disposed || retryTimerRef.current) return;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        void bootstrap();
      }, 15_000);
    };

    const handleSignal = async (signal: EventChangeSignal) => {
      if (disposed || signal.seq <= sequenceRef.current) return;

      if (signal.operation === "deleted") {
        setEvents((current) =>
          current.filter((event) => event.id !== signal.event_id),
        );
      } else {
        detailsLoadedRef.current.delete(signal.event_id);
        const event = await clientRef.current.getEvent(signal.event_id);
        if (!disposed) {
          applyEvent(event);
          detailsLoadedRef.current.add(signal.event_id);
        }
      }

      sequenceRef.current = signal.seq;
      setLastSequence(signal.seq);
    };

    const createStream = (afterSeq: number) => {
      streamRef.current?.stop();
      const stream = new RealtimeEventsClient({
        apiBaseUrl: API_BASE_URL,
        afterSeq,
        catchUp: createEventStreamCatchUp((query) =>
          clientRef.current.listChanges(query),
        ),
        onSignal: handleSignal,
        onStateChange: (state) => {
          if (disposed) return;
          const next = toConnectionState(state, liveSnapshotRef.current);
          if (next) setConnectionState(next);
        },
        onError: () => {
          if (!disposed) {
            setErrorMessage(
              "실시간 연결이 중단되어 마지막 시퀀스부터 재연결합니다.",
            );
          }
        },
      });

      streamRef.current = stream;
      stream.start();
    };

    async function bootstrap() {
      if (disposed) return;
      setConnectionState(
        liveSnapshotRef.current ? "reconnecting" : "connecting",
      );

      try {
        const snapshot = await clientRef.current.listEvents({ limit: 120 });
        if (disposed) return;

        const normalized = snapshot.data.map(normalizeEarthquake);
        liveSnapshotRef.current = true;
        detailsLoadedRef.current.clear();
        sequenceRef.current = snapshot.meta.sequence;
        setEvents(sortByMostRecent(normalized));
        setGeneratedAt(snapshot.meta.generated_at);
        setLastSequence(snapshot.meta.sequence);
        setErrorMessage(null);
        createStream(snapshot.meta.sequence);
      } catch {
        if (disposed) return;

        liveSnapshotRef.current = false;
        streamRef.current?.stop();
        streamRef.current = null;
        sequenceRef.current = 0;
        setLastSequence(0);
        const demoSnapshot =
          demoSnapshotRef.current ?? createDemoSnapshot();
        demoSnapshotRef.current = demoSnapshot;
        setEvents(demoSnapshot.data);
        setGeneratedAt(demoSnapshot.meta.generated_at);
        setConnectionState("demo");
        setErrorMessage(
          "API가 꺼져 있어 검증용 스냅샷을 표시하고 있습니다.",
        );
        scheduleBootstrap();
      }
    }

    reconnectRef.current = () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      void bootstrap();
    };

    void bootstrap();

    return () => {
      disposed = true;
      streamRef.current?.stop();
      streamRef.current = null;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [applyEvent]);

  return {
    events,
    connectionState,
    generatedAt,
    lastSequence,
    errorMessage,
    apiBaseUrl: API_BASE_URL,
    reconnect: () => reconnectRef.current(),
    loadDetails,
  };
}
