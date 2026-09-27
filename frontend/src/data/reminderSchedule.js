// 생활 알림의 반복 규칙 계산 (가짜 모드 · 푸시 예약 · 화면이 같이 씀)
// 백엔드 backend/app/features/reminders/schedule.py, service.py 의 summarize() 를 그대로 옮겼습니다.
// 백엔드 규칙이 바뀌면 여기도 같이 고쳐 주세요.
//
// 알림 하나의 모양 (백엔드 ReminderRead 와 같음)
// {
//   id: 1,
//   category: 'LAUNDRY',        // 'LAUNDRY' 세탁 | 'CLEANING' 청소 | 'BILL' 공과금 | 'ETC' 기타
//   title: '빨래하기',
//   repeat_type: 'WEEKLY',      // 'DAILY' | 'WEEKLY' | 'MONTHLY'
//   interval: 1,                // N일/N주/N달마다 (2주마다 → 2)
//   weekdays: [1, 4],           // WEEKLY: 0=월 ... 6=일
//   day_of_month: null,         // MONTHLY: 1~31 (그 날이 없는 달은 말일)
//   remind_time: '20:00:00',
//   notify_before_days: 0,      // 0 = 당일, 3 = 3일 전에 미리 알림
//   enabled: true,
//   next_due_at: '2026-09-29T20:00:00',    // 다음에 해야 하는 날 (꺼져 있으면 null)
//   next_notify_at: '2026-09-29T20:00:00', // 다음 푸시 시각 (꺼져 있으면 null)
//   summary: '매주 화·금 · 오후 8:00',
// }
import { toDateString } from './utils.js'

export const REMINDER_CATEGORIES = ['LAUNDRY', 'CLEANING', 'BILL', 'ETC']
export const REPEAT_TYPES = ['DAILY', 'WEEKLY', 'MONTHLY']
export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] // 0=월 ... 6=일 (백엔드와 같음)

const CATEGORY_LABELS = { LAUNDRY: '세탁', CLEANING: '청소', BILL: '공과금', ETC: '기타' }

// 'LAUNDRY' → '세탁'
export function categoryLabel(category) {
  return CATEGORY_LABELS[category] ?? category
}

// ----- 시간 글자 -----

// '20:00:00' → { hour: 20, minute: 0 }
export function parseTime(timeString) {
  const [hour, minute] = timeString.split(':').map(Number)
  return { hour, minute }
}

// (20, 0) → '20:00:00' (백엔드에 보내는 모양)
export function toTimeString(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}

// '20:00:00' → '오후 8:00'
export function formatRemindTime(timeString) {
  const { hour, minute } = parseTime(timeString)
  const ampm = hour < 12 ? '오전' : '오후'
  return `${ampm} ${hour % 12 || 12}:${String(minute).padStart(2, '0')}`
}

// Date → '2026-09-29T20:00:00' (백엔드처럼 시간대 없는 한국 시각 글자)
export function toLocalIso(date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${toDateString(date)}T${hh}:${mm}:${ss}`
}

// '2026-09-29T20:00:00' → Date (시간대가 없으면 폰 시각으로 봄)
export function parseLocalIso(isoString) {
  return isoString ? new Date(isoString) : null
}

// ----- 요약 문구 -----

// '매주 화·금', '2주마다 토', '매달 25일', '매일'
export function repeatRuleLabel({ repeat_type, interval = 1, weekdays = [], day_of_month }) {
  if (repeat_type === 'DAILY') return interval === 1 ? '매일' : `${interval}일마다`
  if (repeat_type === 'WEEKLY') {
    const days = [...weekdays].sort((a, b) => a - b).map((w) => WEEKDAY_LABELS[w]).join('·')
    return interval === 1 ? `매주 ${days}` : `${interval}주마다 ${days}`
  }
  return interval === 1 ? `매달 ${day_of_month}일` : `${interval}달마다 ${day_of_month}일`
}

// 백엔드 summarize() 와 같은 요약: '매주 화·금 · 오후 8:00', '매달 25일 · 오전 9:00 · 3일 전 알림'
export function reminderSummary(reminder) {
  const before = reminder.notify_before_days
    ? ` · ${reminder.notify_before_days}일 전 알림`
    : ''
  return `${repeatRuleLabel(reminder)} · ${formatRemindTime(reminder.remind_time)}${before}`
}

// ----- 다음 날짜 계산 (백엔드 schedule.py) -----
// reminder 에는 anchor_date('YYYY-MM-DD', 2주마다 같은 간격 계산의 기준일)가 필요합니다.
// 서버 응답에는 anchor_date 가 없어서, 푸시 예약할 때는 next_due_at 의 날짜를 기준일로 씁니다.

const DAY_MS = 24 * 60 * 60 * 1000

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseDateOnly(dateString) {
  const [y, m, d] = dateString.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function plusDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function daysDiff(from, to) {
  return Math.round((dateOnly(to) - dateOnly(from)) / DAY_MS)
}

function atTime(date, timeString) {
  const { hour, minute } = parseTime(timeString)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0)
}

// 월요일 0 ... 일요일 6 (JS getDay 는 일요일 0 이라 바꿔 줌)
function weekdayOf(date) {
  return (date.getDay() + 6) % 7
}

// after 이후(초과) 가장 가까운 '해야 하는 날' 시각. 규칙이 잘못됐으면 null
export function nextOccurrence(reminder, after) {
  const interval = Math.max(reminder.interval ?? 1, 1)
  const anchor = parseDateOnly(reminder.anchor_date)
  const time = reminder.remind_time

  if (reminder.repeat_type === 'DAILY') {
    let d = dateOnly(after) > anchor ? dateOnly(after) : anchor
    const offset = daysDiff(anchor, d) % interval
    if (offset) d = plusDays(d, interval - offset)
    while (atTime(d, time) <= after) d = plusDays(d, interval)
    return atTime(d, time)
  }

  if (reminder.repeat_type === 'WEEKLY') {
    if (!reminder.weekdays?.length) return null
    const anchorMonday = plusDays(anchor, -weekdayOf(anchor))
    let d = dateOnly(after) > anchor ? dateOnly(after) : anchor
    for (let i = 0; i < 7 * interval + 7; i++) {
      const weekIndex = Math.floor(daysDiff(anchorMonday, d) / 7)
      const candidate = atTime(d, time)
      if (reminder.weekdays.includes(weekdayOf(d)) && weekIndex % interval === 0 && candidate > after) {
        return candidate
      }
      d = plusDays(d, 1)
    }
    return null
  }

  if (reminder.repeat_type === 'MONTHLY') {
    if (!reminder.day_of_month) return null
    let y = after.getFullYear()
    let m = after.getMonth() // 0 = 1월
    for (let i = 0; i < 24 * interval; i++) {
      const monthsFromAnchor = (y - anchor.getFullYear()) * 12 + (m - anchor.getMonth())
      if (monthsFromAnchor >= 0 && monthsFromAnchor % interval === 0) {
        const lastDay = new Date(y, m + 1, 0).getDate()
        const candidate = atTime(new Date(y, m, Math.min(reminder.day_of_month, lastDay)), time)
        if (candidate > after) return candidate
      }
      if (m === 11) {
        y += 1
        m = 0
      } else {
        m += 1
      }
    }
    return null
  }

  return null
}

// { notifyAt: 알림 보낼 시각, dueAt: 해야 하는 날 } — 'N일 전 알림'을 반영. 이미 지난 알림 시각은 건너뜀
export function nextNotifyAt(reminder, after) {
  let probe = after
  for (let i = 0; i < 60; i++) {
    const dueAt = nextOccurrence(reminder, probe)
    if (!dueAt) return null
    const notifyAt = plusDaysKeepTime(dueAt, -(reminder.notify_before_days ?? 0))
    if (notifyAt > after) return { notifyAt, dueAt }
    probe = dueAt
  }
  return null
}

// from ~ until 사이에 보낼 알림 목록 (푸시 예약용). [{ notifyAt, dueAt }]
// reminder 에 anchor_date 가 없으면(서버 응답) next_due_at 의 날짜를 기준일로 씁니다.
export function upcomingNotifications(reminder, from, until, max = 10) {
  const anchor_date =
    reminder.anchor_date ?? (reminder.next_due_at ? reminder.next_due_at.slice(0, 10) : null)
  if (!reminder.enabled || !anchor_date) return []
  const rule = { ...reminder, anchor_date }

  const result = []
  let probe = from
  while (result.length < max) {
    const next = nextNotifyAt(rule, probe)
    if (!next || next.notifyAt > until) break
    result.push(next)
    probe = next.notifyAt
  }
  return result
}

function plusDaysKeepTime(date, days) {
  const moved = new Date(date)
  moved.setDate(moved.getDate() + days)
  return moved
}

// ----- 화면 표시용 -----

// 목록의 날짜 뱃지: 공과금처럼 '미리 알림'이 있으면 'D-3', 아니면 '오늘' / '내일' / '9/26'
export function dueLabel(reminder, now = new Date()) {
  const dueAt = parseLocalIso(reminder.next_due_at)
  if (!dueAt) return null
  const days = daysDiff(now, dueAt)
  if (reminder.notify_before_days > 0) return days === 0 ? 'D-day' : `D-${days}`
  if (days === 0) return '오늘'
  if (days === 1) return '내일'
  return `${dueAt.getMonth() + 1}/${dueAt.getDate()}`
}

// 다음 알림 배너: '오늘 오후 8:00', '내일 오전 9:00', '9월 30일 (화) 오후 8:00'
export function formatNotifyTime(isoString, now = new Date()) {
  const date = parseLocalIso(isoString)
  if (!date) return ''
  const days = daysDiff(now, date)
  const day =
    days === 0
      ? '오늘'
      : days === 1
        ? '내일'
        : `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[weekdayOf(date)]})`
  return `${day} ${formatRemindTime(toLocalIso(date).slice(11))}`
}
