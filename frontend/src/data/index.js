// 데이터 기능은 모두 여기서 가져다 쓰세요. 사용법은 frontend/USAGE.md
// 예) import { getIngredients, completeCooking } from '../data'
//
// config.js 의 DATA_MODE 에 따라 가짜 모드(mock/) 또는 서버 모드(server/) 구현을 연결합니다.
// 두 모드는 함수 이름과 돌려주는 모양이 같아서, 화면 코드는 모드를 몰라도 됩니다.
// 모든 함수는 async 이고, 실패하면 에러를 던집니다. (error.message 를 화면에 보여 주면 됨)
import { DATA_MODE, DEV_ALWAYS_SHOW_ONBOARDING } from './config.js'
import * as mock from './mock/index.js'
import * as server from './server/index.js'

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

// XP 를 얻는 행동
export const completeCooking = (...args) => impl.completeCooking(...args)
export const completeChore = (...args) => impl.completeChore(...args)

// 성과 (레벨·XP·연속 기록, 뱃지, XP 기록)
export const getStats = (...args) => impl.getStats(...args)
export const getBadges = (...args) => impl.getBadges(...args)
export const getXpLogs = (...args) => impl.getXpLogs(...args)

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
  matchesName,
  todayString,
  addDays,
  daysUntil,
  withJosa,
} from './utils.js'
