// 가짜 모드의 냉장고 재료: 백엔드 ingredients API 와 같게 동작합니다.
import { loadIngredients, nextId, saveIngredients } from './storage.js'
import { findPresetById, findPresetByName, listPresets } from './presets.js'
import { awardXp } from './gamification.js'
import { DEFAULT_SHELF_LIFE_DAYS, IMMINENT_DAYS } from './rules.js'
import { addDays, daysUntil, STORAGE_TYPES, todayString } from '../utils.js'

// GET /ingredients/presets
export async function getPresets(options) {
  return listPresets(options)
}

// GET /ingredients → { total, imminent_count, storage_counts, items(임박순) }
export async function getIngredients() {
  const items = (await loadIngredients())
    .filter((item) => item.status === 'ACTIVE')
    .map(toRead)
    .sort((a, b) => a.expires_on.localeCompare(b.expires_on) || a.id - b.id)
  return {
    total: items.length,
    imminent_count: items.filter((item) => item.is_imminent).length,
    storage_counts: Object.fromEntries(
      STORAGE_TYPES.map((type) => [type, items.filter((item) => item.storage === type).length]),
    ),
    items,
  }
}

// GET /ingredients/{id}
export async function getIngredient(id) {
  return toRead(findActive(await loadIngredients(), id))
}

// POST /ingredients?source=
export async function addIngredient(input, source = 'MANUAL') {
  const ingredients = await loadIngredients()
  const ingredient = build(input, source, nextId(ingredients))
  await saveIngredients([...ingredients, ingredient])
  return toRead(ingredient)
}

// POST /ingredients/batch (source=PHOTO 면 XP 지급)
export async function addIngredientsByPhoto(inputs) {
  const ingredients = await loadIngredients()
  let id = nextId(ingredients)
  const added = inputs.map((input) => build(input, 'PHOTO', id++))
  await saveIngredients([...ingredients, ...added])
  const xp = await awardXp([
    { action: 'PHOTO_REGISTER', description: `사진으로 재료 ${added.length}개 등록` },
  ])
  return { items: added.map(toRead), xp }
}

// PATCH /ingredients/{id}
export async function updateIngredient(id, changes) {
  const ingredients = await loadIngredients()
  findActive(ingredients, id)
  const allowed = pick(changes, ['name', 'quantity', 'unit', 'storage', 'expires_on'])
  const updated = ingredients.map((item) => (item.id === id ? { ...item, ...allowed } : item))
  await saveIngredients(updated)
  return toRead(updated.find((item) => item.id === id))
}

// 재료를 다 먹었을 때: '소진'으로 표시하고 냉장고에서 뺍니다. (XP·통계 없음)
// 백엔드에 요청한 POST /ingredients/{id}/consume 과 같게 동작 (frontend/BACKEND_REQUESTS.md)
export async function consumeIngredient(id) {
  const ingredients = await loadIngredients()
  findActive(ingredients, id)
  await saveIngredients(
    ingredients.map((item) => (item.id === id ? { ...item, status: 'CONSUMED' } : item)),
  )
}

// DELETE /ingredients/{id} (백엔드처럼 지우지 않고 '폐기' 표시)
export async function deleteIngredient(id) {
  const ingredients = await loadIngredients()
  findActive(ingredients, id)
  await saveIngredients(
    ingredients.map((item) => (item.id === id ? { ...item, status: 'DISCARDED' } : item)),
  )
}

// ----- 아래는 가짜 모드 안에서만 쓰는 함수 -----

// 저장된 재료 → 백엔드 IngredientRead 모양 (d_day, is_imminent 계산)
export function toRead(item) {
  const dDay = daysUntil(item.expires_on)
  return {
    id: item.id,
    preset_id: item.preset_id,
    name: item.name,
    icon: findPresetById(item.preset_id)?.icon ?? null,
    quantity: item.quantity,
    unit: item.unit,
    storage: item.storage,
    expires_on: item.expires_on,
    d_day: dDay,
    is_imminent: dDay <= IMMINENT_DAYS,
    status: item.status,
    source: item.source,
  }
}

export function findActive(ingredients, id) {
  const item = ingredients.find((i) => i.id === id && i.status === 'ACTIVE')
  if (!item) throw new Error('재료를 찾을 수 없습니다.')
  return item
}

// 빈 값은 프리셋으로 채웁니다. (백엔드 _build 와 같음)
function build(input, source, id) {
  const preset = (input.preset_id && findPresetById(input.preset_id)) || findPresetByName(input.name)
  if (input.expires_on && input.expires_on < todayString()) {
    throw new Error(`'${input.name}'의 유통기한이 이미 지났습니다.`)
  }
  return {
    id,
    preset_id: preset?.id ?? null,
    name: input.name,
    quantity: input.quantity || preset?.default_quantity || 1,
    unit: input.unit || preset?.default_unit || '개',
    storage: input.storage || preset?.default_storage || 'FRIDGE',
    expires_on:
      input.expires_on || addDays(todayString(), preset?.shelf_life_days ?? DEFAULT_SHELF_LIFE_DAYS),
    status: 'ACTIVE',
    source,
  }
}

function pick(object, keys) {
  return Object.fromEntries(keys.filter((key) => object[key] !== undefined).map((key) => [key, object[key]]))
}
