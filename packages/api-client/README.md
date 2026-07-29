# `@quakecurrent/api-client`

QuakeCurrent의 FastAPI 백엔드와 웹 앱 사이의 계약을 고정하는 TypeScript 클라이언트 패키지입니다.
추가 런타임 의존성 없이 표준 `fetch`와 `WebSocket` API만 사용합니다.

## 구성

- `src/openapi.generated.ts`: FastAPI의 `/openapi.json`에서 생성한 REST API 타입
- `openapi.json`: FastAPI 앱에서 결정론적으로 내보낸 REST 계약 스냅샷
- `src/client.ts`: 생성 타입을 사용하는 경량 `fetch` 클라이언트
- `src/ws-schema.ts`: OpenAPI가 표현하지 못하는 WebSocket 프레임 계약
- `src/ws.ts`: 재연결, 지수 백오프, `seq` 누락 복구를 처리하는 실시간 이벤트 클라이언트

REST 응답 모델이나 경로가 바뀌면 FastAPI를 실행한 상태에서 OpenAPI 타입을 다시 생성하고
TypeScript 빌드와 테스트를 통과시켜야 합니다. WebSocket 프레임은 OpenAPI에 포함되지 않으므로
`ws-schema.ts`를 서버의 Pydantic 모델과 함께 변경해야 합니다.

저장소 루트에서 다음 명령으로 OpenAPI 스냅샷과 타입을 함께 갱신합니다. API
서버를 별도로 실행할 필요가 없습니다.

```bash
npm run generate:api-contract
npm run check:api-contract
```

`openapi.generated.ts`는 직접 수정하지 않습니다. CI는 API 작업에서
`FastAPI → openapi.json`, 웹 작업에서 `openapi.json → TypeScript`를 각각
비교하므로 어느 한쪽만 갱신해도 실패합니다.

## 스냅샷과 실시간 이벤트 연결

스냅샷의 `meta.sequence`를 WebSocket 시작 시퀀스로 넘기면 초기 REST 응답과 실시간 변경
사이의 중복과 누락을 줄일 수 있습니다.

```ts
import {
  QuakeCurrentClient,
  RealtimeEventsClient,
  createEventStreamCatchUp,
} from "@quakecurrent/api-client";

const api = new QuakeCurrentClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
});

const snapshot = await api.listEvents({
  bbox: [124, 33, 132, 39],
  limit: 200,
});

const stream = new RealtimeEventsClient({
  apiBaseUrl: api.baseUrl,
  afterSeq: snapshot.meta.sequence,
  catchUp: createEventStreamCatchUp((query) => api.listChanges(query)),
  onSignal(signal) {
    // 신호에는 전체 지진 객체가 아니라 이벤트 ID와 시퀀스가 들어 있습니다.
    // created·updated·deleted 신호를 작은 증분 REST 요청과 연결해 상태를 갱신합니다.
    console.log(signal);
  },
});

stream.start();
```

WebSocket 신호는 `{ seq, event_id, operation, updated_at }`만 전달합니다. 연결이 끊기면
마지막으로 처리한 `seq` 이후를 REST로 먼저 복구하고 같은 시퀀스를 사용해 다시 연결합니다.
`onSignal`이 성공한 뒤에만 시퀀스를 진행하므로 최소 한 번 전달(at-least-once)을 보장하며,
중복 프레임은 자동으로 무시합니다.

## 검증

```bash
npm --prefix packages/api-client test
```
