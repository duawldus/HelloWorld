// 서버 모드: 백엔드 API(backend/README.md, Swagger /docs)를 호출하는 구현.
// mock/index.js 와 똑같은 이름·모양의 함수를 내보냅니다. 돌려주는 값은 백엔드 응답 그대로입니다.
import { imageFormData, request } from './api.js'

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

// POST /ingredients/{id}/consume → '다 먹었어요'(소진, CONSUMED). XP 없음
export const CAN_CONSUME = true
export function consumeIngredient(id) {
  return request(`/ingredients/${id}/consume`, { method: 'POST' })
}

// DELETE /ingredients/{id} → 백엔드에서 '폐기(DISCARDED)'로 표시
export function deleteIngredient(id) {
  return request(`/ingredients/${id}`, { method: 'DELETE' })
}

// POST /ingredients/deduct → 재료 수량 차감 (XP 없음). 여러 개를 요청 한 번으로 처리
// 남은 양이 0이 되면 소진(CONSUMED). 하나라도 없는 재료면 404 이고 아무것도 바뀌지 않음
// 돌려주는 값: [{ id, name, amount(뺀 양), left(남은 양), status }]
export async function deductIngredients(usedList) {
  const { items } = await request('/ingredients/deduct', {
    method: 'POST',
    body: { items: usedList.map(({ id, amount }) => ({ id, amount })) },
  })
  return items
}

// ----- 레시피 -----

// GET /recipes/recommendations?imminent_first=&max_minutes=&servings=&limit=
// → { basis_ingredient_count, ready(바로 가능), almost(1~2개 부족) }  (백엔드 추천 알고리즘 준비 중 → 501)
export function getRecipeRecommendations({ imminent_first = true, max_minutes, servings, limit } = {}) {
  return request('/recipes/recommendations', {
    query: { imminent_first, max_minutes, servings, limit },
  })
}

// GET /recipes/{id} → 재료 체크리스트(보유/부족/대체재) + 조리 순서
export function getRecipe(id) {
  return request(`/recipes/${id}`)
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

// POST /recipes/cook-logs/{cookLogId}/undo → { cook_log_id, restored_ingredient_ids, xp_revoked }
// 요리 완료 실행 취소 (백엔드 아직 준비 중 → 501)
export function undoCooking(cookLogId) {
  return request(`/recipes/cook-logs/${cookLogId}/undo`, { method: 'POST' })
}

// ----- 생활 알림 -----

// GET /reminders → { enabled_count, next_reminder, groups: [{ category, items }] }
export function getReminders() {
  return request('/reminders')
}

// GET /reminders/{id}
export function getReminder(id) {
  return request(`/reminders/${id}`)
}

// POST /reminders (ReminderCreate)
export function addReminder(input) {
  return request('/reminders', { method: 'POST', body: input })
}

// PATCH /reminders/{id} (부분 수정 / 켜고 끄기 { enabled: false })
export function updateReminder(id, changes) {
  return request(`/reminders/${id}`, { method: 'PATCH', body: changes })
}

// DELETE /reminders/{id}
export function deleteReminder(id) {
  return request(`/reminders/${id}`, { method: 'DELETE' })
}

// POST /reminders/{reminderId}/complete → { reminder, xp }  (+5 XP)
export async function completeChore({ reminderId }) {
  if (!reminderId) throw new Error('서버 모드에서는 reminderId 가 필요해요.')
  return request(`/reminders/${reminderId}/complete`, { method: 'POST' })
}

// ----- 푸시 알림 -----

// POST /notifications/devices  { token: 'ExponentPushToken[...]', platform: 'IOS' | 'ANDROID' | 'WEB' }
export function registerPushDevice(token, platform) {
  return request('/notifications/devices', { method: 'POST', body: { token, platform } })
}

// DELETE /notifications/devices/{token}
export function unregisterPushDevice(token) {
  return request(`/notifications/devices/${encodeURIComponent(token)}`, { method: 'DELETE' })
}

// ----- 성과 -----

// 연속 기록 갱신·뱃지 지급 모두 백엔드에 구현됨 (backend 0a19176)
export const STREAK_READY = true
export const BADGES_READY = true

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

// ----- 기본 양념 · 온보딩 -----

// GET /users/me 의 onboarded
export async function isOnboarded() {
  return (await request('/users/me')).onboarded
}

// GET /users/me/seasonings → [{ id, name, icon, owned }]
export function getSeasonings() {
  return request('/users/me/seasonings')
}

// PUT /users/me/seasonings (보유 양념 전체 교체 + 온보딩 완료)
export function saveSeasonings(seasoningIds) {
  return request('/users/me/seasonings', { method: 'PUT', body: { seasoning_ids: seasoningIds } })
}

// ----- 사진 인식 -----

// POST /vision/recognize (multipart 'image') → { count, items }
export async function recognizeIngredients(photo) {
  return request('/vision/recognize', { method: 'POST', form: await imageFormData('image', photo) })
}

// ----- 기타 -----

// 서버 모드는 아무것도 지우지 않습니다. (서버 데이터와 기기 번호 모두 그대로)
// 기기 번호를 지우면 서버에서 새 사용자로 바뀌어서 일부러 두었습니다.
export async function resetAllData() {}
