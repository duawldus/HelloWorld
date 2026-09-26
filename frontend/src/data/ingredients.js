// 냉장고 재료: 불러오기, 추가, 수정, 삭제, 차감
//
// 재료 하나의 모양:
// {
//   id: 'abc-123',
//   name: '두부',
//   quantity: 1,                  // 남은 양
//   unit: '모',
//   storage: '냉장',              // '냉장' | '냉동' | '실온'
//   expiryDate: '2026-09-27',     // 유통기한
//   registeredDate: '2026-09-20', // 등록일
//   unitPrice: 1800,              // 단위 1개당 가격(원), 절약 식비 계산용
// }
import { loadIngredients, saveIngredients } from './storage.js'
import { findPreset } from './presets.js'
import { EXPIRING_SOON_DAYS } from './rules.js'
import { addDays, createId, daysBetween, todayString } from './utils.js'

export async function getIngredients() {
  return loadIngredients()
}

// 이름만 넣어도 프리셋에 있는 재료면 나머지를 자동으로 채웁니다.
// 예) addIngredient({ name: '두부' })
//     addIngredient({ name: '고추', quantity: 5, unit: '개', storage: '냉장', expiryDate: '2026-10-01' })
export async function addIngredient(input) {
  const ingredients = await loadIngredients()
  const newIngredient = buildIngredient(input)
  await saveIngredients([...ingredients, newIngredient])
  return newIngredient
}

// 바꿀 내용만 넣으면 됩니다. 예) updateIngredient(id, { quantity: 3 })
export async function updateIngredient(id, changes) {
  const ingredients = await loadIngredients()
  const updated = ingredients.map((item) => (item.id === id ? { ...item, ...changes, id } : item))
  await saveIngredients(updated)
  return updated.find((item) => item.id === id)
}

export async function deleteIngredient(id) {
  const ingredients = await loadIngredients()
  await saveIngredients(ingredients.filter((item) => item.id !== id))
}

// 여러 재료를 한 번에 차감합니다. 0 이하가 되면 냉장고에서 빠집니다.
// 예) deductIngredients([{ id: '두부id', amount: 1 }, { id: '계란id', amount: 2 }])
// XP는 주지 않습니다. 요리를 끝낸 경우에는 completeCooking 을 쓰세요.
export async function deductIngredients(usedList) {
  const ingredients = await loadIngredients()
  const result = applyDeduction(ingredients, usedList)
  await saveIngredients(result.remaining)
  return result.used
}

// 유통기한까지 남은 날 (오늘이 유통기한이면 0, 지났으면 음수)
export function getDaysLeft(ingredient) {
  return daysBetween(todayString(), ingredient.expiryDate)
}

// 유통기한이 3일 이내로 남았는지 (이미 지난 재료는 false)
export function isExpiringSoon(ingredient) {
  const daysLeft = getDaysLeft(ingredient)
  return daysLeft >= 0 && daysLeft <= EXPIRING_SOON_DAYS
}

export function isExpired(ingredient) {
  return getDaysLeft(ingredient) < 0
}

// ----- 아래는 데이터 파일 안에서만 쓰는 함수 -----

export function buildIngredient(input) {
  const preset = findPreset(input.name) ?? {}
  const today = todayString()
  return {
    id: createId(),
    name: input.name,
    quantity: input.quantity ?? preset.packQuantity ?? 1,
    unit: input.unit ?? preset.unit ?? '개',
    storage: input.storage ?? preset.storage ?? '냉장',
    expiryDate: input.expiryDate ?? addDays(today, preset.shelfLifeDays ?? 7),
    registeredDate: input.registeredDate ?? today,
    unitPrice: input.unitPrice ?? (preset.price ? preset.price / preset.packQuantity : 0),
  }
}

// 차감 계산만 하고 저장은 하지 않습니다.
// used: 실제로 쓴 재료(쓰기 전 상태 + 쓴 양), remaining: 차감 후 냉장고
export function applyDeduction(ingredients, usedList) {
  const used = []
  const remaining = []
  for (const item of ingredients) {
    const request = usedList.find((u) => u.id === item.id)
    if (!request) {
      remaining.push(item)
      continue
    }
    const amount = Math.min(request.amount, item.quantity)
    used.push({ ingredient: item, amount })
    const left = item.quantity - amount
    if (left > 0) remaining.push({ ...item, quantity: left })
  }
  return { used, remaining }
}
