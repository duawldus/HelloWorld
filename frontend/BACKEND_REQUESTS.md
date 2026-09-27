# 백엔드 API 요청서 (프론트엔드 → 백엔드)

프론트에서 필요한데 아직 백엔드(`backend` 브랜치)에 없는 API를 정리했어요.
만들어 주시면 프론트는 `frontend/src/data/server/index.js`의 표시된 부분만 바꾸면 돼요.
짝이 되는 문서: `backend` 브랜치의 `backend/FRONTEND_REQUESTS.md` (백엔드 → 프론트)

## 처리 현황 (2026-09-27, `backend` 브랜치 `0a19176` 기준)

| 요청 | 상태 |
| --- | --- |
| 1. 생활 알림: `last_done_at` + 같은 회차 중복 완료 방지 | ⏳ 대기 (`reminders/service.py`에 아직 TODO) |
| 2. 푸시 알림 발송 (`jobs.py`, `sender.py`) | ⏳ 대기 (아직 TODO) |

완료되면 이 표에서 ✅로 바꾸고, 프론트 쪽 연결을 해 주세요.

### ✅ 완료되어 지운 요청 (프론트 반영 끝)
- 재료 소진 API `POST /ingredients/{id}/consume` → 서버 모드 "다 먹었어요" 켬 (`CAN_CONSUME = true`)
- 연속 기록 갱신, 뱃지 지급 → `STREAK_READY`, `BADGES_READY` = `true`
- `level_min_xp` 추가 (+ `level_hint`) → 진행 바가 이 값을 씀
- 뱃지 이름 "냉장고 클리너"
- 요리 완료 XP 문구 `"{레시피 이름} 요리 완료"` + `"유통기한 내 소진 보너스"`

---

## 1. 생활 알림: 마지막 완료 시각 + 같은 회차 중복 완료 방지

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

## 2. 푸시 알림 발송 (참고: 프론트 준비 상태)

`notifications/jobs.py`(발송 잡)와 `sender.py`(Expo Push 연동)가 TODO라서, **지금은 앱이 폰 안에서 알림을 직접 예약**해요.
(`frontend/src/data/config.js`의 `PUSH_SOURCE = 'local'`, 문구·시각은 `jobs.py` docstring과 같은 시나리오)

백엔드 발송이 완성되면:
- 프론트는 `PUSH_SOURCE = 'server'`로 바꾸고, 앱이 `POST /notifications/devices`로 Expo 푸시 토큰을 등록해요. (코드 준비됨)
- 알림을 누르면 이동할 화면은 `data.deeplink`로 보내 주세요: `bangguseok://recipes` → 레시피 추천, `bangguseok://reminders` → 생활 알림 (`PushMessage.deeplink`와 같음)
  - Expo Push 요청 예: `{"to": "ExponentPushToken[...]", "title": ..., "body": ..., "data": {"deeplink": "bangguseok://reminders"}, "channelId": "reminders"}`
  - Android 알림 채널 id: 생활 알림 `reminders`, 유통기한 알림 `expiry` (앱이 만들어 둠)
- 원격 푸시는 EAS projectId가 필요해요 (`eas init`). 개발 빌드로 테스트해야 해요.

