// 가짜 모드에서만 쓰는 규칙. 서버 모드에서는 백엔드가 계산합니다.
// ✅ XP·레벨은 백엔드 기준으로 확정 (2026-09-26 팀장 결정). 프론트에서 따로 바꾸지 않습니다.
// 값은 백엔드와 같게 맞춰 둡니다. 백엔드 값이 바뀌면 여기도 같이 고쳐 주세요.
//   XP·레벨·뱃지 조건: backend/app/features/gamification/rules.py
//   뱃지 목록:         backend/app/seeds/data.py 의 BADGES
//   임박·인식 기준:     backend/app/common/config.py

// D-3 이하를 '임박'으로 봅니다. (IMMINENT_DAYS)
export const IMMINENT_DAYS = 3

// 프리셋에 없는 재료의 기본 유통기한(일) (DEFAULT_SHELF_LIFE_DAYS)
export const DEFAULT_SHELF_LIFE_DAYS = 7

// 사진 인식 신뢰도가 이 값 미만이면 needs_review=true → 주황 표시 (AI_LOW_CONFIDENCE)
export const AI_LOW_CONFIDENCE = 0.8

// 행동별 XP (XP_TABLE)
export const XP_TABLE = {
  COOK_COMPLETE: 10, // 레시피 요리 완료
  EXPIRY_SAVE_BONUS: 10, // 유통기한 임박 재료를 제때 소진하면 추가
  PHOTO_REGISTER: 15, // 사진으로 재료 등록 (재료 개수와 상관없이 한 번에)
  INGREDIENT_REGISTER: 0, // 아이콘·직접 입력 등록
  CHORE_COMPLETE: 5, // 집안일 완료
}

// [레벨, 필요 누적 XP, 칭호] (LEVELS)
export const LEVELS = [
  [1, 0, '자취 새내기'],
  [2, 100, '냉장고 탐험가'],
  [3, 200, '알뜰 자취러'],
  [4, 390, '집밥 요리사'],
  [5, 600, '자취 고수'],
  [6, 900, '방구석 마스터'],
]

// 뱃지. condition 으로 진행 수치를 세고, threshold 이상이면 획득
// (백엔드 seeds 는 '냉장고 클린러'로 오타 → 수정 요청함: frontend/BACKEND_REQUESTS.md)
export const BADGES = [
  { id: 1, code: 'FRIDGE_CLEANER', name: '냉장고 클리너', description: '유통기한 내 재료 소진 10회', icon: '🧹', condition: 'SAVED_BEFORE_EXPIRY', threshold: 10 },
  { id: 2, code: 'HOME_COOK_MASTER', name: '집밥 마스터', description: '요리 완료 10회', icon: '🍳', condition: 'COOK_COUNT', threshold: 10 },
  { id: 3, code: 'STREAK_7', name: '7일 연속 기록', description: '7일 연속 관리', icon: '🔥', condition: 'STREAK_DAYS', threshold: 7 },
  { id: 4, code: 'STREAK_30', name: '30일 연속', description: '30일 연속 관리', icon: '🏆', condition: 'STREAK_DAYS', threshold: 30 },
  { id: 5, code: 'RECIPE_20', name: '레시피 20개 완성', description: '요리 완료 20회', icon: '📖', condition: 'COOK_COUNT', threshold: 20 },
  { id: 6, code: 'PHOTO_10', name: '사진 등록 10회', description: '사진으로 재료 등록 10회', icon: '📸', condition: 'PHOTO_REGISTER_COUNT', threshold: 10 },
]

// 절약 추정 식비 (백엔드 INGREDIENT_PRICES): '유통기한 내 소진 보너스'를 받은 요리에서
// 임박 재료(D-0~D-3) 값의 합계를 '버리지 않고 아낀 돈'으로 봅니다. 값은 요리 1번에 쓰는 양 기준(원)
export const DEFAULT_INGREDIENT_PRICE = 2300 // 목록에 없는 재료
export const INGREDIENT_PRICES = {
  계란: 1000, // 2개
  두부: 1500,
  대파: 1000,
  쪽파: 1000,
  양파: 700,
  감자: 800,
  당근: 700,
  애호박: 1500,
  버섯: 1500,
  콩나물: 1200,
  고추: 500,
  마늘: 500,
  우유: 1500,
  치즈: 1000,
  김치: 1500,
  어묵: 1500,
  떡: 1500,
  밥: 1000,
  라면: 1000,
  스팸: 3500,
  햄: 2500,
  소시지: 2500,
  참치캔: 2500,
  냉동만두: 3000,
  돼지고기: 5000,
  닭가슴살: 3000,
  소고기: 8000,
}

export function ingredientPrice(name) {
  return INGREDIENT_PRICES[name] ?? DEFAULT_INGREDIENT_PRICE
}

// 레벨 힌트 (백엔드 level_hint): 임박 재료로 요리 1번 = 요리 완료 + 소진 보너스 XP
const XP_PER_SAVE_COOK = XP_TABLE.COOK_COMPLETE + XP_TABLE.EXPIRY_SAVE_BONUS

// 150 → '임박 재료로 8번만 더 요리하면 달성!', 만렙(null) → null
export function levelHint(xpToNextLevel) {
  if (xpToNextLevel === null) return null
  const times = Math.max(1, Math.ceil(xpToNextLevel / XP_PER_SAVE_COOK))
  return `임박 재료로 ${times}번만 더 요리하면 달성!`
}
