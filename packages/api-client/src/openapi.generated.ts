/**
 * FastAPI OpenAPI 문서에서 자동 생성했습니다.
 *
 * 직접 수정하지 말고 `npm run generate:api-contract`를 실행하세요.
 * WebSocket 프레임은 OpenAPI 범위 밖이므로 `ws-schema.ts`에서 관리합니다.
 */

export interface paths {
    "/healthz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["healthz"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/readyz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Readiness */
        get: operations["readyz"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Events Snapshot */
        get: operations["list_events"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/events/{event_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Event Detail */
        get: operations["get_event"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/events/changes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Event Changes */
        get: operations["list_event_changes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** ApiErrorResponse */
        ApiErrorResponse: {
            /** Detail */
            detail: string;
        };
        /** ChangeListMeta */
        ChangeListMeta: {
            /** After Seq */
            after_seq: number;
            /** Has More */
            has_more: boolean;
            /** Next Seq */
            next_seq: number;
        };
        /** ChangeListResponse */
        ChangeListResponse: {
            /** Data */
            data: components["schemas"]["ChangeSignal"][];
            meta: components["schemas"]["ChangeListMeta"];
        };
        /** ChangeSignal */
        ChangeSignal: {
            /**
             * Event Id
             * Format: uuid
             */
            event_id: string;
            /**
             * Operation
             * @enum {string}
             */
            operation: "created" | "updated" | "deleted";
            /** Seq */
            seq: number;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** EarthquakeDetail */
        EarthquakeDetail: {
            /** Alert */
            alert: string | null;
            /** Depth Km */
            depth_km: number;
            /** External Id */
            external_id: string;
            /** Felt */
            felt: number | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Latitude */
            latitude: number;
            /** Longitude */
            longitude: number;
            /** Magnitude */
            magnitude: number | null;
            /** Magnitude Type */
            magnitude_type: string | null;
            /**
             * Occurred At
             * Format: date-time
             */
            occurred_at: string;
            /** Place */
            place: string | null;
            /** Significance */
            significance: number | null;
            /** Source */
            source: string;
            /**
             * Source Updated At
             * Format: date-time
             */
            source_updated_at: string;
            /** Source Url */
            source_url: string | null;
            /** Status */
            status: string | null;
            /** Title */
            title: string;
            /** Tsunami */
            tsunami: boolean;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** EarthquakeSummary */
        EarthquakeSummary: {
            /** Depth Km */
            depth_km: number;
            /** External Id */
            external_id: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Latitude */
            latitude: number;
            /** Longitude */
            longitude: number;
            /** Magnitude */
            magnitude: number | null;
            /** Magnitude Type */
            magnitude_type: string | null;
            /**
             * Occurred At
             * Format: date-time
             */
            occurred_at: string;
            /** Place */
            place: string | null;
            /** Source */
            source: string;
            /** Title */
            title: string;
            /** Tsunami */
            tsunami: boolean;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** EventListMeta */
        EventListMeta: {
            /** Count */
            count: number;
            /**
             * Generated At
             * Format: date-time
             */
            generated_at: string;
            /** Sequence */
            sequence: number;
        };
        /** EventListResponse */
        EventListResponse: {
            /** Data */
            data: components["schemas"]["EarthquakeSummary"][];
            meta: components["schemas"]["EventListMeta"];
        };
        /** HealthResponse */
        HealthResponse: {
            /** Service */
            service: string;
            /**
             * Status
             * @enum {string}
             */
            status: "ok" | "not_ready";
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** ValidationError */
        ValidationError: {
            /** Context */
            ctx?: Record<string, never>;
            /** Input */
            input?: unknown;
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    healthz: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    readyz: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    list_events: {
        parameters: {
            query?: {
                /** @description west,south,east,north; west > east crosses the antimeridian */
                bbox?: string | null;
                limit?: number;
                updated_since?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventListResponse"];
                };
            };
            /** @description Snapshot not modified */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_event: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EarthquakeDetail"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_event_changes: {
        parameters: {
            query?: {
                after_seq?: number;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChangeListResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
