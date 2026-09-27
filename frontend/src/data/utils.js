// 가짜 모드·서버 모드가 같이 쓰는 작은 도구들: 날짜, 보관 위치 이름, 이름 검색
// 날짜는 모두 'YYYY-MM-DD' 글자로 다룹니다. (예: '2026-09-25')

// ----- 보관 위치 -----
// 저장·서버 통신은 영어 코드, 화면에는 한국어로 보여 줍니다.
export const STORAGE_TYPES = ['FRIDGE', 'FREEZER', 'ROOM']

const STORAGE_LABELS = { FRIDGE: '냉장', FREEZER: '냉동', ROOM: '실온' }

// 'FRIDGE' → '냉장'
export function storageLabel(storage) {
  return STORAGE_LABELS[storage] ?? storage
}

// ----- 레시피 난이도 -----
const DIFFICULTY_LABELS = { EASY: '쉬움', NORMAL: '보통', HARD: '어려움' }

// 'EASY' → '쉬움'
export function difficultyLabel(difficulty) {
  return DIFFICULTY_LABELS[difficulty] ?? difficulty
}

// ----- 날짜 -----
export function todayString() {
  return toDateString(new Date())
}

export function toDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// '2026-09-25' 에 days 일을 더한 날짜 (빼려면 음수)
export function addDays(dateString, days) {
  const date = parseDate(dateString)
  date.setDate(date.getDate() + days)
  return toDateString(date)
}

// from 부터 to 까지 며칠인지 (to 가 더 빠르면 음수)
export function daysBetween(fromDateString, toDateString_) {
  const ms = parseDate(toDateString_) - parseDate(fromDateString)
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

// 오늘부터 그 날짜까지 남은 날 (오늘이면 0, 지났으면 음수). 예) daysUntil(item.expires_on)
export function daysUntil(dateString) {
  return daysBetween(todayString(), dateString)
}

function parseDate(dateString) {
  const [y, m, d] = dateString.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 시각(ISO 글자) → '오늘' / '어제' / 'N일 전'
// 백엔드는 시간대 없는 한국 시각('2026-09-27T12:30:00')을 주고, 폰의 시간대로 읽습니다.
export function relativeDayLabel(isoString) {
  const days = daysBetween(toDateString(new Date(isoString)), todayString())
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  return `${days}일 전`
}

// ----- XP 기록 -----
// XP 기록 문구를 화면용으로 바꿉니다. (저장된 문구는 그대로 두고 보여 줄 때만)
//   '요리 완료: 김치볶음밥' → '김치볶음밥 요리 완료'
//   '집안일 완료: 분리수거' → '분리수거 완료'
//   그 밖의 문구('분리수거 완료', '사진으로 재료 3개 등록' 등)는 그대로
export function formatXpTitle(description) {
  const cook = description.match(/^요리 완료:\s*(.+)$/)
  if (cook) return `${cook[1]} 요리 완료`
  const chore = description.match(/^집안일 완료:\s*(.+)$/)
  if (chore) return `${chore[1]} 완료`
  return description
}

// 최근 XP 기록을 화면에 보여 줄 줄로 묶습니다.
// '요리 완료' 바로 뒤(1분 안)에 받은 '유통기한 내 소진 보너스'는 한 줄로 합칩니다.
// 돌려주는 값: [{ id, title: '두부계란찜 요리 완료', reasons: ['유통기한 내 소진 보너스'], amount: 20, created_at }]
export function summarizeXpLogs(logs) {
  const rows = logs
    .filter((log) => log.action !== 'EXPIRY_SAVE_BONUS')
    .map((log) => ({
      id: log.id,
      title: formatXpTitle(log.description),
      reasons: [],
      amount: log.amount,
      created_at: log.created_at,
      action: log.action,
    }))
  for (const bonus of logs.filter((log) => log.action === 'EXPIRY_SAVE_BONUS')) {
    const cook = rows.find(
      (row) =>
        row.action === 'COOK_COMPLETE' &&
        Math.abs(new Date(row.created_at) - new Date(bonus.created_at)) <= 60 * 1000,
    )
    if (cook) {
      cook.reasons.push(bonus.description)
      cook.amount += bonus.amount
    } else {
      rows.push({
        ...bonus,
        title: formatXpTitle(bonus.description),
        reasons: [],
        action: bonus.action,
      })
    }
  }
  return rows
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(({ action, ...row }) => row)
}

// ----- 레시피 인분 -----
// 레시피 재료 양을 인분에 맞게 바꾸기. 숫자로 시작하지 않는 양('약간', '적당량')은 그대로 둡니다.
// scaleAmount('1/2모', 1, 3) → '1과 1/2모', scaleAmount('100g', 1, 2) → '200g', scaleAmount('약간', 1, 2) → '약간'
export const MAX_SERVINGS = 6

export function scaleAmount(amount, baseServings, servings) {
  if (!amount || !baseServings || baseServings === servings) return amount
  const match = amount.match(/^\s*(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?(.*)$/)
  if (!match) return amount
  const [, num, den, rest] = match
  const value = (den ? Number(num) / Number(den) : Number(num)) * (servings / baseServings)
  return `${formatQuantity(value)}${rest}`
}

// 숫자 읽는 소리에 맞는 조사: 1(일)과, 2(이)와, 5(오)와 ...
const WA_GWA = ['과', '과', '와', '과', '와', '와', '과', '과', '과', '와']

// 1.5 → '1과 1/2', 2.5 → '2와 1/2', 0.25 → '1/4', 2 → '2', 0.6 → '0.6'
function formatQuantity(value) {
  const whole = Math.floor(value + 1e-9)
  const fraction = value - whole
  if (fraction < 1e-9) return String(whole)
  for (const den of [2, 3, 4]) {
    const top = Math.round(fraction * den)
    if (top > 0 && top < den && Math.abs(fraction - top / den) < 1e-6) {
      const part = `${top / gcd(top, den)}/${den / gcd(top, den)}`
      return whole > 0 ? `${whole}${WA_GWA[whole % 10]} ${part}` : part
    }
  }
  return String(Math.round(value * 10) / 10)
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b)
}

// ----- 조사 -----
// 받침에 따라 조사 붙이기. withJosa('대파', '을', '를') → '대파를', withJosa('계란', '이', '가') → '계란이'
export function withJosa(word, withBatchim, withoutBatchim) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code >= 11172) return `${word}${withBatchim}(${withoutBatchim})`
  return `${word}${code % 28 === 0 ? withoutBatchim : withBatchim}`
}

// ----- 이름 검색 -----
// 띄어쓰기·대소문자 무시, 초성으로도 찾기. 예) matchesName('돼지고기', 'ㄷㅈ') → true
export function matchesName(name, query) {
  const q = normalize(query)
  if (!q) return true
  const target = normalize(name)
  if (target.includes(q)) return true
  return /^[ㄱ-ㅎ]+$/.test(q) && toChosung(target).includes(q)
}

function normalize(text) {
  return text.replace(/\s/g, '').toLowerCase()
}

const CHOSUNG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'

// '두부' → 'ㄷㅂ' (한글이 아닌 글자는 그대로)
function toChosung(text) {
  return [...text]
    .map((char) => {
      const code = char.charCodeAt(0) - 0xac00
      return code >= 0 && code < 11172 ? CHOSUNG[Math.floor(code / 588)] : char
    })
    .join('')
}
