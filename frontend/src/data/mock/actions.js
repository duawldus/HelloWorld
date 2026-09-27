// 가짜 모드의 재료 차감 · 요리 완료(+실행 취소)  (집안일 완료는 reminders.js)
import { loadCookLogs, loadIngredients, nextId, saveCookLogs, saveIngredients } from './storage.js'
import { findActive, toRead } from './ingredients.js'
import { awardXp, revokeXp } from './gamification.js'
import { findRecipe, matchedIngredientIds } from './recipes.js'

// POST /ingredients/deduct 와 같게: 재료 수량 차감 (XP 없음). 0 이 되면 소진(CONSUMED)으로 냉장고에서 빠집니다.
// 하나라도 없는 재료면 에러이고 아무것도 바뀌지 않습니다. (저장 전에 모두 확인)
// 돌려주는 값: [{ id, name, amount(뺀 양), left(남은 양), status }]
export async function deductIngredients(usedList) {
  const ingredients = await loadIngredients()
  const results = usedList.map(({ id, amount }) => {
    const item = findActive(ingredients, id)
    const used = Math.min(amount, item.quantity)
    const left = item.quantity - used
    return { id, name: item.name, amount: used, left, status: left > 0 ? 'ACTIVE' : 'CONSUMED' }
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

// POST /recipes/{id}/complete 와 같은 모양으로 돌려줍니다. → { cook_log_id, consumed, xp }
// 쓴 재료는 통째로 소진(냉장고에서 빠짐)하고 +10 XP.
// 소진한 재료 중 임박(D-3 이하, 안 지난) 재료가 있으면 '유통기한 내 소진 보너스' +10 XP.
// ingredientIds 를 생략하면 레시피에 매칭된 보유 재료 전부를 소진합니다. (백엔드와 같음)
export async function completeCooking({ recipeId, recipeName, ingredientIds }) {
  const name = recipeName ?? (recipeId ? findRecipe(recipeId).title : '레시피')
  const ids = ingredientIds ?? (recipeId ? await matchedIngredientIds(recipeId) : [])

  const ingredients = await loadIngredients()
  const used = ids.map((id) => toRead(findActive(ingredients, id)))
  await saveIngredients(
    ingredients.map((item) => (ids.includes(item.id) ? { ...item, status: 'CONSUMED' } : item)),
  )

  const savedInTime = used.some((item) => item.is_imminent && item.d_day >= 0)
  const entries = [{ action: 'COOK_COMPLETE', description: `${name} 요리 완료` }]
  if (savedInTime) entries.push({ action: 'EXPIRY_SAVE_BONUS', description: '유통기한 내 소진 보너스' })
  const xp = await awardXp(entries)

  // 실행 취소를 위해 기록을 남깁니다.
  const cookLogs = await loadCookLogs()
  const cookLog = {
    id: nextId(cookLogs),
    recipe_id: recipeId ?? null,
    recipe_title: name,
    xp_awarded: xp.amount,
    counted_actions: entries.map((e) => e.action),
    consumed_ingredient_ids: ids,
    undone_at: null,
  }
  await saveCookLogs([cookLog, ...cookLogs].slice(0, 20))

  return {
    cook_log_id: cookLog.id,
    consumed: used.map((item) => ({
      ingredient_id: item.id,
      name: item.name,
      before_expiry: item.d_day >= 0,
    })),
    xp,
  }
}

// POST /recipes/cook-logs/{id}/undo 와 같은 모양 → { cook_log_id, restored_ingredient_ids, xp_revoked }
// 소진했던 재료를 냉장고로 되돌리고, 받은 XP 를 회수합니다.
export async function undoCooking(cookLogId) {
  const cookLogs = await loadCookLogs()
  const cookLog = cookLogs.find((log) => log.id === cookLogId)
  if (!cookLog) throw new Error('요리 기록을 찾을 수 없습니다.')
  if (cookLog.undone_at) throw new Error('이미 취소한 요리예요.')

  const ingredients = await loadIngredients()
  const restoreIds = cookLog.consumed_ingredient_ids.filter((id) =>
    ingredients.some((item) => item.id === id && item.status === 'CONSUMED'),
  )
  await saveIngredients(
    ingredients.map((item) => (restoreIds.includes(item.id) ? { ...item, status: 'ACTIVE' } : item)),
  )
  await revokeXp({
    amount: cookLog.xp_awarded,
    countedActions: cookLog.counted_actions,
    description: `${cookLog.recipe_title} 요리 완료 취소`,
  })
  await saveCookLogs(
    cookLogs.map((log) =>
      log.id === cookLogId ? { ...log, undone_at: new Date().toISOString() } : log,
    ),
  )

  return {
    cook_log_id: cookLogId,
    restored_ingredient_ids: restoreIds,
    xp_revoked: cookLog.xp_awarded,
  }
}
