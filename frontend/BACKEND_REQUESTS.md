# 백엔드 API 요청서 (프론트엔드 → 백엔드)

프론트에서 필요한데 아직 백엔드(`backend` 브랜치)에 없는 API를 정리했어요.
만들어 주시면 프론트는 `frontend/src/data/server/index.js`의 표시된 부분만 바꾸면 돼요.
짝이 되는 문서: `backend` 브랜치의 `backend/FRONTEND_REQUESTS.md` (백엔드 → 프론트)

## 처리 현황 (2026-09-27 확인)

백엔드 `FRONTEND_REQUESTS.md` 5번 표와 `backend` 브랜치 코드(`c5dcba2`)를 함께 확인했어요. **아직 완료된 항목은 없어요.**

| 요청 | 담당 | 상태 |
| --- | --- | --- |
| 1. 재료 소진 API | 염지연 | ⏳ 예정 |
| 2-1. 연속 기록 갱신 | 우시연 | ⏳ 예정 |
| 2-2. 뱃지 지급 | 우시연 | ⏳ 예정 |
| 2-3. `level_min_xp` 추가 | 우시연 | ⏳ 예정 |
| 2-4. 뱃지 이름 "냉장고 클리너" | 우시연 | ⏳ 예정 (수정하기로 함) |
| 2-5. 요리 완료 XP 문구 | 우시연 | 🤝 `"{레시피 이름} 요리 완료"` 형식으로 합의, 요리 완료 구현 때 반영 |

완료되면 이 표에서 ✅로 바꾸고, 프론트 쪽 연결(각 항목의 "끝나면 프론트")을 해 주세요.

> 백엔드 요청 1번(로그인 제거 → `X-Device-Id` 헤더)은 프론트에 반영 완료했어요. (`src/data/server/api.js`)

---

## 1. 재료 소진 API ("다 먹었어요")

### 왜 필요한가요?
냉장고 화면에서 재료 카드를 누르면 **수정 / 다 먹었어요 / 버렸어요** 메뉴가 나와요.

| 버튼 | 백엔드 처리 | 상태 |
| --- | --- | --- |
| 수정 | `PATCH /ingredients/{id}` | ✅ 있음 |
| 버렸어요 | `DELETE /ingredients/{id}` → `DISCARDED`(폐기) | ✅ 있음 |
| 다 먹었어요 | 재료 하나를 `CONSUMED`(소진)로 바꾸는 API | ❌ **없음** |

지금 `CONSUMED`는 레시피 요리 완료(`POST /recipes/{id}/complete`, 아직 501)로만 바뀌어요.
요리하지 않고 그냥 먹은 재료(우유, 요거트 등)를 "폐기"와 구분해서 기록하려면 소진 API가 필요해요.

### 제안하는 모양

```
POST /api/v1/ingredients/{ingredient_id}/consume
X-Device-Id: <기기 번호>
(본문 없음)
```

- 동작: 내 재료이고 `ACTIVE`일 때 `status = CONSUMED`, `consumed_at = now()`
- 성공: `200` + `IngredientRead` (바뀐 재료, `status: "CONSUMED"`)
- 실패: 없는 재료 / 남의 재료 / 이미 소진·폐기된 재료 → `404 NOT_FOUND` (지금 `get_owned`와 같게)
- **XP와 '제때 소진' 통계는 주지 않아요.** (프론트·기획 결정: 제때 소진은 지금처럼 요리 완료 보너스로만 셈)

### 참고: 되돌리기(복구) API는 필요 없어요
"다 먹었어요"와 "버렸어요"를 누르면 프론트가 화면에서 먼저 빼고, **3초 동안 되돌리기를 기다린 뒤에** 요청을 보내요.
되돌리기를 누르면 요청 자체를 보내지 않아서 백엔드에 복구 API는 없어도 돼요.

### 프론트 연결 방법 (API가 생기면)
`frontend/src/data/server/index.js`:

```js
export const CAN_CONSUME = true
export function consumeIngredient(id) {
  return request(`/ingredients/${id}/consume`, { method: 'POST' })
}
```

그 전까지 서버 모드에서 "다 먹었어요"를 누르면 "아직 서버에 준비되지 않은 기능이에요" 안내가 떠요. (가짜 모드는 동작)

---

## 2. 성과 · 뱃지 화면 (와이어프레임 8번)

`GET /gamification/stats`, `/badges`, `/xp-logs`는 이미 잘 동작해요. 👍
아래는 **API는 200을 주지만 값이 아직 채워지지 않는 부분**이에요. (코드의 `TODO(gamification)`)
프론트는 서버 모드에서 이 영역만 "준비 중이에요"로 보여 주고 있어요.

### 2-1. 연속 기록(streak) 갱신 — `touch_streak()`
- 지금: 함수가 비어 있어서 `current_streak`, `best_streak`가 항상 0이에요.
- 필요: XP를 얻을 때 `last_active_date`가 어제면 +1, 오늘이면 그대로, 그 외엔 1로 리셋. `best_streak` 갱신.
- 화면: 레벨 카드 위 "7일 연속 기록중 · 역대 최고 12일"
- 끝나면 프론트: `server/index.js`의 `STREAK_READY = true`

### 2-2. 뱃지 지급 — `evaluate_badges()`
- 지금: 빈 목록을 돌려줘서 `acquired`가 항상 `false`예요. (`progress` 숫자는 잘 나와요)
- 필요: `progress >= threshold`이고 아직 없는 뱃지를 `UserBadge`로 지급하고, `acquired_at` 기록.
- 화면: "획득한 뱃지 3 / 6" 그리드, 획득 알림(`xp.new_badges`)
- 끝나면 프론트: `server/index.js`의 `BADGES_READY = true`

### 2-3. 레벨 진행 바용 값 추가 (`GET /gamification/stats`)
- 지금 `LevelSummary`에 **현재 레벨의 시작 XP**가 없어서, 프론트가 같은 레벨 표를 따로 들고 계산해요.
- 제안: `level_min_xp: int` 추가 (예: Lv.3이면 200)
  ```json
  { "level": 3, "xp": 240, "level_min_xp": 200, "next_level_xp": 390, "xp_to_next_level": 150, ... }
  ```
- 프론트는 이미 `level_min_xp`가 오면 그 값을 먼저 쓰도록 돼 있어요. (`src/data/index.js`의 `getLevelProgress`)

### 2-4. 뱃지 이름 오타 (`seeds/data.py`)
- `"냉장고 클린러"` → **`"냉장고 클리너"`** (맞춤법. 백엔드에서 수정하기로 함)
- 위치: `backend/app/seeds/data.py`의 `BADGES` (`FRIDGE_CLEANER` 줄). seeds 라서 수정 후 `bangguseok.db`를 지우고 서버를 다시 켜야 반영돼요.

### 2-5. XP 기록 문구 형식 (요리 완료 구현할 때)
성과 화면의 "최근 획득 XP"는 `xp-logs`의 `description`을 제목으로 보여 줘요.
- 요리 완료: **`"{레시피 이름} 요리 완료"`** 로 합의했어요. (백엔드: 요리 완료 구현 때 반영)
  혹시 `"요리 완료: {레시피 이름}"` 으로 와도 프론트가 화면에서 `"김치볶음밥 요리 완료"`로 바꿔 보여 줘요. (`formatXpTitle`)
- 보너스: `"유통기한 내 소진 보너스"` — 프론트가 요리 완료 기록과 1분 안에 생긴 보너스를 한 줄로 합쳐요 (+20 XP)
- (이미 있는 형식: 사진 `사진으로 재료 3개 등록`, 집안일 `세탁 완료`는 그대로 좋아요)

---

## 2. 생활 알림: 마지막 완료 시각 + 같은 회차 중복 완료 방지

### 왜 필요한가요?
생활 알림 화면에서 항목을 누르면 **완료했어요(+5 XP)** 버튼이 있어요. (`POST /reminders/{id}/complete` ✅)
지금은 같은 알림을 여러 번 눌러도 매번 +5 XP가 들어가고, 프론트는 '이미 완료했는지'를 알 방법이 없어요.
(백엔드 `reminders/service.py`의 `TODO(reminders): 같은 회차에 중복 완료 방지`와 같은 이야기예요)

### 제안
1. `ReminderRead`에 `last_done_at: datetime | null` 추가 (모델에는 이미 있음)
   → 프론트는 이 값으로 '오늘 완료' 표시와 버튼 비활성화를 해요. (가짜 모드는 이미 이렇게 동작)
2. 같은 회차에 이미 완료했으면 XP를 주지 않기 (`xp.amount = 0`) 또는 `422 VALIDATION_ERROR` "이미 완료한 집안일이에요"

### 프론트 연결 방법
응답에 `last_done_at`만 생기면 프론트는 바꿀 것이 없어요. (`AlertScreen.js`의 `isDoneToday`가 이미 이 값을 봐요)

---

## 3. 푸시 알림 발송 (참고: 프론트 준비 상태)

`notifications/jobs.py`(발송 잡)와 `sender.py`(Expo Push 연동)가 TODO라서, **지금은 앱이 폰 안에서 알림을 직접 예약**해요.
(`frontend/src/data/config.js`의 `PUSH_SOURCE = 'local'`, 문구·시각은 `jobs.py` docstring과 같은 시나리오)

백엔드 발송이 완성되면:
- 프론트는 `PUSH_SOURCE = 'server'`로 바꾸고, 앱이 `POST /notifications/devices`로 Expo 푸시 토큰을 등록해요. (코드 준비됨)
- 알림을 누르면 이동할 화면은 `data.deeplink`로 보내 주세요: `bangguseok://recipes` → 레시피 추천, `bangguseok://reminders` → 생활 알림 (`PushMessage.deeplink`와 같음)
  - Expo Push 요청 예: `{"to": "ExponentPushToken[...]", "title": ..., "body": ..., "data": {"deeplink": "bangguseok://reminders"}, "channelId": "reminders"}`
  - Android 알림 채널 id: 생활 알림 `reminders`, 유통기한 알림 `expiry` (앱이 만들어 둠)
- 원격 푸시는 EAS projectId가 필요해요 (`eas init`). 개발 빌드로 테스트해야 해요.

