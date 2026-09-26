// 서버 모드: 백엔드 API(backend/README.md, Swagger /docs)를 호출하는 구현.
// mock/index.js 와 똑같은 이름·모양의 함수를 내보냅니다. 돌려주는 값은 백엔드 응답 그대로입니다.
import { clearToken, imageFormData, request } from './api.js'

// ----- 재료 -----

// GET /ingredients/presets?frequent=&q=
export function getPresets({ frequent = false, q } = {}) {
  return request('/ingredients/presets', { query: { frequent, q } })
}

// GET /ingredients → { total, imminent_count, storage_counts, items(임박순) }
export function getIngredients() {
  return request('/ingredients')
}

// GET /ingredients/{id}
export function getIngredient(id) {
  return request(`/ingredients/${id}`)
}

// POST /ingredients?source=   source: 'PRESET' | 'MANUAL' | 'PHOTO'
export function addIngredient(input, source = 'MANUAL') {
  return request('/ingredients', { method: 'POST', query: { source }, body: input })
}

// POST /ingredients/batch (source=PHOTO → XP 지급) → { items, xp }
export function addIngredientsByPhoto(inputs) {
  return request('/ingredients/batch', { method: 'POST', body: { source: 'PHOTO', items: inputs } })
}

// PATCH /ingredients/{id}
export function updateIngredient(id, changes) {
  return request(`/ingredients/${id}`, { method: 'PATCH', body: changes })
}

// DELETE /ingredients/{id}
export function deleteIngredient(id) {
  return request(`/ingredients/${id}`, { method: 'DELETE' })
}

// 재료 수량 차감 (XP 없음). 백엔드에 차감 API가 따로 없어서
// 남은 양이 있으면 PATCH 로 수량을 바꾸고, 0 이하가 되면 DELETE 합니다.
// 돌려주는 값: [{ id, name, amount(뺀 양), left(남은 양) }]
export async function deductIngredients(usedList) {
  const results = []
  for (const { id, amount } of usedList) {
    const item = await getIngredient(id)
    const used = Math.min(amount, item.quantity)
    const left = item.quantity - used
    if (left > 0) await updateIngredient(id, { quantity: left })
    else await deleteIngredient(id)
    results.push({ id, name: item.name, amount: used, left })
  }
  return results
}

// ----- XP 행동 -----

// POST /recipes/{recipeId}/complete → { cook_log_id, consumed, xp }
// ingredientIds 를 생략하면 레시피에 맞는 보유 재료 전부를 소진합니다. (백엔드 아직 준비 중 → 501)
export function completeCooking({ recipeId, ingredientIds }) {
  return request(`/recipes/${recipeId}/complete`, {
    method: 'POST',
    body: ingredientIds ? { ingredient_ids: ingredientIds } : {},
  })
}

// POST /reminders/{reminderId}/complete → { reminder, xp }
export function completeChore({ reminderId }) {
  return request(`/reminders/${reminderId}/complete`, { method: 'POST' })
}

// ----- 성과 -----

// GET /gamification/stats
export function getStats() {
  return request('/gamification/stats')
}

// GET /gamification/badges
export function getBadges() {
  return request('/gamification/badges')
}

// GET /gamification/xp-logs?limit=
export function getXpLogs(limit = 20) {
  return request('/gamification/xp-logs', { query: { limit } })
}

// ----- 사진 인식 -----

// POST /vision/recognize (multipart 'image') → { count, items }
export async function recognizeIngredients(photo) {
  return request('/vision/recognize', { method: 'POST', form: await imageFormData('image', photo) })
}

// ----- 기타 -----

// 서버 데이터는 지우지 않고, 로그인 토큰만 지웁니다.
export async function resetAllData() {
  await clearToken()
}
