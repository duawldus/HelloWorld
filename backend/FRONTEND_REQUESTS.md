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

## 3-1. 재료 소진 · 수량 차감 API가 생겼습니다 ✅ (염지연)

| API | 용도 |
| --- | --- |
| `POST /ingredients/{id}/consume` | "다 먹었어요" → 소진(`CONSUMED`). `BACKEND_REQUESTS.md` 1번 요청 그대로 |
| `POST /ingredients/deduct` | 수량 차감. 여러 재료를 **요청 한 번**으로 처리하고, 남은 양이 0이 되면 소진(`CONSUMED`) |

```
POST /api/v1/ingredients/deduct
{ "items": [{ "id": 3, "amount": 2 }, { "id": 5, "amount": 1 }] }

→ 200 { "items": [{ "id": 3, "name": "계란", "amount": 2, "left": 8, "status": "ACTIVE" }, ...] }
```

- XP 없음. 남은 양보다 많이 빼면 남은 양까지만 빼요.
- 하나라도 없는 재료·남의 재료면 `404`이고 **아무것도 바뀌지 않아요.**

### 프론트 연결 (`frontend/src/data/server/index.js`)
```js
export const CAN_CONSUME = true
export function consumeIngredient(id) {
  return request(`/ingredients/${id}/consume`, { method: 'POST' })
}

// 지금은 재료마다 PATCH/DELETE를 보내고, 0이 되면 DELETE(= 폐기로 기록)돼요 → 아래로 바꿔 주세요
export async function deductIngredients(usedList) {
  const { items } = await request('/ingredients/deduct', { method: 'POST', body: { items: usedList } })
  return items // [{ id, name, amount, left, status }] — 기존 모양에 status만 추가
}
```

---

## 4. 요리 완료 · 실행 취소 API ✅ (실행 취소는 재료 복구 기능 합치기 전까지 501)

프론트에서 이미 호출하고 계신 모양 그대로입니다.

**`POST /recipes/{id}/complete`**
- 본문 `{"ingredient_ids": [1, 2]}` — 소진할 내 재료 id. **생략하시면** 레시피 재료마다 유통기한이 가장 급한 내 재료를 자동으로 골라 소진합니다.
- 재료는 수량을 빼지 않고 **통째로 소진**됩니다.
- XP: 요리 완료 +10, **임박 재료(D-0~D-3)를 유통기한 안에 쓰면** 보너스 +10 (합계 +20)
- 응답
  ```json
  {
    "cook_log_id": 3,
    "consumed": [{"ingredient_id": 1, "name": "두부", "before_expiry": true, "imminent": true}],
    "xp": {"amount": 20, "reasons": ["두부계란찜 요리 완료", "유통기한 내 소진 보너스"], "level_up": false, "new_badges": []}
  }
  ```
  - `consumed[].imminent`가 새로 추가됐습니다 (토스트 "두부를 유통기한 내에 다 썼어요!"에 사용하시면 됩니다)
- 쓸 수 있는 재료가 없으면 `422`, `code: "NO_INGREDIENTS"`

**`POST /recipes/cook-logs/{cook_log_id}/undo`**
- 소진한 재료를 복구하고, 받았던 XP 기록을 **삭제**합니다 (최근 XP 목록·제때 소진 통계에서도 빠집니다).
- 응답: `{"cook_log_id": 3, "restored_ingredient_ids": [1, 2], "xp_revoked": 20}`
- 이미 취소한 요리면 `409`, `code: "ALREADY_UNDONE"`

> ⚠️ 재료 소진·복구는 `ingredients` 담당(염지연)의 함수를 사용합니다. 소진 함수는 합쳐졌고, **복구 함수가 합쳐지기 전까지 실행 취소만 501**을 반환합니다.
> (프론트는 501을 "아직 서버에 준비되지 않은 기능이에요"로 보여 주고 계셔서 따로 처리하실 필요는 없습니다)

---

## 4-1. 성과 · 뱃지 값이 채워졌습니다 ✅ (`BACKEND_REQUESTS.md` 2-1 ~ 2-4)

**연속 기록 (streak)** → `STREAK_READY = true`
- XP를 받는 활동(요리 완료 · 사진 등록 · 집안일 완료)을 한 날을 하루로 칩니다. 어제도 했으면 +1, 오늘 이미 했으면 그대로, 하루라도 빠지면 1부터 다시.
- 어제도 오늘도 활동이 없으면 `current_streak`는 **0**으로 내려갑니다 (끊긴 기록). `best_streak`는 그대로.
- 실행 취소로 XP를 돌려받아도 연속 기록은 되돌리지 않습니다.

**뱃지 지급** → `BADGES_READY = true`
- `progress >= threshold`가 되는 순간 지급되고, 그 요청의 응답 `xp.new_badges`에 뱃지 **이름**이 들어갑니다 (요리 완료 · 사진 등록 · 집안일 완료).
- 한 번 받은 뱃지는 실행 취소로 진행도가 내려가도 회수하지 않습니다.
- "냉장고 클린러" → **"냉장고 클리너"**. 서버를 다시 켜면 반영됩니다 (**DB를 지울 필요 없음**).

**`GET /gamification/stats` · `GET /home`의 `level`에 필드 2개 추가**
| 이름 | 설명 |
| --- | --- |
| `level_min_xp` | 현재 레벨 시작 누적 XP (예: Lv.3 → `200`). 진행 바 계산용 |
| `level_hint` | 홈 레벨 카드 문구. 예: `"임박 재료로 8번만 더 요리하면 달성!"` (임박 재료로 요리 1번 = +20 XP 기준, 만렙이면 `null`) |

```json
{ "level": 3, "xp": 240, "level_min_xp": 200, "next_level_xp": 390, "xp_to_next_level": 150,
  "level_hint": "임박 재료로 8번만 더 요리하면 달성!", "current_streak": 7, "best_streak": 12, ... }
```
- 와이어프레임 문구("재료 3개만 더 소진하면 달성!")와 다른 이유: XP는 재료 개수가 아니라 **요리 1번**마다 들어와서, 재료 개수로 말하면 숫자가 맞지 않아요.
  지금 홈 문구(`다음 레벨까지 XP N 남음 · …`)를 `level_hint`로 바꾸실지는 편하신 대로 해 주세요.

**절약 추정 식비 (`saved_money_estimate`)**
- 1회당 2,300원 고정 → **'유통기한 내 소진 보너스'를 받은 요리에서 임박 재료(D-0~D-3) 값의 합계**로 바뀌었습니다.
- 재료값은 요리 1번에 쓰는 양 기준 대략적인 가격입니다 (두부 1,500원, 돼지고기 5,000원 …, 목록에 없는 재료 2,300원). `backend/app/features/gamification/rules.py`의 `INGREDIENT_PRICES`.
- 목업(`mock/rules.js`의 `SAVED_MONEY_PER_SAVE`)과 값이 달라질 수 있어요.

---

## 4-2. 푸시 알림 발송이 동작합니다 ✅ (Android만)

서버가 **유통기한 알림**(매일 오전 9시)과 **생활 알림**(설정한 요일·시각, N일 전)을 보냅니다. 같은 날 같은 알림은 한 번만 갑니다.

> **이번에는 Android만 지원합니다.** (iOS는 유료 Apple 개발자 계정이 필요해서 제외)
> 서버는 Firebase 없이 Expo 푸시 서버로만 보내고, Expo가 Firebase(FCM)를 거쳐 폰에 전달합니다.
> 그래서 **앱 쪽에만** Firebase 설정이 필요합니다.

### 준비 (한 번만)
1. **EAS 프로젝트 연결** — 푸시 토큰 발급에 프로젝트 ID가 필요해요.
   ```bash
   npm i -g eas-cli
   eas login
   eas init            # app.json 에 extra.eas.projectId 가 생겨요
   eas build:configure # eas.json 생성
   ```
2. **Android 패키지 이름** — `app.json`의 `android`에 `"package": "com.bangguseok.app"`(예시)을 넣어 주세요. 한번 정하면 바꾸기 어려워요.
3. **Firebase 프로젝트** ([console.firebase.google.com](https://console.firebase.google.com))
   - 프로젝트 만들기 → Android 앱 추가 (위 패키지 이름 그대로)
   - `google-services.json` 받아서 `frontend/`에 두고, `app.json`의 `android`에 `"googleServicesFile": "./google-services.json"` 추가
4. **FCM 키를 Expo에 등록**
   - Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성** (JSON 파일)
   - `eas credentials` → Android → Google Service Account → **FCM V1** 키로 위 JSON 업로드
   - ⚠️ 이 JSON은 비밀키예요. **절대 커밋하지 마세요** (`.gitignore`에 추가)
5. **개발 빌드** — Android는 Expo Go로 푸시를 받을 수 없어요. 개발 빌드 APK를 폰에 설치해서 테스트해 주세요.
   ```bash
   npx expo install expo-dev-client
   eas build --profile development --platform android
   npx expo start --dev-client
   ```
   에뮬레이터 말고 **실제 폰**으로 테스트해 주세요.

### 코드는 이미 준비돼 있어요 → 스위치만 바꿔 주세요
`src/notifications`에 토큰 등록 · 채널 · 알림 탭 이동이 이미 다 있어서, 위 준비가 끝나면 `src/data/config.js`만 바꾸면 됩니다.
```js
export const DATA_MODE = 'server'
export const PUSH_SOURCE = 'server' // 앱 예약 알림은 지우고 서버 푸시만 받음 (두 번 오지 않게)
```

서버가 보내는 값은 앱 코드와 맞춰 두었습니다.

| 알림 | 예시 | `data.deeplink` → 화면 | `channelId` |
| --- | --- | --- | --- |
| 유통기한 | "두부 유통기한이 내일까지예요" / "냉장고에 두부 1모 있어요. 두부 계란부침은 어때요?" | `bangguseok://recipes` → `/recipe` | `expiry` |
| 생활 | "빨래하기" / "지금 빨래하기 시간이에요" | `bangguseok://reminders` → `/alert` | `reminders` |

- 딥링크는 `messages.js`의 `DEEPLINKS`, 채널은 `index.js`의 `CHANNELS`와 같은 값이에요. 한쪽을 바꾸면 백엔드 `notifications/jobs.py`도 같이 바꿔야 해요.
- 푸시를 못 받았어도 **`GET /notifications`** 에 이력이 남습니다 (기기 토큰이 없어도 기록됨).

### 확인 순서
1. 앱에서 받은 토큰(`ExponentPushToken[...]`)으로 [expo.dev/notifications](https://expo.dev/notifications) 에서 테스트 발송 → 폰에 뜨면 앱 설정 완료
2. 서버 `.env`에 `PUSH_ENABLED=true`, `SCHEDULER_ENABLED=true` → 생활 알림을 1~2분 뒤로 만들어서 오는지 확인
3. 폰이 서버에 접속하려면 같은 Wi-Fi에서 서버를 `uvicorn app.main:app --host 0.0.0.0` 으로 띄우고, 앱의 서버 주소를 PC의 IP(예: `http://192.168.0.10:8000`)로 맞춰 주세요.

### 참고
- 서버 `.env`의 `PUSH_ENABLED=false`(기본값)면 실제로 보내지 않고 서버 로그에만 찍힙니다.
- 앱을 지워서 Expo가 "등록되지 않은 기기"라고 알려 주면 서버가 그 토큰을 자동으로 지웁니다.

---

## 4-3. 생활 알림: 마지막 완료 시각 + 같은 회차 중복 완료 방지 ✅ (`BACKEND_REQUESTS.md` 1번)

**`ReminderRead`에 필드 2개 추가** (`GET /reminders`, `GET·PATCH /reminders/{id}`, 완료 응답의 `reminder`)
| 이름 | 설명 |
| --- | --- |
| `last_done_at` | 마지막 완료 시각 (`"2026-09-23T10:00:00"`, 한국 시간), 없으면 `null` |
| `done_this_cycle` | **이번 회차를 이미 완료했는지.** `true`면 완료 버튼 비활성화 |

**회차 기준** — '해야 하는 날' 당일(시각 무관)까지가 그 회차이고, 다음 날부터는 다음 회차입니다.
- 매일: 하루에 한 번
- 매주 화·금: 화요일에 완료 → 화요일 회차 / **수·목·금에 완료 → 금요일 회차** (수요일에 미리 했으면 금요일엔 이미 완료)
- 매달 25일, 3일 전 알림: 22일에 미리 납부해도 25일 회차 → 26일부터 다음 달 회차

**`POST /reminders/{id}/complete`를 같은 회차에 다시 보내면** 에러가 아니라 `200`으로, 아무것도 바꾸지 않고 XP 0을 돌려줍니다.
```json
{ "reminder": { "...": "...", "last_done_at": "2026-09-23T10:00:00", "done_this_cycle": true },
  "xp": { "amount": 0, "reasons": ["이미 완료한 집안일이에요"], "level_up": false, "new_badges": [] } }
```
- `xp.amount`가 0이면 XP 토스트를 띄우지 않거나 `reasons[0]`을 보여 주시면 됩니다.

### 프론트 연결 (`AlertScreen.js`)
지금 `isDoneToday`는 날짜만 비교해서, 매주·매달 알림은 '오늘 완료'가 아니어도 이미 완료한 회차일 수 있어요. 서버 모드에서는 `done_this_cycle`을 써 주세요.
```js
function isDoneToday(item) {
  if (typeof item.done_this_cycle === 'boolean') return item.done_this_cycle // 서버 모드
  return Boolean(item.last_done_at) && item.last_done_at.slice(0, 10) === todayString() // 가짜 모드
}
```
문구는 '오늘 완료' 대신 '완료' 등으로 바꾸셔도 됩니다.

---

## 5. 백엔드를 새로 받으신 뒤 해 주실 것

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

## 6. `BACKEND_REQUESTS.md` 처리 현황

| 요청 | 담당 | 상태 |
| --- | --- | --- |
| 1. 재료 소진 API (`POST /ingredients/{id}/consume`) | 염지연 | ✅ 완료 — 요청서 모양 그대로. 프론트는 `CAN_CONSUME = true` + `consumeIngredient` 연결 부탁드려요 |
| 2-1. 연속 기록(streak) 갱신 | 우시연 | ✅ 완료 — 위 4-1. `STREAK_READY = true` 부탁드려요 |
| 2-2. 뱃지 지급 | 우시연 | ✅ 완료 — 위 4-1. `BADGES_READY = true` 부탁드려요 |
| 2-3. `level_min_xp` 추가 | 우시연 | ✅ 완료 — 요청하신 모양 그대로 (+ `level_hint`) |
| 2-4. 뱃지 이름 "냉장고 클리너" | 우시연 | ✅ 완료 — DB 지우지 않아도 서버 재시작 시 반영 |
| 2-5. 요리 완료 XP 문구 형식 | 우시연 | ✅ `"{레시피 이름} 요리 완료"` + `"유통기한 내 소진 보너스"` (같은 요리의 두 로그는 `created_at`이 같습니다) |
| (새 요청서) 1. 생활 알림 `last_done_at` + 같은 회차 중복 완료 방지 | 우시연 | ✅ 완료 — 위 4-3. `done_this_cycle`도 추가 |
| (새 요청서) 2. 푸시 알림 발송 | 우시연 | ✅ 완료 — 위 4-2. 채널(`expiry`·`reminders`)·딥링크 요청하신 값 그대로. `PUSH_SOURCE = 'server'` 부탁드려요 |

완료되면 이 표를 갱신하겠습니다. 문의 사항은 PR 댓글이나 이 문서에 남겨 주세요. 감사합니다! 🙇
