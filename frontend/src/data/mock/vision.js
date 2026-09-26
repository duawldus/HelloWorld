// 가짜 모드의 사진 속 재료 인식. 백엔드의 AI_MOCK 결과와 같은 값을 돌려줍니다.
// 서버 모드에서는 POST /api/v1/vision/recognize 로 사진을 보냅니다. (server/index.js)
import { findPresetByName } from './presets.js'
import { AI_LOW_CONFIDENCE, DEFAULT_SHELF_LIFE_DAYS } from './rules.js'
import { addDays, todayString } from '../utils.js'

const FAKE_DELAY_MS = 1500 // AI가 생각하는 시간처럼 보이게

// 돌려주는 모양: 백엔드 RecognizeResponse
// { count, items: [{ name, preset_id, quantity, unit, storage, expires_on, confidence(0~1), needs_review }] }
export async function recognizeIngredients() {
  await new Promise((resolve) => setTimeout(resolve, FAKE_DELAY_MS))
  const items = [
    { name: '두부', quantity: 1, unit: '모', confidence: 0.98 },
    { name: '계란', quantity: 10, unit: '개', confidence: 0.95 },
    { name: '대파', quantity: 1, unit: '단', confidence: 0.72 },
  ].map(({ name, quantity, unit, confidence }) => {
    const preset = findPresetByName(name)
    return {
      name,
      preset_id: preset?.id ?? null,
      quantity,
      unit,
      storage: preset?.default_storage ?? 'FRIDGE',
      expires_on: addDays(todayString(), preset?.shelf_life_days ?? DEFAULT_SHELF_LIFE_DAYS),
      confidence,
      needs_review: confidence < AI_LOW_CONFIDENCE,
    }
  })
  return { count: items.length, items }
}
