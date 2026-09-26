# 데이터 사용법 (레시피·알림 화면 담당용)

앱에서 같이 쓰는 데이터는 모두 `src/data/`에 있어요. 다른 파일은 보지 않아도 되고, **`src/data`에서 가져다 쓰기만** 하면 돼요.

```js
import { getIngredients, deductIngredients, completeCooking, completeChore } from '../data'
```

> 모든 함수는 `async`예요. 부를 때 앞에 `await`를 붙여 주세요.
> 지금은 폰 안(AsyncStorage)에 저장되고, 나중에 백엔드로 바뀌어도 쓰는 방법은 똑같아요.

---

## 1. 재료 차감 (XP 없음)

요리 말고 그냥 재료를 줄일 때 써요. 여러 개를 한 번에 줄일 수 있어요. 남은 양이 0이 되면 냉장고에서 사라져요.

```js
const ingredients = await getIngredients()   // 냉장고 재료 목록
const tofu = ingredients.find((item) => item.name === '두부')
const egg = ingredients.find((item) => item.name === '계란')

await deductIngredients([
  { id: tofu.id, amount: 1 },   // 두부 1모
  { id: egg.id, amount: 2 },    // 계란 2개
])
```

## 2. 요리 완료 XP (레시피 화면)

**요리를 끝냈을 때는 이 함수 하나만 부르세요.** 재료 차감까지 같이 해 줘요.

```js
const result = await completeCooking({
  recipeName: '두부계란찜',
  usedIngredients: [
    { id: tofu.id, amount: 1 },
    { id: egg.id, amount: 2 },
  ],
})
```

- 기본으로 **+10 XP**를 얻어요.
- 쓴 재료 중에 유통기한이 3일 이내인 것이 있으면 **+10 보너스**가 붙어요. 이때 XP 기록에 "유통기한 내 소진 보너스"가 남고, 제때 소진 횟수와 절약 식비도 올라가요.

## 3. 집안일 완료 XP (생활알림 화면)

```js
const result = await completeChore('세탁')   // +5 XP, 기록: "집안일 완료: 세탁"
```

## 돌려받는 값 (2, 3번 공통)

```js
result.gainedXp    // 이번에 얻은 XP (예: 20)
result.levelUp     // 레벨이 올랐으면 true
result.newBadges   // 새로 딴 뱃지 목록, 없으면 [] (예: [{ name: '집밥 마스터', ... }])
result.progress    // 바뀐 뒤의 XP·레벨·연속 기록 → 화면을 새로 그릴 때 사용
```

예) 알림 띄우기:

```js
import { Alert } from 'react-native'

Alert.alert(`+${result.gainedXp} XP!`)
if (result.levelUp) Alert.alert(`레벨 업! ${result.progress.level.title}`)
```

---

## 화면에서 불러오기 예시 (React Native)

`useFocusEffect`를 쓰면 **화면이 보일 때마다** 새로 불러와요. 다른 화면에서 재료를 바꾸고 돌아와도 최신 상태가 보여요.

```jsx
import { useCallback, useState } from 'react'
import { Text } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { getIngredients } from '../data'
import { Screen } from '../components/Screen'

export default function MyScreen() {
  const [ingredients, setIngredients] = useState([])

  useFocusEffect(
    useCallback(() => {
      getIngredients().then(setIngredients)
    }, []),
  )

  return (
    <Screen>
      {ingredients.map((item) => (
        <Text key={item.id}>{item.name} {item.quantity}{item.unit}</Text>
      ))}
    </Screen>
  )
}
```

## 그 밖에 쓸 수 있는 것

| 함수 | 하는 일 |
| --- | --- |
| `getProgress()` | XP, 레벨, 연속 기록, 통계, 뱃지, 최근 XP 기록 |
| `addIngredient({ name: '두부' })` | 재료 추가 (프리셋 재료는 이름만 넣어도 자동 완성) |
| `updateIngredient(id, { quantity: 3 })` | 재료 수정 |
| `deleteIngredient(id)` | 재료 삭제 |
| `addIngredientsByPhoto([{ name: '계란' }, ...])` | 사진으로 등록 (1개당 +5 XP) |
| `isExpiringSoon(재료)` / `getDaysLeft(재료)` | 유통기한 임박 여부 / 남은 날 |
| `resetAllData()` | 테스트 데이터로 처음부터 다시 시작 |

XP 점수나 레벨 기준을 바꾸고 싶으면 `src/data/rules.js`만 고치면 돼요.
색은 `src/theme/colors.js`에서 가져다 쓰세요. (예: `colors.primary`)
