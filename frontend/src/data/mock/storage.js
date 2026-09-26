// ⭐ 가짜 모드의 저장/불러오기는 이 파일에서만 합니다.
// 폰(또는 브라우저) 안의 AsyncStorage 에 저장합니다. 서버 모드에서는 쓰지 않습니다.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createDummyIngredients, createDummyProgress } from './dummyData.js'
import { addDays, daysBetween, todayString } from '../utils.js'

// 더미 데이터(dummyData.js)나 저장 모양을 바꾸면 이 숫자를 1 올리세요.
// 예전 버전이 저장된 기기는 앱을 켤 때 새 더미 데이터로 초기화됩니다.
const DATA_VERSION = 4

// true 면 날짜를 '오늘' 기준으로 유지합니다. (발표·테스트용)
// 저장된 유통기한·연속 기록·XP 기록 날짜를 지난 날짜만큼 뒤로 옮겨서,
// 며칠 뒤에 켜도 D-day 와 연속 기록이 처음과 똑같이 보입니다.
const KEEP_DATES_FROM_TODAY = true

const KEYS = {
  ingredients: 'bangguseok.ingredients',
  progress: 'bangguseok.progress',
  meta: 'bangguseok.meta', // { version, baseDate }
}

// 재료 목록
export async function loadIngredients() {
  await ensurePrepared()
  return readOrCreate(KEYS.ingredients, createDummyIngredients)
}

export async function saveIngredients(ingredients) {
  await write(KEYS.ingredients, ingredients)
}

// XP·연속 기록·행동 횟수·뱃지·XP 기록
export async function loadProgress() {
  await ensurePrepared()
  return readOrCreate(KEYS.progress, createDummyProgress)
}

export async function saveProgress(progress) {
  await write(KEYS.progress, progress)
}

// 저장된 데이터를 지우고 더미 데이터로 다시 시작 (테스트용)
export async function resetAllData() {
  await write(KEYS.ingredients, createDummyIngredients())
  await write(KEYS.progress, createDummyProgress())
  await write(KEYS.meta, { version: DATA_VERSION, baseDate: todayString() })
}

// 목록에서 다음 숫자 id (서버처럼 1, 2, 3 ...)
export function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1
}

// 여러 화면이 동시에 불러와도 준비 작업은 한 번만 돌도록 묶어 둡니다.
let preparing = null
function ensurePrepared() {
  if (!preparing) preparing = prepareData().finally(() => (preparing = null))
  return preparing
}

// 불러오기 전에: 예전 버전이면 초기화하고, 날짜가 바뀌었으면 오늘 기준으로 옮깁니다.
async function prepareData() {
  const meta = await read(KEYS.meta)
  if (meta?.version !== DATA_VERSION) {
    await resetAllData()
    return
  }

  const today = todayString()
  if (!KEEP_DATES_FROM_TODAY || meta.baseDate === today) return

  const days = daysBetween(meta.baseDate, today)
  const ingredients = await read(KEYS.ingredients)
  if (ingredients) {
    await write(
      KEYS.ingredients,
      ingredients.map((item) => ({ ...item, expires_on: addDays(item.expires_on, days) })),
    )
  }
  const progress = await read(KEYS.progress)
  if (progress) {
    await write(KEYS.progress, {
      ...progress,
      streak: { ...progress.streak, lastXpDate: addDays(progress.streak.lastXpDate, days) },
      logs: progress.logs.map((log) => ({ ...log, created_at: shiftTime(log.created_at, days) })),
      badges: Object.fromEntries(
        Object.entries(progress.badges).map(([code, at]) => [code, shiftTime(at, days)]),
      ),
    })
  }
  await write(KEYS.meta, { ...meta, baseDate: today })
}

function shiftTime(isoString, days) {
  const date = new Date(isoString)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

async function readOrCreate(key, createDefault) {
  const saved = await read(key)
  if (saved) return saved
  const initial = createDefault()
  await write(key, initial)
  return initial
}

async function read(key) {
  try {
    const saved = await AsyncStorage.getItem(key)
    return saved ? JSON.parse(saved) : null
  } catch {
    // 저장된 값이 깨졌거나 저장소를 못 쓰면 없는 것으로 봄
    return null
  }
}

async function write(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장이 막히면 무시 (화면은 계속 동작)
  }
}
