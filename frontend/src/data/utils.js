// 날짜 계산과 id 만들기처럼 데이터 파일들이 같이 쓰는 작은 도구들.
// 날짜는 모두 'YYYY-MM-DD' 글자로 다룹니다. (예: '2026-09-25')

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

function parseDate(dateString) {
  const [y, m, d] = dateString.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// 이름 검색: 띄어쓰기·대소문자 무시, 초성으로도 찾기. 예) matchesName('돼지고기', 'ㄷㅈ') → true
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
