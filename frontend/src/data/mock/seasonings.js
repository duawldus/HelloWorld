// 가짜 모드의 기본 양념 · 온보딩. 백엔드 users API 와 같게 동작합니다.
// 양념 목록은 백엔드 backend/app/seeds/data.py 의 SEASONINGS 와 같은 값입니다.
import { loadSeasoningState, saveSeasoningState } from './storage.js'

// [이름, 아이콘] — 온보딩 순서대로. id 는 1부터
const SEASONINGS = [
  ['간장', '🫙'],
  ['식용유', '🛢️'],
  ['소금', '🧂'],
  ['후추', '🌶️'],
  ['설탕', '🍬'],
  ['고추장', '🥫'],
  ['된장', '🥣'],
  ['참기름', '🫗'],
  ['고춧가루', '🌶️'],
  ['다진마늘', '🧄'],
  ['마요네즈', '🥚'],
  ['케첩', '🍅'],
].map(([name, icon], index) => ({ id: index + 1, name, icon }))

// GET /users/me 의 onboarded
export async function isOnboarded() {
  return (await loadSeasoningState()).onboarded
}

// GET /users/me/seasonings → [{ id, name, icon, owned }]
export async function getSeasonings() {
  const { owned_ids } = await loadSeasoningState()
  return SEASONINGS.map((s) => ({ ...s, owned: owned_ids.includes(s.id) }))
}

// PUT /users/me/seasonings (보유 양념 전체 교체 + 온보딩 완료)
export async function saveSeasonings(seasoningIds) {
  const invalid = seasoningIds.filter((id) => !SEASONINGS.some((s) => s.id === id))
  if (invalid.length > 0) throw new Error(`존재하지 않는 양념 ID: ${invalid.join(', ')}`)
  await saveSeasoningState({ onboarded: true, owned_ids: [...new Set(seasoningIds)] })
  return getSeasonings()
}
