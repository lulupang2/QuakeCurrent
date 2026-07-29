import type {
  EarthquakeDetail,
  EarthquakeSnapshot,
  EarthquakeSummary,
} from "@quakecurrent/api-client";

export type EarthquakeEvent = Omit<EarthquakeSummary, "place"> & {
  place: string;
  felt: number | null;
  source_url: string;
};

export type EventsSnapshot = Omit<EarthquakeSnapshot, "data"> & {
  data: EarthquakeEvent[];
};

export type ConnectionState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "demo";

export type TimeWindowHours = 1 | 6 | 24;
export type MinimumMagnitude = 0 | 3 | 4 | 5;
export type DepthBand = "all" | "shallow" | "intermediate" | "deep";

export type EarthquakeFilters = {
  timeWindowHours: TimeWindowHours;
  minimumMagnitude: MinimumMagnitude;
  depthBand: DepthBand;
};

export const DEFAULT_EARTHQUAKE_FILTERS: EarthquakeFilters = {
  timeWindowHours: 24,
  minimumMagnitude: 0,
  depthBand: "all",
};

type SearchParamsReader = Pick<URLSearchParams, "getAll">;

export function parseEarthquakeFiltersFromSearchParams(
  searchParams: SearchParamsReader,
): EarthquakeFilters {
  const readSingleValue = (key: string) => {
    const values = searchParams.getAll(key);
    return values.length === 1 ? values[0] : null;
  };
  const hours = readSingleValue("hours");
  const minimumMagnitude = readSingleValue("minMag");
  const depth = readSingleValue("depth");

  return {
    timeWindowHours:
      hours === "1" || hours === "6" || hours === "24"
        ? (Number(hours) as TimeWindowHours)
        : DEFAULT_EARTHQUAKE_FILTERS.timeWindowHours,
    minimumMagnitude:
      minimumMagnitude === "3" ||
      minimumMagnitude === "4" ||
      minimumMagnitude === "5"
        ? (Number(minimumMagnitude) as MinimumMagnitude)
        : DEFAULT_EARTHQUAKE_FILTERS.minimumMagnitude,
    depthBand:
      depth === "shallow" ||
      depth === "intermediate" ||
      depth === "deep"
        ? depth
        : DEFAULT_EARTHQUAKE_FILTERS.depthBand,
  };
}

export function serializeEarthquakeFiltersToSearchParams(
  filters: EarthquakeFilters,
  currentSearchParams = new URLSearchParams(),
) {
  const searchParams = new URLSearchParams(currentSearchParams);

  if (
    filters.timeWindowHours ===
    DEFAULT_EARTHQUAKE_FILTERS.timeWindowHours
  ) {
    searchParams.delete("hours");
  } else {
    searchParams.set("hours", String(filters.timeWindowHours));
  }

  if (
    filters.minimumMagnitude ===
    DEFAULT_EARTHQUAKE_FILTERS.minimumMagnitude
  ) {
    searchParams.delete("minMag");
  } else {
    searchParams.set("minMag", String(filters.minimumMagnitude));
  }

  if (filters.depthBand === DEFAULT_EARTHQUAKE_FILTERS.depthBand) {
    searchParams.delete("depth");
  } else {
    searchParams.set("depth", filters.depthBand);
  }

  return searchParams;
}

type DemoSeed = Omit<EarthquakeEvent, "occurred_at" | "updated_at"> & {
  minutesAgo: number;
};

const DIRECTION_LABELS: Record<string, string> = {
  N: "북쪽",
  NNE: "북북동쪽",
  NE: "북동쪽",
  ENE: "동북동쪽",
  E: "동쪽",
  ESE: "동남동쪽",
  SE: "남동쪽",
  SSE: "남남동쪽",
  S: "남쪽",
  SSW: "남남서쪽",
  SW: "남서쪽",
  WSW: "서남서쪽",
  W: "서쪽",
  WNW: "서북서쪽",
  NW: "북서쪽",
  NNW: "북북서쪽",
};

const REGION_ALIASES: Record<string, string> = {
  "alaska": "알래스카",
  "aleutian islands": "알류샨 열도",
  "arkansas": "아칸소주",
  "b.c.": "바하칼리포르니아주",
  "ca": "캘리포니아주",
  "california": "캘리포니아주",
  "canada": "캐나다",
  "cayman islands": "케이맨 제도",
  "chile": "칠레",
  "china": "중국",
  "colombia": "콜롬비아",
  "costa rica": "코스타리카",
  "dominican republic": "도미니카공화국",
  "ecuador": "에콰도르",
  "fiji": "피지",
  "florida": "플로리다주",
  "greece": "그리스",
  "guatemala": "과테말라",
  "hawaii": "하와이",
  "iceland": "아이슬란드",
  "idaho": "아이다호주",
  "india": "인도",
  "indonesia": "인도네시아",
  "iran": "이란",
  "italy": "이탈리아",
  "japan": "일본",
  "japan earthquake": "일본 지진",
  "kermadec islands": "케르마데크 제도",
  "kuril islands": "쿠릴 열도",
  "mariana islands": "마리아나 제도",
  "mexico": "멕시코",
  "mid-atlantic ridge": "중부 대서양 해령",
  "montana": "몬태나주",
  "mx": "멕시코",
  "nevada": "네바다주",
  "new mexico": "뉴멕시코주",
  "new zealand": "뉴질랜드",
  "nicaragua": "니카라과",
  "ogasawara islands": "오가사와라 제도",
  "oklahoma": "오클라호마주",
  "oregon": "오리건주",
  "panama": "파나마",
  "papua new guinea": "파푸아뉴기니",
  "peru": "페루",
  "philippines": "필리핀",
  "puerto rico": "푸에르토리코",
  "russia": "러시아",
  "solomon islands": "솔로몬 제도",
  "south sandwich islands": "사우스샌드위치 제도",
  "taiwan": "대만",
  "tajikistan": "타지키스탄",
  "texas": "텍사스주",
  "tonga": "통가",
  "türkiye": "튀르키예",
  "utah": "유타주",
  "vanuatu": "바누아투",
  "virgin islands": "버진아일랜드",
  "washington": "워싱턴주",
};

const REGION_QUALIFIERS: Record<string, string> = {
  northern: "북부",
  southern: "남부",
  eastern: "동부",
  western: "서부",
  central: "중부",
};

const DEMO_SEEDS: DemoSeed[] = [
  {
    id: "demo-01",
    source: "usgs",
    external_id: "demo-01",
    title: "Kuril Islands",
    magnitude: 5.8,
    magnitude_type: "mww",
    place: "쿠릴 열도 동쪽 해역",
    minutesAgo: 8,
    depth_km: 42.1,
    longitude: 153.42,
    latitude: 46.78,
    felt: 19,
    tsunami: false,
    source_url: "https://earthquake.usgs.gov/",
  },
  {
    id: "demo-02",
    source: "usgs",
    external_id: "demo-02",
    title: "South of Fiji",
    magnitude: 5.2,
    magnitude_type: "mb",
    place: "피지 남쪽 해역",
    minutesAgo: 23,
    depth_km: 566.4,
    longitude: -178.61,
    latitude: -25.91,
    felt: null,
    tsunami: false,
    source_url: "https://earthquake.usgs.gov/",
  },
  {
    id: "demo-03",
    source: "usgs",
    external_id: "demo-03",
    title: "Northern Chile",
    magnitude: 4.9,
    magnitude_type: "mb",
    place: "칠레 이키케 남동쪽",
    minutesAgo: 41,
    depth_km: 104.8,
    longitude: -68.57,
    latitude: -20.61,
    felt: 8,
    tsunami: false,
    source_url: "https://earthquake.usgs.gov/",
  },
  {
    id: "demo-04",
    source: "usgs",
    external_id: "demo-04",
    title: "Alaska Peninsula",
    magnitude: 4.6,
    magnitude_type: "ml",
    place: "알래스카 반도 남쪽",
    minutesAgo: 64,
    depth_km: 31.2,
    longitude: -158.94,
    latitude: 55.42,
    felt: 3,
    tsunami: false,
    source_url: "https://earthquake.usgs.gov/",
  },
  {
    id: "demo-05",
    source: "usgs",
    external_id: "demo-05",
    title: "Java, Indonesia",
    magnitude: 4.5,
    magnitude_type: "mb",
    place: "인도네시아 자바 남쪽",
    minutesAgo: 83,
    depth_km: 61.7,
    longitude: 110.34,
    latitude: -8.73,
    felt: 46,
    tsunami: false,
    source_url: "https://earthquake.usgs.gov/",
  },
  {
    id: "demo-06",
    source: "usgs",
    external_id: "demo-06",
    title: "Mid-Atlantic Ridge",
    magnitude: 4.4,
    magnitude_type: "mb",
    place: "중부 대서양 해령",
    minutesAgo: 102,
    depth_km: 10,
    longitude: -32.19,
    latitude: 4.21,
    felt: null,
    tsunami: false,
    source_url: "https://earthquake.usgs.gov/",
  },
  {
    id: "demo-07",
    source: "usgs",
    external_id: "demo-07",
    title: "Central Türkiye",
    magnitude: 4.1,
    magnitude_type: "ml",
    place: "튀르키예 카흐라만마라슈 인근",
    minutesAgo: 127,
    depth_km: 8.6,
    longitude: 36.72,
    latitude: 37.54,
    felt: 112,
    tsunami: false,
    source_url: "https://earthquake.usgs.gov/",
  },
  {
    id: "demo-08",
    source: "usgs",
    external_id: "demo-08",
    title: "Kermadec Islands",
    magnitude: 4,
    magnitude_type: "mb",
    place: "케르마데크 제도",
    minutesAgo: 151,
    depth_km: 221.9,
    longitude: -177.87,
    latitude: -29.55,
    felt: null,
    tsunami: false,
    source_url: "https://earthquake.usgs.gov/",
  },
  {
    id: "demo-09",
    source: "usgs",
    external_id: "demo-09",
    title: "Nevada",
    magnitude: 3.7,
    magnitude_type: "ml",
    place: "미국 네바다주 토노파 북동쪽",
    minutesAgo: 184,
    depth_km: 6.3,
    longitude: -116.84,
    latitude: 38.21,
    felt: 27,
    tsunami: false,
    source_url: "https://earthquake.usgs.gov/",
  },
  {
    id: "demo-10",
    source: "usgs",
    external_id: "demo-10",
    title: "Ogasawara Islands",
    magnitude: 3.5,
    magnitude_type: "mb",
    place: "일본 오가사와라 제도",
    minutesAgo: 226,
    depth_km: 37.4,
    longitude: 142.18,
    latitude: 27.16,
    felt: null,
    tsunami: false,
    source_url: "https://earthquake.usgs.gov/",
  },
];

export function createDemoSnapshot(now = new Date()): EventsSnapshot {
  const events = DEMO_SEEDS.map(({ minutesAgo, ...seed }) => {
    const occurredAt = new Date(now.getTime() - minutesAgo * 60_000);
    return {
      ...seed,
      occurred_at: occurredAt.toISOString(),
      updated_at: new Date(occurredAt.getTime() + 90_000).toISOString(),
    };
  });

  return {
    data: events,
    meta: {
      count: events.length,
      sequence: 0,
      generated_at: now.toISOString(),
    },
  };
}

function localizeRegionName(value: string): string {
  const trimmed = value.trim();
  const directAlias = REGION_ALIASES[trimmed.toLocaleLowerCase("en-US")];
  if (directAlias) return directAlias;

  const relativeMatch = /^(north|south|east|west) of (.+)$/i.exec(trimmed);
  if (relativeMatch) {
    const direction = DIRECTION_LABELS[relativeMatch[1][0].toUpperCase()];
    return `${localizeRegionName(relativeMatch[2])} ${direction}`;
  }

  const coastMatch = /^(?:near|off) the coast of (.+)$/i.exec(trimmed);
  if (coastMatch) {
    return `${localizeRegionName(coastMatch[1])} 연안`;
  }

  const qualifierMatch =
    /^(northern|southern|eastern|western|central) (.+)$/i.exec(trimmed);
  if (qualifierMatch) {
    const qualifier =
      REGION_QUALIFIERS[qualifierMatch[1].toLocaleLowerCase("en-US")];
    return `${localizeRegionName(qualifierMatch[2])} ${qualifier}`;
  }

  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((part) => localizeRegionName(part))
      .join(", ");
  }

  return trimmed;
}

export function localizeUsgsPlace(place: string | null): string {
  if (!place?.trim()) return "위치 정보 없음";

  const trimmed = place.trim();
  const distanceMatch =
    /^(\d+(?:\.\d+)?)\s*km\s+([NSEW]{1,3})\s+of\s+(.+)$/i.exec(trimmed);

  if (!distanceMatch) return localizeRegionName(trimmed);

  const [, distance, directionCode, region] = distanceMatch;
  const direction =
    DIRECTION_LABELS[directionCode.toUpperCase()] ?? directionCode;
  return `${localizeRegionName(region)} ${direction} ${distance}km`;
}

export function normalizeEarthquake(
  event: EarthquakeSummary | EarthquakeDetail,
): EarthquakeEvent {
  const detail = event as Partial<EarthquakeDetail>;
  return {
    ...event,
    place: localizeUsgsPlace(event.place),
    felt: detail.felt ?? null,
    source_url:
      detail.source_url ??
      "https://earthquake.usgs.gov/earthquakes/map/",
  };
}

export function magnitudeColor(magnitude: number | null) {
  if (magnitude === null) return "#8892a0";
  if (magnitude >= 5) return "#ff4d3d";
  if (magnitude >= 4) return "#ff795c";
  if (magnitude >= 3) return "#ffae72";
  return "#ffd4a0";
}

export function magnitudeLabel(magnitude: number | null) {
  return magnitude === null ? "M —" : `M ${magnitude.toFixed(1)}`;
}

export function relativeTime(iso: string, now = Date.now()) {
  const diffMinutes = Math.max(
    0,
    Math.round((now - new Date(iso).getTime()) / 60_000),
  );

  if (diffMinutes < 1) return "방금";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  return `${Math.floor(hours / 24)}일 전`;
}

export function filterEarthquakes(
  events: EarthquakeEvent[],
  filters: EarthquakeFilters,
  now = Date.now(),
) {
  const cutoff =
    now - filters.timeWindowHours * 60 * 60 * 1_000;

  return events.filter((event) => {
    const occurredAt = Date.parse(event.occurred_at);
    if (
      !Number.isFinite(occurredAt) ||
      occurredAt < cutoff ||
      occurredAt > now
    ) {
      return false;
    }

    if (
      filters.minimumMagnitude > 0 &&
      (event.magnitude === null ||
        event.magnitude < filters.minimumMagnitude)
    ) {
      return false;
    }

    if (filters.depthBand === "shallow") return event.depth_km < 70;
    if (filters.depthBand === "intermediate") {
      return event.depth_km >= 70 && event.depth_km < 300;
    }
    if (filters.depthBand === "deep") return event.depth_km >= 300;

    return true;
  });
}

export function sortByMostRecent(events: EarthquakeEvent[]) {
  return [...events].sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );
}

export function buildApiUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function buildWebSocketUrl(baseUrl: string, sequence: number) {
  const url = new URL(buildApiUrl(baseUrl, "/v1/ws/events"));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("after_seq", String(sequence));
  return url.toString();
}
