// 가짜 모드: 서버 없이 폰(브라우저) 안에 저장하는 구현.
// server/index.js 와 똑같은 이름·모양의 함수를 내보냅니다.
export {
  getPresets,
  getIngredients,
  getIngredient,
  addIngredient,
  addIngredientsByPhoto,
  updateIngredient,
  consumeIngredient,
  deleteIngredient,
} from './ingredients.js'

// 이 모드에서 쓸 수 있는 기능 (서버 모드는 백엔드가 준비될 때까지 false)
export const CAN_CONSUME = true // '다 먹었어요'(소진)
export const STREAK_READY = true // 연속 기록
export const BADGES_READY = true // 뱃지 획득
export { deductIngredients, completeCooking, undoCooking, completeChore } from './actions.js'
export { getRecipeRecommendations, getRecipe } from './recipes.js'
export { getStats, getBadges, getXpLogs } from './gamification.js'
export { recognizeIngredients } from './vision.js'
export { isOnboarded, getSeasonings, saveSeasonings } from './seasonings.js'
export { resetAllData } from './storage.js'
