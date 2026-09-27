// 데이터 기능은 모두 여기서 가져다 쓰세요. 사용법은 frontend/USAGE.md
// 예) import { getIngredients, completeCooking } from '../data'
//
// config.js 의 DATA_MODE 에 따라 가짜 모드(mock/) 또는 서버 모드(server/) 구현을 연결합니다.
// 두 모드는 함수 이름과 돌려주는 모양이 같아서, 화면 코드는 모드를 몰라도 됩니다.
// 모든 함수는 async 이고, 실패하면 에러를 던집니다. (error.message 를 화면에 보여 주면 됨)
import { DATA_MODE, DEV_ALWAYS_SHOW_ONBOARDING } from './config.js'
import * as mock from './mock/index.js'
import * as server from './server/index.js'
import { LEVELS } from './mock/rules.js'

const impl = DATA_MODE === 'server' ? server : mock

export const IS_SERVER_MODE = DATA_MODE === 'server'

// 재료
export const getPresets = (...args) => impl.getPresets(...args)
export const getIngredients = (...args) => impl.getIngredients(...args)
export const getIngredient = (...args) => impl.getIngredient(...args)
export const addIngredient = (...args) => impl.addIngredient(...args)
export const addIngredientsByPhoto = (...args) => impl.addIngredientsByPhoto(...args)
export const updateIngredient = (...args) => impl.updateIngredient(...args)
export const consumeIngredient = (...args) => impl.consumeIngredient(...args) // 다 먹었어요 (소진)
export const deleteIngredient = (...args) => impl.deleteIngredient(...args) // 버렸어요 (폐기)
export const CAN_CONSUME = impl.CAN_CONSUME // 서버 모드는 백엔드 소진 API가 생기기 전까지 false
export const deductIngredients = (...args) => impl.deductIngredients(...args)

// 레시피 (추천 · 상세)
export const getRecipeRecommendations = (...args) => impl.getRecipeRecommendations(...args)
export const getRecipe = (...args) => impl.getRecipe(...args)

// XP 를 얻는 행동
export const completeCooking = (...args) => impl.completeCooking(...args)
export const undoCooking = (...args) => impl.undoCooking(...args) // 요리 완료 실행 취소
export const completeChore = (...args) => impl.completeChore(...args)

// 성과 (레벨·XP·연속 기록, 뱃지, XP 기록)
export const getStats = (...args) => impl.getStats(...args)
export const getBadges = (...args) => impl.getBadges(...args)
export const getXpLogs = (...args) => impl.getXpLogs(...args)

export const STREAK_READY = impl.STREAK_READY // 연속 기록 값을 믿고 보여 줘도 되는지
export const BADGES_READY = impl.BADGES_READY // 뱃지 획득 여부를 믿고 보여 줘도 되는지

// 레벨 진행 바: 지금 레벨 안에서 얼마나 찼는지 (0~1). 최고 레벨이면 1
// 백엔드 응답(getStats)에 '현재 레벨 시작 XP'가 없어서 백엔드와 같은 레벨 표(mock/rules.js)로 계산합니다.
// (요청서에 level_min_xp 추가를 요청함. 생기면 그 값을 쓰도록 바꾸기)
export function getLevelProgress(stats) {
  if (stats.next_level_xp === null) return 1
  const levelMinXp = stats.level_min_xp ?? LEVELS.find(([level]) => level === stats.level)?.[1] ?? 0
  const range = stats.next_level_xp - levelMinXp
  return range > 0 ? Math.min(1, Math.max(0, (stats.xp - levelMinXp) / range)) : 0
}

// 사진 인식
export const recognizeIngredients = (...args) => impl.recognizeIngredients(...args)

// 기본 양념 (온보딩). 냉장고 재료 목록과는 따로 저장돼요.
export const getSeasonings = (...args) => impl.getSeasonings(...args) // 전체 + owned
// 레시피 매칭용 '보유 양념'만 → [{ id, name, icon }]
export const getOwnedSeasonings = async () =>
  (await impl.getSeasonings())
    .filter((seasoning) => seasoning.owned)
    .map(({ id, name, icon }) => ({ id, name, icon }))

// 온보딩 완료 여부는 앱을 켠 동안 한 번만 확인해서 기억해 둡니다.
let onboardedCache = null

export async function isOnboarded() {
  if (onboardedCache === null) {
    onboardedCache = DEV_ALWAYS_SHOW_ONBOARDING ? false : await impl.isOnboarded()
  }
  return onboardedCache
}

// 보유 양념 저장 (전체 교체) + 온보딩 완료 처리
export async function saveSeasonings(seasoningIds) {
  const result = await impl.saveSeasonings(seasoningIds)
  onboardedCache = true
  return result
}

// 테스트용: 가짜 모드는 더미 데이터로 초기화(온보딩도 다시), 서버 모드는 로그인 토큰만 지움
export async function resetAllData() {
  onboardedCache = null
  await impl.resetAllData()
}

// 두 모드 공통 도구
export {
  STORAGE_TYPES,
  storageLabel,
  difficultyLabel,
  matchesName,
  todayString,
  addDays,
  daysUntil,
  withJosa,
  relativeDayLabel,
  summarizeXpLogs,
  formatXpTitle,
} from './utils.js'
