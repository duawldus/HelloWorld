// 데이터 기능은 모두 여기서 가져다 쓰세요.
// 예) import { getIngredients, completeCooking } from '../data'

export {
  getIngredients,
  addIngredient,
  updateIngredient,
  deleteIngredient,
  deductIngredients,
  getDaysLeft,
  isExpiringSoon,
  isExpired,
} from './ingredients.js'

export { completeCooking, completeChore, addIngredientsByPhoto } from './actions.js'

export { getProgress, getLevelInfo } from './progress.js'

export { resetAllData } from './storage.js'

export {
  INGREDIENT_PRESETS,
  STORAGE_TYPES,
  FREQUENT_INGREDIENTS,
  findPreset,
  searchPresets,
} from './presets.js'

export { matchesName, todayString, addDays } from './utils.js'

export { XP_RULES, LEVELS, BADGES, EXPIRING_SOON_DAYS } from './rules.js'
