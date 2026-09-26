// 사진 속 재료 인식 (멀티모달 AI)
//
// ⭐ 지금은 백엔드 AI가 없어서 가짜 결과를 돌려줍니다.
// 백엔드가 생기면 recognizeIngredients 안의 '가짜 결과' 부분을 지우고
// 아래 주석의 fetch 코드를 살린 뒤 API_URL 만 실제 주소로 바꾸면 됩니다.
// 돌려주는 모양은 그대로라서 화면 코드는 고치지 않아도 됩니다.
import { buildIngredient } from './ingredients.js'

// const API_URL = 'https://백엔드주소' // ← 백엔드 주소로 바꾸기

const FAKE_DELAY_MS = 1500 // AI가 생각하는 시간처럼 보이게

// 사진 한 장을 받아 재료 후보 목록을 돌려줍니다.
// photo: expo-image-picker 결과의 사진 하나 ({ uri, mimeType, fileName })
// 돌려주는 값: [{ id, name, quantity, unit, storage, expiryDate, confidence }, ...]
//   confidence: 인식 신뢰도 (0~100, %)
//   expiryDate: 재료 프리셋 기본 일수로 오늘 기준 자동 계산 (프리셋에 없으면 7일)
// 예) const candidates = await recognizeIngredients(result.assets[0])
export async function recognizeIngredients(photo) {
  // ----- 백엔드 연결 후 (예시) -----
  // const body = new FormData()
  // body.append('photo', { uri: photo.uri, name: photo.fileName ?? 'photo.jpg', type: photo.mimeType ?? 'image/jpeg' })
  // const response = await fetch(`${API_URL}/ingredients/recognize`, { method: 'POST', body })
  // if (!response.ok) throw new Error('재료 인식 실패')
  // const { items } = await response.json() // [{ name, quantity, unit, confidence }]
  // return items.map(toCandidate)

  // ----- 가짜 결과 -----
  await new Promise((resolve) => setTimeout(resolve, FAKE_DELAY_MS))
  return [
    { name: '두부', quantity: 1, unit: '모', confidence: 98 },
    { name: '계란', quantity: 10, unit: '개', confidence: 95 },
    { name: '대파', quantity: 1, unit: '단', confidence: 68 },
  ].map(toCandidate)
}

// AI 결과 하나에 보관 위치·유통기한을 채웁니다.
function toCandidate({ name, quantity, unit, confidence }) {
  const { id, storage, expiryDate } = buildIngredient({ name, quantity, unit })
  return { id, name, quantity, unit, storage, expiryDate, confidence }
}
