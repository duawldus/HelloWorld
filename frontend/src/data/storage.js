// ⭐ 데이터 저장/불러오기는 이 파일에서만 합니다.
// 지금은 폰(또는 브라우저) 안의 AsyncStorage 에 저장하고,
// 나중에 백엔드가 생기면 이 파일의 함수 안쪽만 API 호출(fetch)로 바꾸면 됩니다.
//   예) loadIngredients → return (await fetch(`${API_URL}/ingredients`)).json()
// 함수가 모두 async 라서, 바꾼 뒤에도 쓰는 쪽 코드는 그대로입니다.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createDummyIngredients, createDummyProgress } from './dummyData.js'
import { addDays, daysBetween, todayString } from './utils.js'

// 더미 데이터(dummyData.js)를 바꾸면 이 숫자를 1 올리세요.
// 예전 버전이 저장된 기기는 앱을 켤 때 새 더미 데이터로 초기화됩니다.
const DATA_VERSION = 3

// true 면 날짜를 '오늘' 기준으로 유지합니다. (발표·테스트용)
// 저장된 유통기한·등록일·연속 기록 날짜를 지난 날짜만큼 뒤로 옮겨서,
// 며칠 뒤에 켜도 D-day 와 연속 기록이 처음과 똑같이 보입니다.
// 실제 서비스(백엔드 연결)에서는 false 로 바꾸세요.
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

// XP·연속 기록·통계·XP 기록
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
      ingredients.map((item) => ({
        ...item,
        expiryDate: addDays(item.expiryDate, days),
        registeredDate: addDays(item.registeredDate, days),
      })),
    )
  }
  const progress = await read(KEYS.progress)
  if (progress) {
    await write(KEYS.progress, {
      ...progress,
      streak: { ...progress.streak, lastXpDate: addDays(progress.streak.lastXpDate, days) },
      history: progress.history.map((entry) => ({ ...entry, date: shiftTime(entry.date, days) })),
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
