// 가짜 모드의 생활 알림 (백엔드 /reminders API 흉내)
// 돌려주는 모양은 백엔드 reminders/schemas.py 와 같습니다.
import { loadReminders, nextId, saveReminders } from './storage.js'
import { awardXp } from './gamification.js'
import {
  REMINDER_CATEGORIES,
  nextNotifyAt,
  reminderSummary,
  toLocalIso,
} from '../reminderSchedule.js'
import { todayString } from '../utils.js'

// GET /reminders → { enabled_count, next_reminder, groups: [{ category, items }] }
export async function getReminders() {
  const reads = (await loadReminders()).map(toRead)
  const upcoming = reads.filter((r) => r.next_notify_at)
  return {
    enabled_count: reads.filter((r) => r.enabled).length,
    next_reminder: upcoming.length
      ? upcoming.reduce((a, b) => (b.next_notify_at < a.next_notify_at ? b : a))
      : null,
    groups: REMINDER_CATEGORIES.map((category) => ({
      category,
      items: reads.filter((r) => r.category === category),
    })).filter((group) => group.items.length > 0),
  }
}

// GET /reminders/{id}
export async function getReminder(id) {
  return toRead(findReminder(await loadReminders(), id))
}

// POST /reminders
export async function addReminder(input) {
  const values = validate(input)
  const reminders = await loadReminders()
  const reminder = {
    id: nextId(reminders),
    ...values,
    enabled: true,
    anchor_date: todayString(),
    last_done_at: null,
  }
  await saveReminders([...reminders, reminder])
  return toRead(reminder)
}

// PATCH /reminders/{id} (부분 수정, 켜고 끄기는 { enabled: false })
export async function updateReminder(id, changes) {
  const reminders = await loadReminders()
  const before = findReminder(reminders, id)
  const merged = { ...before, ...changes }
  const after = { ...merged, ...validate(merged) }
  await saveReminders(reminders.map((r) => (r.id === before.id ? after : r)))
  return toRead(after)
}

// DELETE /reminders/{id}
export async function deleteReminder(id) {
  const reminders = await loadReminders()
  const target = findReminder(reminders, id)
  await saveReminders(reminders.filter((r) => r.id !== target.id))
  return null
}

// POST /reminders/{id}/complete → { reminder, xp }  (+5 XP)
// reminderId 가 없으면(예전 호출 방식) name 으로 XP 만 줍니다.
export async function completeChore({ reminderId, name }) {
  let reminder = null
  let title = name ?? '집안일'
  if (reminderId) {
    const reminders = await loadReminders()
    const found = findReminder(reminders, reminderId)
    reminder = { ...found, last_done_at: toLocalIso(new Date()) }
    title = found.title
    await saveReminders(reminders.map((r) => (r.id === found.id ? reminder : r)))
  }
  const xp = await awardXp([{ action: 'CHORE_COMPLETE', description: `${title} 완료` }]) // 백엔드와 같은 '빨래하기 완료' 형식
  return { reminder: reminder && toRead(reminder), xp }
}

// ----- 아래는 이 파일 안에서만 쓰는 함수 -----

// 저장 모양 → 백엔드 ReminderRead 모양 (+ 가짜 모드에만 있는 last_done_at)
function toRead(reminder) {
  const next = reminder.enabled ? nextNotifyAt(reminder, new Date()) : null
  return {
    id: reminder.id,
    category: reminder.category,
    title: reminder.title,
    repeat_type: reminder.repeat_type,
    interval: reminder.interval,
    weekdays: reminder.weekdays,
    day_of_month: reminder.day_of_month,
    remind_time: reminder.remind_time,
    notify_before_days: reminder.notify_before_days,
    enabled: reminder.enabled,
    next_due_at: next ? toLocalIso(next.dueAt) : null,
    next_notify_at: next ? toLocalIso(next.notifyAt) : null,
    summary: reminderSummary(reminder),
    last_done_at: reminder.last_done_at ?? null, // 백엔드 응답에는 아직 없음 (요청서 참고)
  }
}

function findReminder(reminders, id) {
  const reminder = reminders.find((r) => r.id === Number(id))
  if (!reminder) throw new Error('알림을 찾을 수 없습니다.')
  return reminder
}

// 백엔드 ReminderCreate 검증과 같은 규칙. 저장할 값만 골라서 돌려줍니다.
function validate(input) {
  const values = {
    category: input.category,
    title: (input.title ?? '').trim(),
    repeat_type: input.repeat_type,
    interval: input.interval ?? 1,
    weekdays: input.weekdays ?? [],
    day_of_month: input.day_of_month ?? null,
    remind_time: input.remind_time,
    notify_before_days: input.notify_before_days ?? 0,
  }
  if (!REMINDER_CATEGORIES.includes(values.category)) throw new Error('알림 종류를 골라 주세요.')
  if (!values.title) throw new Error('알림 이름을 입력해 주세요.')
  if (values.title.length > 40) throw new Error('알림 이름은 40자까지 쓸 수 있어요.')
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(values.repeat_type)) {
    throw new Error('반복 주기를 골라 주세요.')
  }
  if (values.interval < 1 || values.interval > 12) throw new Error('반복 간격은 1~12 사이여야 합니다.')
  if (values.weekdays.some((w) => w < 0 || w > 6)) {
    throw new Error('weekdays는 0(월)~6(일) 사이여야 합니다.')
  }
  if (values.repeat_type === 'WEEKLY' && values.weekdays.length === 0) {
    throw new Error('매주 반복은 요일을 1개 이상 선택해야 합니다.')
  }
  if (values.repeat_type === 'MONTHLY' && !values.day_of_month) {
    throw new Error('매달 반복은 날짜가 필요합니다.')
  }
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(values.remind_time ?? '')) throw new Error('시간을 골라 주세요.')
  if (values.notify_before_days < 0 || values.notify_before_days > 14) {
    throw new Error('미리 알림은 0~14일 전까지 고를 수 있어요.')
  }
  return values
}
