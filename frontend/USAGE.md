# 데이터 사용법 (레시피·알림 화면 담당용)

앱에서 같이 쓰는 데이터는 모두 `src/data/`에 있어요. 화면에서는 **`src/data`에서 가져다 쓰기만** 하면 돼요.

```js
import { getIngredients, deductIngredients, completeCooking, completeChore } from '../data'
```

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
| 로그인 | 없음 | 자동 게스트 로그인 (토큰을 알아서 붙여 줌) |
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
  recipeName: '김치찌개',       // XP 기록에 남는 이름 (가짜 모드용)
  ingredientIds: [tofu.id, egg.id], // 소진할 내 재료 id (서버 모드는 생략하면 레시피에 맞는 재료 전부)
})
result.consumed // [{ ingredient_id, name, before_expiry }]
result.xp       // 아래 'XP 결과' 참고
```

- 기본 **+10 XP**, 쓴 재료 중 임박(D-3 이하, 안 지난) 재료가 있으면 **+10 보너스** ("유통기한 내 소진 보너스")
- ⚠️ 백엔드의 요리 완료 API는 아직 준비 중이라, 서버 모드에서는 "아직 서버에 준비되지 않은 기능이에요 (501)" 에러가 나요. 가짜 모드에서는 동작해요.

## 4. 집안일 완료 XP (생활알림 화면)

```js
const result = await completeChore({ reminderId: 1, name: '세탁' }) // +5 XP
result.xp       // 아래 'XP 결과' 참고
result.reminder // 서버 모드: 바뀐 알림 정보 / 가짜 모드: null (알림 데이터가 없음)
```

- 서버 모드는 `reminderId`(백엔드 알림 id), 가짜 모드는 `name`(XP 기록에 남는 이름)을 써요. 둘 다 넣어 두면 어느 모드든 동작해요.

## XP 결과 (`result.xp`, 2~4번과 사진 등록 공통)

```js
result.xp.amount     // 이번에 얻은 XP (예: 20)
result.xp.reasons    // ['요리 완료: 김치찌개', '유통기한 내 소진 보너스']
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
// [{ id, action: 'COOK_COMPLETE', amount: 10, description: '요리 완료: 김치볶음밥', created_at }]
```

---

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
| `deleteIngredient(id)` | 재료 삭제 |
| `recognizeIngredients(사진)` | 사진 속 재료 후보 `{ count, items: [{ name, preset_id, quantity, unit, storage, expires_on, confidence(0~1), needs_review }] }` |
| `addIngredientsByPhoto([...])` | 사진으로 인식한 재료 한 번에 등록 → `{ items, xp }` (+15 XP) |
| `daysUntil('2026-09-30')` | 오늘부터 그 날짜까지 남은 날 |
| `todayString()` / `addDays('2026-09-25', 7)` | 오늘 날짜 / 날짜 더하기 (`'YYYY-MM-DD'`) |
| `matchesName(재료.name, 검색어)` | 이름이 검색어에 맞는지 (초성 `'ㄷㅂ'`도 됨) |
| `STORAGE_TYPES` | `['FRIDGE', 'FREEZER', 'ROOM']` |
| `IS_SERVER_MODE` | 지금 서버 모드면 `true` |
| `resetAllData()` | 가짜 모드: 테스트 데이터로 처음부터 다시 / 서버 모드: 로그인 토큰만 지움 |

- XP 점수·레벨 기준은 **백엔드** `backend/app/features/gamification/rules.py`가 기준이에요. 바뀌면 가짜 모드용 `src/data/mock/rules.js`도 같이 맞춰 주세요.
- 색은 `src/theme/colors.js`에서 가져다 쓰세요. (예: `colors.primary`)
