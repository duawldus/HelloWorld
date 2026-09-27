# 데이터 사용법 (레시피·알림 화면 담당용)

앱에서 같이 쓰는 데이터는 모두 `src/data/`에 있어요. 화면에서는 **`src/data`에서 가져다 쓰기만** 하면 돼요.

```js
import { getIngredients, deductIngredients, completeCooking, completeChore } from '../data'
```

> 레시피 추천·상세는 `getRecipeRecommendations`, `getRecipe`로 불러와요 (아래 3-1).

> - 모든 함수는 `async`예요. 부를 때 앞에 `await`를 붙여 주세요.
> - 실패하면 에러가 나요(서버가 꺼져 있을 때 등). `try { ... } catch (error) { ... }`로 감싸고 `error.message`를 화면에 보여 주세요.
> - **돌려받는 값의 모양은 백엔드 API 응답과 똑같아요.** 이름이 `expires_on`, `d_day`처럼 밑줄(`_`)로 되어 있어요. 백엔드 Swagger(`/docs`)에서 본 모양 그대로 쓰면 돼요.

---

## 0. 가짜 모드 / 서버 모드

`src/data/config.js`의 한 줄로 바꿔요. **화면 코드는 바꾸지 않아도 돼요.**

```js
export const DATA_MODE = 'mock'   // 가짜 모드 (기본값): 서버 없이 폰 안에 저장
export const DATA_MODE = 'server' // 서버 모드: 백엔드 API 호출
export const API_BASE_URL = 'http://localhost:8000' // 서버 주소 (폰은 PC의 IP로)
```

| | 가짜 모드 (`mock`) | 서버 모드 (`server`) |
| --- | --- | --- |
| 저장 위치 | 폰(브라우저) 안 | 백엔드 DB |
| 처음 데이터 | 와이어프레임과 같은 재료 8개, 240 XP | 새 사용자라 비어 있음 |
| 로그인 | 없음 | 없음. 기기 번호를 `X-Device-Id` 헤더로 자동으로 붙여 줌 (처음 한 번 만들어 저장) |
| 규칙(XP·레벨·뱃지) | `src/data/mock/rules.js` (백엔드와 같은 값) | 백엔드가 계산 |

---

## 재료 하나의 모양

```js
{
  id: 3,                    // 숫자
  preset_id: 3,             // 프리셋 재료면 번호, 아니면 null
  name: '대파',
  icon: '🌿',
  quantity: 1,
  unit: '단',
  storage: 'FRIDGE',        // 'FRIDGE' | 'FREEZER' | 'ROOM' → 화면에는 storageLabel()로 '냉장'
  expires_on: '2026-09-29', // 유통기한
  d_day: 3,                 // 남은 날 (오늘이면 0, 지났으면 음수)
  is_imminent: true,        // D-3 이하면 true
  status: 'ACTIVE',
  source: 'MANUAL',         // 'PRESET' | 'MANUAL' | 'PHOTO'
}
```

```js
import { storageLabel } from '../data'
storageLabel(item.storage) // 'FRIDGE' → '냉장', 'FREEZER' → '냉동', 'ROOM' → '실온'
```

## 1. 냉장고 재료 불러오기

```js
const fridge = await getIngredients()
fridge.items           // 재료 목록 (유통기한 임박순)
fridge.total           // 전체 개수
fridge.imminent_count  // 임박(D-3 이하) 개수
fridge.storage_counts  // { FRIDGE: 6, FREEZER: 1, ROOM: 1 }

const tofu = fridge.items.find((item) => item.name === '두부')
```

## 2. 재료 차감 (XP 없음)

요리 말고 그냥 재료 양을 줄일 때 써요. 여러 개를 한 번에 줄일 수 있어요. 남은 양이 0이 되면 냉장고에서 빠져요.

```js
const result = await deductIngredients([
  { id: tofu.id, amount: 1 }, // 두부 1모
  { id: egg.id, amount: 2 },  // 계란 2개
])
// result: [{ id, name, amount: 뺀 양, left: 남은 양 }, ...]
```

> 백엔드에는 '차감' API가 따로 없어서, 서버 모드에서는 수량 수정(PATCH)이나 삭제(DELETE)로 처리해요.

## 3. 요리 완료 XP (레시피 화면)

**요리를 끝냈을 때는 이 함수 하나만 부르세요.** 쓴 재료를 냉장고에서 **통째로 소진**하고 XP를 줘요. (백엔드 방식. 수량만 줄이는 건 기획 확정 전이에요)

```js
const result = await completeCooking({
  recipeId: 1,                // 백엔드 레시피 id
  recipeName: '김치찌개',       // XP 기록에 남는 이름
  ingredientIds: [tofu.id, egg.id], // 소진할 내 재료 id. 생략하면 레시피에 맞는 내 재료 전부 (두 모드 모두)
})
result.cook_log_id // 실행 취소할 때 씀
result.consumed    // [{ ingredient_id, name, before_expiry }]
result.xp          // 아래 'XP 결과' 참고

// 실수로 눌렀을 때: 소진한 재료를 되돌리고 받은 XP를 회수
await undoCooking(result.cook_log_id) // → { cook_log_id, restored_ingredient_ids, xp_revoked }
```

- 기본 **+10 XP**, 쓴 재료 중 임박(D-3 이하, 안 지난) 재료가 있으면 **+10 보너스** ("유통기한 내 소진 보너스")
- 레시피 상세 화면(`RecipeDetailScreen.js`)이 이미 이렇게 쓰고 있어요.
- ⚠️ 백엔드의 요리 완료·실행 취소 API는 아직 준비 중이라, 서버 모드에서는 "아직 서버에 준비되지 않은 기능이에요 (501)" 에러가 나요. 가짜 모드에서는 동작해요.

## 3-1. 레시피 추천 · 상세 (레시피 화면)

모양은 백엔드 `recipes/schemas.py`의 `RecommendResponse`, `RecipeDetail`과 같아요.

```js
import { getRecipeRecommendations, getRecipe, difficultyLabel } from '../data'

// 추천: 내 냉장고 재료 + 보유 양념 기준. 옵션은 백엔드 쿼리 이름 그대로 (모두 생략 가능)
const rec = await getRecipeRecommendations({ imminent_first: true, max_minutes: 15, servings: 1 })
rec.basis_ingredient_count // '내 냉장고 재료 8개를 기준으로 추천했어요'
rec.ready  // 바로 만들 수 있어요 (부족 0개)
rec.almost // 1~2개만 더 있으면 (3개 이상 부족하면 빠짐)
// 카드 하나: { id, title, image_url, cook_minutes, difficulty: 'EASY', servings,
//             uses_imminent, imminent_count, missing_count, tags: [{ name, owned, imminent }] }
difficultyLabel('EASY') // '쉬움'

// 상세: 재료 체크리스트 + 조리 순서
const recipe = await getRecipe(2)
recipe.checklist // [{ name: '대파', amount: '약간', owned: false, is_seasoning: false, is_optional: false,
                 //    substitutes: ['쪽파', '양파'], owned_substitutes: ['양파'] }, ...]
recipe.steps     // [{ step_no: 1, description: '두부를 1cm 두께로 썰고...' }, ...]
```

인분 바꾸기: 상세 화면에서 몇 인분 만들지 고르면(기본 1인분, 최대 `MAX_SERVINGS`=6) 체크리스트 양을 바꿔 보여 줘요.

```js
import { scaleAmount } from '../data'
scaleAmount(item.amount, recipe.servings, 3) // '1/2모' → '1과 1/2모', '100g' → '300g', '약간' → '약간'
```


- 냉장고가 비어 있으면 `'식재료를 1개 이상 등록해 주세요'` 에러가 나요.
- 가짜 모드는 백엔드 seeds와 같은 레시피 7개로 추천해요. 재료 이름이 조금 달라도 포함되면 같은 재료로 봐요 (`돼지고기` ↔ `돼지고기 앞다리살`). 백엔드는 아직 이름이 똑같아야 매칭돼요.
- ⚠️ 백엔드 추천 API(`/recipes/recommendations`)는 아직 준비 중(501)이에요. 상세(`/recipes/{id}`)는 동작해요.

## 4. 집안일 완료 XP (생활알림 화면)

```js
const result = await completeChore({ reminderId: 1, name: '빨래하기' }) // +5 XP
result.xp       // 아래 'XP 결과' 참고
result.reminder // 바뀐 알림 정보 (7번의 알림 모양)
```

- 두 모드 모두 `reminderId`(알림 id)로 동작해요. `name`은 `reminderId` 없이 부를 때(가짜 모드만) XP 기록에 남는 이름이에요.
- 생활 알림 화면(`AlertScreen.js`)에서 항목을 누르면 나오는 '완료했어요 · +5 XP' 버튼이 이렇게 쓰고 있어요.
- 버튼에 보여 줄 XP 숫자는 `CHORE_XP`(5)를 쓰면 돼요.

## XP 결과 (`result.xp`, 3~4번과 사진 등록 공통)

```js
result.xp.amount     // 이번에 얻은 XP (예: 20)
result.xp.reasons    // ['김치찌개 요리 완료', '유통기한 내 소진 보너스']
result.xp.level_up   // 레벨이 올랐으면 true
result.xp.new_badges // 새로 딴 뱃지 이름 목록, 없으면 [] (예: ['집밥 마스터'])
```

예) 알림 띄우기 (웹에서는 `Alert`가 안 떠서 `Toast`를 추천해요):

```js
import { Toast, useToast } from '../components/Toast'

const [toast, showToast] = useToast()
showToast({ message: `+${result.xp.amount} XP!` })
// 화면 맨 아래에 <Toast toast={toast} />
```

## 5. 레벨 · 뱃지 · XP 기록 (홈·성과 화면)

```js
const stats = await getStats()
// { level: 3, title: '알뜰 자취러', xp: 240, next_level_xp: 390, xp_to_next_level: 150,
//   current_streak: 7, best_streak: 12, saved_count: 14, saved_money_estimate: 32200, cook_count: 12 }

const { acquired_count, total_count, badges } = await getBadges()
// badges: [{ id, code, name, description, icon, acquired, acquired_at, progress, threshold }]

const logs = await getXpLogs(20) // 최근 XP 기록 (최신순)
// [{ id, action: 'COOK_COMPLETE', amount: 10, description: '두부계란찜 요리 완료', created_at }]
```

화면에 보여 줄 때 쓰면 편한 도구:

```js
import { getLevelProgress, summarizeXpLogs, relativeDayLabel, STREAK_READY, BADGES_READY } from '../data'

getLevelProgress(stats) // 지금 레벨 안에서 얼마나 찼는지 0~1 (예: 240 XP → 0.21). 진행 바 width 에 사용

const rows = summarizeXpLogs(logs).slice(0, 5)
// 요리 완료 + '유통기한 내 소진 보너스'를 한 줄로 합쳐 줌
// [{ id, title: '두부계란찜 요리 완료', reasons: ['유통기한 내 소진 보너스'], amount: 20, created_at }]
relativeDayLabel(rows[0].created_at) // '오늘' / '어제' / '2일 전'

// 서버 모드에서 백엔드가 아직 준비 중인 값 (false 면 '준비 중이에요'로 보여 주세요)
STREAK_READY // 연속 기록 (current_streak, best_streak)
BADGES_READY // 뱃지 획득 여부 (acquired)
```

### 성과 · 뱃지 화면 열기 (홈 화면에서)

```js
import { router } from 'expo-router'

<Pressable onPress={() => router.push('/achievements')}>
  {/* 홈의 레벨 카드 등 */}
</Pressable>
```

성과 화면은 들어올 때마다 최신 값을 다시 불러와요. (요리 완료 후 돌아와도 바로 반영)

## 6. 보유 양념 가져오기 (레시피 매칭)

온보딩(기본 양념 설정)에서 사용자가 고른 양념이에요. 레시피 매칭할 때 **'보유 재료'로 쳐 주세요.**
냉장고 재료 목록(`getIngredients`)에는 섞여 있지 않아서 따로 불러와야 해요.

```js
import { getIngredients, getOwnedSeasonings } from '../data'

const seasonings = await getOwnedSeasonings()
// [{ id: 1, name: '간장', icon: '🫙' }, { id: 2, name: '식용유', icon: '🛢️' }, ...]

// 예) 레시피 재료 중 내가 가진 것 확인
const fridge = await getIngredients()
const ownedNames = new Set([
  ...fridge.items.map((item) => item.name),
  ...seasonings.map((s) => s.name),
])
const hasSoySauce = ownedNames.has('간장') // true
```

- 서버 모드: `GET /users/me/seasonings`의 `owned: true`인 것만 돌려줘요. (백엔드 레시피 추천도 같은 값을 써요)
- 양념 전체 목록(보유 여부 포함)이 필요하면 `getSeasonings()` → `[{ id, name, icon, owned }]` (12종)
- 저장은 `saveSeasonings([1, 2, 3])` (양념 id 목록, **전체 교체**). 보통은 온보딩 화면이 알아서 해요.

### 설정에서 양념 다시 고르기
같은 온보딩 화면을 **수정 모드**로 열면 돼요. 저장하면 이전 화면으로 돌아가요.

```js
router.push({ pathname: '/onboarding', params: { mode: 'edit' } })
```

---

## 7. 생활 알림 (생활알림 · 알림 추가 화면)

모양은 백엔드 `reminders/schemas.py`의 `ReminderListResponse`, `ReminderRead`와 같아요.

```js
import {
  getReminders, getReminder, addReminder, updateReminder, deleteReminder,
  categoryLabel, dueLabel, formatNotifyTime,
} from '../data'

const list = await getReminders()
list.enabled_count // '알림 5개 켜짐'
list.next_reminder // 가장 가까운 알림 (상단 '다음 알림' 배너). 없으면 null
list.groups        // [{ category: 'LAUNDRY', items: [알림, ...] }, ...]  세탁 → 청소 → 공과금 → 기타 순

// 알림 하나
{
  id: 1,
  category: 'LAUNDRY',          // 'LAUNDRY' 세탁 | 'CLEANING' 청소 | 'BILL' 공과금 | 'ETC' 기타 → categoryLabel()
  title: '빨래하기',
  repeat_type: 'WEEKLY',        // 'DAILY' | 'WEEKLY' | 'MONTHLY'
  interval: 1,                  // N일/N주/N달마다 (2주마다 → 2)
  weekdays: [1, 4],             // WEEKLY: 0=월 ... 6=일
  day_of_month: null,           // MONTHLY: 1~31 (그 날이 없는 달은 말일)
  remind_time: '20:00:00',
  notify_before_days: 0,        // 0 = 당일, 3 = 3일 전에 미리 알림
  enabled: true,
  next_due_at: '2026-09-29T20:00:00',    // 다음에 해야 하는 날 (꺼져 있으면 null)
  next_notify_at: '2026-09-29T20:00:00', // 다음 푸시 시각 (꺼져 있으면 null)
  summary: '매주 화·금 · 오후 8:00',
}

dueLabel(item)                         // 목록 뱃지: '오늘' / '내일' / '9/26', 미리 알림이 있으면 'D-3'
formatNotifyTime(item.next_notify_at)  // '오늘 오후 8:00', '9월 30일 (화) 오후 8:00'

// 추가 (백엔드 ReminderCreate 모양)
await addReminder({
  category: 'BILL', title: '전기요금', repeat_type: 'MONTHLY', interval: 1,
  weekdays: [], day_of_month: 25, remind_time: '09:00:00', notify_before_days: 3,
})
await updateReminder(id, { title: '빨래' })   // 바꿀 것만
await updateReminder(id, { enabled: false })  // 켜고 끄기
await deleteReminder(id)
```

- 매주 반복인데 요일이 없거나, 매달 반복인데 날짜가 없으면 에러가 나요 (백엔드와 같은 검사).
- 가짜 모드는 와이어프레임 6번과 같은 알림 6개로 시작해요 (관리비만 꺼짐). 다음 날짜 계산은 `src/data/reminderSchedule.js`가 백엔드 `schedule.py`와 똑같이 해요.
- 반복 문구 도구: `repeatRuleLabel(알림)` → `'매주 화·금'`, `reminderSummary(알림)` → `'매주 화·금 · 오후 8:00'`, `formatRemindTime('20:00:00')` → `'오후 8:00'`, `toTimeString(20, 0)` → `'20:00:00'`

### 알림 추가 · 수정 화면 열기

```js
router.push('/reminder/form')                                  // 새 알림
router.push({ pathname: '/reminder/form', params: { id: 3 } })  // 수정 (+ 삭제)
```

## 8. 푸시 알림 (`src/notifications/`)

화면에서 따로 부를 것은 거의 없어요. 앱 전체 틀(`src/app/_layout.js`)이 알아서 해요.

- **누가 보내나요?** `src/data/config.js`의 `PUSH_SOURCE`
  - `'local'`(기본): 앱이 폰 안에서 알림을 직접 예약해요. 서버 없이, **Expo Go에서도** 동작해요.
    생활 알림은 30일 앞까지, 유통기한 알림(임박 재료가 있는 날 오전 9시)은 7일 앞까지 예약하고,
    앱을 열 때 · 재료나 알림이 바뀔 때마다(`onDataChange`) 예약을 새로 맞춰요.
  - `'server'`: 백엔드가 Expo Push로 보내요. 앱은 푸시 토큰만 서버에 등록해요(`registerPushDevice`).
    백엔드 발송 잡(`notifications/jobs.py`)이 완성되고, 개발 빌드 + EAS projectId가 있을 때 바꾸세요. (Android Expo Go는 원격 푸시를 못 받아요)
- **알림을 누르면** 유통기한 알림은 레시피 추천(`/recipe`), 생활 알림은 생활 알림(`/alert`) 화면으로 가요.
- **웹에서는** 푸시 알림이 없어요 (`PUSH_SUPPORTED`가 `false`).
- 문구는 `src/notifications/messages.js` (와이어프레임 9번): '지금 빨래 시간이에요', '전기요금 납부일이 3일 남았어요', '두부 유통기한이 내일까지예요'

```js
import {
  getNotificationPermission, requestNotificationPermission, openNotificationSettings, sendTestNotification,
} from '../notifications'

await getNotificationPermission()     // 'granted' | 'denied' | 'undetermined' | 'unsupported'(웹)
await requestNotificationPermission() // 권한 창 (이미 정했으면 창 없이 결과만)
openNotificationSettings()            // 거절했을 때 휴대폰 설정 열기
await sendTestNotification()          // 개발용: 5초 뒤 테스트 알림
```

- 생활 알림 화면 맨 아래 **'개발용 · 5초 뒤 테스트 알림 보내기'**(개발 중에만 보임)로 바로 확인할 수 있어요. 누르고 앱을 닫고 기다려 보세요.

## 화면에서 불러오기 예시 (React Native)

`useFocusEffect`를 쓰면 **화면이 보일 때마다** 새로 불러와요. 다른 화면에서 재료를 바꾸고 돌아와도 최신 상태가 보여요.

```jsx
import { useCallback, useState } from 'react'
import { Text } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { getIngredients, storageLabel } from '../data'
import { Screen } from '../components/Screen'

export default function MyScreen() {
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  useFocusEffect(
    useCallback(() => {
      getIngredients()
        .then((fridge) => setItems(fridge.items))
        .catch((e) => setError(e.message))
    }, []),
  )

  return (
    <Screen>
      {error && <Text>{error}</Text>}
      {items.map((item) => (
        <Text key={item.id}>
          {item.name} {item.quantity}{item.unit} · {storageLabel(item.storage)} · D-{item.d_day}
        </Text>
      ))}
    </Screen>
  )
}
```

## 그 밖에 쓸 수 있는 것

| 함수 | 하는 일 |
| --- | --- |
| `getPresets()` / `getPresets({ frequent: true })` | 재료 프리셋 전체 / 자주 쓰는 재료 8개 |
| `getIngredient(id)` | 재료 하나 |
| `addIngredient({ name: '두부' })` | 재료 추가 (프리셋 재료는 이름만 넣어도 수량·보관·유통기한 자동) |
| `addIngredient({ name: '두부', preset_id: 2 }, 'PRESET')` | 두 번째 값은 등록 경로: `'PRESET'`(아이콘 탭) · `'MANUAL'`(기본) |
| `updateIngredient(id, { quantity: 3 })` | 재료 수정 (`name`, `quantity`, `unit`, `storage`, `expires_on`) |
| `consumeIngredient(id)` | 다 먹었어요 → '소진'으로 냉장고에서 빼기 (XP·통계 없음). 서버 모드는 백엔드 API가 생기기 전까지 에러 (`CAN_CONSUME`이 `false`) |
| `deleteIngredient(id)` | 버렸어요 → '폐기'로 냉장고에서 빼기 |
| `withJosa('대파', '을', '를')` | 받침에 맞게 조사 붙이기 → `'대파를'` |
| `recognizeIngredients(사진)` | 사진 속 재료 후보 `{ count, items: [{ name, preset_id, quantity, unit, storage, expires_on, confidence(0~1), needs_review }] }` |
| `addIngredientsByPhoto([...])` | 사진으로 인식한 재료 한 번에 등록 → `{ items, xp }` (+15 XP) |
| `daysUntil('2026-09-30')` | 오늘부터 그 날짜까지 남은 날 |
| `todayString()` / `addDays('2026-09-25', 7)` | 오늘 날짜 / 날짜 더하기 (`'YYYY-MM-DD'`) |
| `matchesName(재료.name, 검색어)` | 이름이 검색어에 맞는지 (초성 `'ㄷㅂ'`도 됨) |
| `STORAGE_TYPES` | `['FRIDGE', 'FREEZER', 'ROOM']` |
| `IS_SERVER_MODE` | 지금 서버 모드면 `true` |
| `resetAllData()` | 가짜 모드: 테스트 데이터로 처음부터 다시 / 서버 모드: 아무것도 안 지움 (기기 번호는 두 모드 모두 유지) |
| `onDataChange(함수)` | 재료·알림을 바꾸는 함수(추가·수정·삭제·요리 완료·집안일 완료 등)가 성공하면 불러 줌. 그만 들으려면 돌려받은 함수를 부름 (푸시 예약 맞추기에 씀) |

- XP 점수·레벨 기준은 **백엔드** `backend/app/features/gamification/rules.py`가 기준이에요. 바뀌면 가짜 모드용 `src/data/mock/rules.js`도 같이 맞춰 주세요.
- 색은 `src/theme/colors.js`에서 가져다 쓰세요. (예: `colors.primary`)
