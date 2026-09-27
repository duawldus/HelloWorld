# 프론트엔드 요청서 (백엔드 → 프론트엔드)

백엔드가 바뀌면서 프론트에서 수정이 필요한 부분을 정리했습니다.
`frontend/BACKEND_REQUESTS.md`(프론트 → 백엔드)의 짝이 되는 문서입니다.

- 기준 브랜치: `backend` (PR [#1](https://github.com/duawldus/HelloWorld/pull/1))
- 최종 수정: 2026-09-27

---

## 1. 로그인 제거 → `X-Device-Id` 헤더로 변경 ⚠️ 필수

### 무엇이 바뀌었나요?
기획상 로그인 화면이 없어서 백엔드에서 **로그인(토큰) 방식을 제거**했습니다.
지금 프론트의 서버 모드는 첫 요청에서 `POST /auth/guest`를 호출하는데, 이 API가 없어져서 **서버 모드 연결이 실패합니다.**

| | 이전 | 현재 |
| --- | --- | --- |
| 첫 요청 | `POST /auth/guest` → `access_token` 발급 | 없음 (삭제) |
| 모든 요청 | `Authorization: Bearer <토큰>` | **`X-Device-Id: <기기 ID>`** |
| 토큰 만료 | 401 → 재로그인 후 재시도 | 없음 |

### 백엔드 동작
- 모든 요청에 `X-Device-Id` 헤더(8~128자)를 붙여 주세요.
- 처음 보는 기기 ID면 서버가 사용자를 **자동으로 생성**합니다. 이후에는 같은 사용자로 인식합니다.
- 헤더가 없거나 길이가 맞지 않으면 `401`, `code: "UNAUTHORIZED"`를 반환합니다.
- 온보딩 여부는 지금처럼 `GET /users/me`의 `onboarded`로 확인하시면 됩니다.

### 수정 방법 (`frontend/src/data/server/api.js`)
이미 `getDeviceId()`로 기기 ID를 만들어 저장하고 계셔서, 그 값을 헤더로 보내기만 하면 됩니다.

**① `request` — 토큰 발급과 401 재시도를 빼 주세요**
```js
export async function request(path, { method = 'GET', query, body, form } = {}) {
  return parse(await send(path, { method, query, body, form, deviceId: await getDeviceId() }))
}
```

**② `send` — `Authorization` 대신 `X-Device-Id` 헤더를 붙여 주세요**
```js
async function send(path, { method, query, body, form, deviceId }) {
  // ... (search 만드는 부분은 그대로)
  const headers = { 'X-Device-Id': deviceId }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  // ... (fetch 부분은 그대로)
}
```

**③ 지워도 되는 것:** `getToken()`, `let token`, `KEYS.token`

**④ `clearToken()` 처리 (`server/index.js`의 `resetAllData()`에서 사용 중)**
토큰이 없어졌기 때문에 아래 둘 중 편하신 쪽으로 정해 주세요.
- **A.** 기기 ID를 지워서 다음 요청부터 **새 사용자로 시작** (데이터 초기화와 같은 효과)
  ```js
  export async function clearDeviceId() {
    await AsyncStorage.removeItem(KEYS.deviceId).catch(() => {})
  }
  ```
- **B.** 서버 데이터는 그대로 두고 싶으시면 `resetAllData()`에서 아무것도 하지 않도록 변경

### 참고
- `BACKEND_REQUESTS.md`의 예시(`Authorization: Bearer <token>`)도 `X-Device-Id: <기기 ID>`로 바꿔 주시면 됩니다.
- Swagger(`http://localhost:8000/docs`)에서는 오른쪽 위 **Authorize** 버튼에 `X-Device-Id` 값(예: `my-test-device-01`)을 넣고 테스트하실 수 있습니다.

---

## 2. 레시피 추천 API가 동작합니다 ✅

`GET /recipes/recommendations`가 이제 **501이 아니라 실제 결과**를 반환합니다.
프론트에서 이미 호출하고 계신 파라미터(`imminent_first`, `max_minutes`, `servings`, `limit`)는 그대로 사용하시면 됩니다.

### 추가된 요청 파라미터
| 이름 | 설명 |
| --- | --- |
| `cookware` | 조리도구 필터: `ONE_PAN`(원팬) · `MICROWAVE`(전자레인지) · `POT`(냄비) |
| `exclude_ids` | **"다른 레시피 추천받기"** — 이미 보여 드린 레시피 id. `exclude_ids=1&exclude_ids=5`처럼 여러 번 넘겨 주세요 |
| `allow_ai` | `false`면 AI 레시피 생성을 하지 않습니다 (기본 `true`) |

### 추가된 응답 필드
| 위치 | 이름 | 설명 |
| --- | --- | --- |
| 응답 | `ai_generated` | 이번 요청에서 **AI가 새 레시피를 만들었는지**. `true`면 "AI가 새 레시피를 만들었어요" 같은 안내에 사용하시면 됩니다 |
| 카드 | `is_ai_generated` | AI가 만든 레시피인지 (카드에 AI 표시가 필요하시면 사용) |

### 꼭 확인해 주세요
- **로딩 UI가 필요합니다.** 추천 결과가 3개보다 적으면 AI(Gemini)가 레시피를 새로 만들어서, 응답이 **수 초 이상** 걸릴 수 있습니다.
- **냉장고가 비어 있으면** `422`, `code: "EMPTY_FRIDGE"`, `message: "식재료를 1개 이상 등록해 주세요."`를 반환합니다. (기획서 예외 흐름)
- AI 호출이 실패하더라도(무료 한도 초과 등) 추천은 기존 레시피로 정상 응답합니다.

---

## 3. 레시피 상세에서 인분 조절이 됩니다 ✅

`GET /recipes/{id}?servings=2`처럼 호출하시면 재료 양을 해당 인분으로 환산해 드립니다.

- `servings`: 1~10, **생략하면 1인분**입니다. (지금 프론트 호출도 그대로 동작합니다)
- 응답 필드

| 이름 | 설명 |
| --- | --- |
| `servings` | 요청하신 인분 |
| `base_servings` | 레시피 원래 기준 인분 |
| `is_ai_generated` | AI가 만든 레시피인지 |
| `checklist[].amount` | **환산된 표시용 문자열** (예: `"2모"`, `"1과 1/2큰술"`, `"약간"`) — 화면에는 이 값을 그대로 보여 주시면 됩니다 |
| `checklist[].quantity` | 환산된 숫자 (`"약간"`처럼 수량이 없으면 `null`) |
| `checklist[].unit` | 단위 (`"모"`, `"큰술"` 등) |

---

## 4. 백엔드를 새로 받으신 뒤 해 주실 것

테이블 구조가 바뀌어서 **로컬 DB를 한 번 지우고** 서버를 다시 켜 주세요.
```bash
cd backend
rm -f bangguseok.db
pip install -r requirements-dev.txt   # LLM이 Claude → Gemini로 바뀌어 패키지가 달라졌습니다
uvicorn app.main:app --reload
```
- 레시피가 7개 → **28개**로 늘었습니다.
- 개발 중에는 `.env`의 `AI_MOCK=true`(기본값)로 두시면 AI를 호출하지 않고 가짜 결과가 나옵니다. (무료 한도 절약)

---

## 5. `BACKEND_REQUESTS.md` 처리 현황

| 요청 | 담당 | 상태 |
| --- | --- | --- |
| 1. 재료 소진 API (`POST /ingredients/{id}/consume`) | 염지연 | ⏳ 요청 전달 예정 |
| 2-1. 연속 기록(streak) 갱신 | 우시연 | ⏳ 예정 |
| 2-2. 뱃지 지급 | 우시연 | ⏳ 예정 |
| 2-3. `level_min_xp` 추가 | 우시연 | ⏳ 예정 |
| 2-4. 뱃지 이름 "냉장고 클리너" | 우시연 | ⏳ 예정 — 와이어프레임 원문은 "클린러"여서 그대로 넣었는데, 맞춤법상 "클리너"가 맞아 수정하겠습니다 |
| 2-5. 요리 완료 XP 문구 형식 | 우시연 | ⏳ 요리 완료 구현 시 `"{레시피 이름} 요리 완료"` 형식으로 맞추겠습니다 |

완료되면 이 표를 갱신하겠습니다. 문의 사항은 PR 댓글이나 이 문서에 남겨 주세요. 감사합니다! 🙇
