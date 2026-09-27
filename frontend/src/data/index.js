// 데이터 기능은 모두 여기서 가져다 쓰세요. 사용법은 frontend/USAGE.md
// 예) import { getIngredients, completeCooking } from '../data'
//
// config.js 의 DATA_MODE 에 따라 가짜 모드(mock/) 또는 서버 모드(server/) 구현을 연결합니다.
// 두 모드는 함수 이름과 돌려주는 모양이 같아서, 화면 코드는 모드를 몰라도 됩니다.
// 모든 함수는 async 이고, 실패하면 에러를 던집니다. (error.message 를 화면에 보여 주면 됨)
import { DATA_MODE, DEV_ALWAYS_SHOW_ONBOARDING, PUSH_SOURCE } from './config.js'
import * as mock from './mock/index.js'
import * as server from './server/index.js'
import { IMMINENT_DAYS, LEVELS, XP_TABLE } from './mock/rules.js'

const impl = DATA_MODE === 'server' ? server : mock

export const IS_SERVER_MODE = DATA_MODE === 'server'
export { DEV_SKIP_SPLASH } from './config.js' // 스플래시 1.5초 기다리기 끄기 (개발용)
export { PUSH_SOURCE } // 푸시 알림을 앱이 예약('local')할지 백엔드가 보낼지('server')

// D-3 이하를 '임박'으로 봅니다. (백엔드 IMMINENT_DAYS 와 같은 값)
export { IMMINENT_DAYS }

// 집안일 완료 XP (버튼에 '+5 XP' 로 보여 줄 때). 백엔드 rules.py 와 같은 값
export const CHORE_XP = XP_TABLE.CHORE_COMPLETE

// ----- 데이터가 바뀌면 알려 주기 -----
// 재료·알림이 바뀌면 등록한 함수를 불러 줍니다. (푸시 알림 예약을 다시 맞출 때 씀: src/notifications)
// 예) const stop = onDataChange(() => { ... }) → 그만 들으려면 stop()
const changeListeners = new Set()

export function onDataChange(listener) {
  changeListeners.add(listener)
  return () => changeListeners.delete(listener)
}

// 데이터를 바꾸는 함수: 성공하면 onDataChange 에 등록한 함수들을 불러 줍니다.
const changing =
  (name) =>
  async (...args) => {
    const result = await impl[name](...args)
    changeListeners.forEach((listener) => listener(name))
    return result
  }

// 재료
export const getPresets = (...args) => impl.getPresets(...args)
export const getIngredients = (...args) => impl.getIngredients(...args)
export const getIngredient = (...args) => impl.getIngredient(...args)
export const addIngredient = changing('addIngredient')
export const addIngredientsByPhoto = changing('addIngredientsByPhoto')
export const updateIngredient = changing('updateIngredient')
export const consumeIngredient = changing('consumeIngredient') // 다 먹었어요 (소진)
export const deleteIngredient = changing('deleteIngredient') // 버렸어요 (폐기)
export const CAN_CONSUME = impl.CAN_CONSUME // 서버 모드는 백엔드 소진 API가 생기기 전까지 false
export const deductIngredients = changing('deductIngredients')

// 레시피 (추천 · 상세)
export const getRecipeRecommendations = (...args) => impl.getRecipeRecommendations(...args)
export const getRecipe = (...args) => impl.getRecipe(...args)

// XP 를 얻는 행동
export const completeCooking = changing('completeCooking')
export const undoCooking = changing('undoCooking') // 요리 완료 실행 취소
export const completeChore = changing('completeChore') // 집안일 완료 (+5 XP)

// 생활 알림 (세탁·청소·공과금). 모양은 USAGE.md 7번
export const getReminders = (...args) => impl.getReminders(...args)
export const getReminder = (...args) => impl.getReminder(...args)
export const addReminder = changing('addReminder')
export const updateReminder = changing('updateReminder') // 켜고 끄기는 updateReminder(id, { enabled: false })
export const deleteReminder = changing('deleteReminder')

// 푸시 알림 기기 등록 (서버 모드에서 백엔드가 푸시를 보낼 때 씀. 가짜 모드는 아무것도 안 함)
export const registerPushDevice = (...args) => impl.registerPushDevice(...args)
export const unregisterPushDevice = (...args) => impl.unregisterPushDevice(...args)

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
// 스플래시와 탭 화면이 동시에 물어도 서버 요청은 한 번만 갑니다. (실패하면 다음에 다시 확인)
let onboardedPromise = null

export function isOnboarded() {
  if (!onboardedPromise) {
    onboardedPromise = DEV_ALWAYS_SHOW_ONBOARDING
      ? Promise.resolve(false)
      : impl.isOnboarded().catch((error) => {
          onboardedPromise = null
          throw error
        })
  }
  return onboardedPromise
}

// 보유 양념 저장 (전체 교체) + 온보딩 완료 처리
export async function saveSeasonings(seasoningIds) {
  const result = await impl.saveSeasonings(seasoningIds)
  onboardedPromise = Promise.resolve(true)
  return result
}

// 테스트용: 가짜 모드는 더미 데이터로 초기화(온보딩도 다시), 서버 모드는 아무것도 지우지 않음. 기기 번호는 두 모드 모두 그대로
export async function resetAllData() {
  onboardedPromise = null
  await impl.resetAllData()
  changeListeners.forEach((listener) => listener('resetAllData'))
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
  scaleAmount,
  MAX_SERVINGS,
  relativeDayLabel,
  summarizeXpLogs,
  formatXpTitle,
} from './utils.js'

// 생활 알림 규칙 도구 (반복 요약 문구, 다음 날짜 계산, 화면 표시용)
export {
  REMINDER_CATEGORIES,
  REPEAT_TYPES,
  WEEKDAY_LABELS,
  categoryLabel,
  repeatRuleLabel,
  reminderSummary,
  formatRemindTime,
  parseTime,
  toTimeString,
  dueLabel,
  formatNotifyTime,
  upcomingNotifications,
  parseLocalIso,
} from './reminderSchedule.js'
