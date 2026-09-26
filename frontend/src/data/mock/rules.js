// 가짜 모드에서만 쓰는 규칙. 서버 모드에서는 백엔드가 계산합니다.
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
export const BADGES = [
  { id: 1, code: 'FRIDGE_CLEANER', name: '냉장고 클린러', description: '유통기한 내 재료 소진 10회', icon: '🧹', condition: 'SAVED_BEFORE_EXPIRY', threshold: 10 },
  { id: 2, code: 'HOME_COOK_MASTER', name: '집밥 마스터', description: '요리 완료 10회', icon: '🍳', condition: 'COOK_COUNT', threshold: 10 },
  { id: 3, code: 'STREAK_7', name: '7일 연속 기록', description: '7일 연속 관리', icon: '🔥', condition: 'STREAK_DAYS', threshold: 7 },
  { id: 4, code: 'STREAK_30', name: '30일 연속', description: '30일 연속 관리', icon: '🏆', condition: 'STREAK_DAYS', threshold: 30 },
  { id: 5, code: 'RECIPE_20', name: '레시피 20개 완성', description: '요리 완료 20회', icon: '📖', condition: 'COOK_COUNT', threshold: 20 },
  { id: 6, code: 'PHOTO_10', name: '사진 등록 10회', description: '사진으로 재료 등록 10회', icon: '📸', condition: 'PHOTO_REGISTER_COUNT', threshold: 10 },
]

// 절약 추정 식비: 제때 소진 1회당 (백엔드 gamification/service.py 의 가정)
export const SAVED_MONEY_PER_SAVE = 2300
