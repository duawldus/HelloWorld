// 가짜 모드: 서버 없이 폰(브라우저) 안에 저장하는 구현.
// server/index.js 와 똑같은 이름·모양의 함수를 내보냅니다.
export {
  getPresets,
  getIngredients,
  getIngredient,
  addIngredient,
  addIngredientsByPhoto,
  updateIngredient,
  deleteIngredient,
} from './ingredients.js'
export { deductIngredients, completeCooking, completeChore } from './actions.js'
export { getStats, getBadges, getXpLogs } from './gamification.js'
export { recognizeIngredients } from './vision.js'
export { resetAllData } from './storage.js'
