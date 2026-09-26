// 가짜 모드의 재료 차감 · 요리 완료 · 집안일 완료
import { loadIngredients, saveIngredients } from './storage.js'
import { findActive, toRead } from './ingredients.js'
import { awardXp } from './gamification.js'

// 재료 수량 차감 (XP 없음). 0 이하가 되면 냉장고에서 빠집니다.
// 돌려주는 값: [{ id, name, amount(뺀 양), left(남은 양) }]
export async function deductIngredients(usedList) {
  const ingredients = await loadIngredients()
  const results = usedList.map(({ id, amount }) => {
    const item = findActive(ingredients, id)
    const used = Math.min(amount, item.quantity)
    return { id, name: item.name, amount: used, left: item.quantity - used }
  })
  await saveIngredients(
    ingredients.map((item) => {
      const result = results.find((r) => r.id === item.id)
      if (!result) return item
      return result.left > 0
        ? { ...item, quantity: result.left }
        : { ...item, quantity: 0, status: 'CONSUMED' }
    }),
  )
  return results
}

// POST /recipes/{id}/complete 와 같은 모양으로 돌려줍니다.
// 쓴 재료는 통째로 소진(냉장고에서 빠짐)하고 +10 XP.
// 소진한 재료 중 임박(D-3 이하, 안 지난) 재료가 있으면 '유통기한 내 소진 보너스' +10 XP.
export async function completeCooking({ recipeName, ingredientIds = [] }) {
  const ingredients = await loadIngredients()
  const used = ingredientIds.map((id) => toRead(findActive(ingredients, id)))
  await saveIngredients(
    ingredients.map((item) =>
      ingredientIds.includes(item.id) ? { ...item, status: 'CONSUMED' } : item,
    ),
  )

  const savedInTime = used.some((item) => item.is_imminent && item.d_day >= 0)
  const entries = [{ action: 'COOK_COMPLETE', description: `요리 완료: ${recipeName}` }]
  if (savedInTime) entries.push({ action: 'EXPIRY_SAVE_BONUS', description: '유통기한 내 소진 보너스' })

  return {
    cook_log_id: null, // 가짜 모드는 실행 취소 기록이 없음
    consumed: used.map((item) => ({
      ingredient_id: item.id,
      name: item.name,
      before_expiry: item.d_day >= 0,
    })),
    xp: await awardXp(entries),
  }
}

// POST /reminders/{id}/complete 와 같은 모양 ({ reminder, xp }). 가짜 모드는 알림 데이터가 없어 reminder 는 null
export async function completeChore({ name }) {
  const xp = await awardXp([{ action: 'CHORE_COMPLETE', description: `집안일 완료: ${name}` }])
  return { reminder: null, xp }
}
