/**
 * WebSocket messages are maintained beside, not inside, the generated OpenAPI
 * schema because OpenAPI does not describe WebSocket frames.
 */
export interface EventChangeSignal {
  seq: number;
  event_id: string;
  operation: "created" | "updated" | "deleted";
  updated_at: string;
}

export function isEventChangeSignal(value: unknown): value is EventChangeSignal {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const signal = value as Partial<EventChangeSignal>;
  return (
    Number.isSafeInteger(signal.seq) &&
    (signal.seq ?? -1) >= 0 &&
    typeof signal.event_id === "string" &&
    signal.event_id.length > 0 &&
    (signal.operation === "created" ||
      signal.operation === "updated" ||
      signal.operation === "deleted") &&
    typeof signal.updated_at === "string"
  );
}
