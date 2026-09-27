// 푸시 알림 문구 · 예약 시각 만들기 (와이어프레임 9번, 백엔드 notifications/jobs.py 와 같은 시나리오)
// expo-notifications 를 쓰지 않는 순수 함수라서 테스트하기 쉽습니다. 예약은 index.js 가 합니다.
//
// - 생활 알림: 설정한 요일·시각(또는 N일 전)에 → 누르면 생활 알림 화면
//     '지금 빨래 시간이에요' / '매주 화·금 오후 8:00 알림으로 설정했어요'
//     '전기요금 납부일이 3일 남았어요' / '매달 25일 납부 · 3일 전 알림으로 설정했어요'
// - 유통기한 알림: 임박 재료가 있는 날 오전 9시, 가장 급한 재료 하나로 → 누르면 레시피 추천 화면
//     '두부 유통기한이 내일까지예요' / '냉장고에 두부가 1모 있어요. 두부계란찜은 어때요?'
import {
  IMMINENT_DAYS,
  formatRemindTime,
  repeatRuleLabel,
  upcomingNotifications,
  withJosa,
} from '../data'

export const REMINDER_DAYS_AHEAD = 30 // 생활 알림은 30일 앞까지 예약
export const EXPIRY_DAYS_AHEAD = 7 // 유통기한 알림은 7일 앞까지 예약
export const EXPIRY_HOUR = 9 // 유통기한 알림 시각 (오전 9시)
export const MAX_SCHEDULED = 60 // iOS 는 앱 하나당 예약 알림이 64개까지라 여유를 둠

// 알림을 누르면 갈 화면
export const ROUTES = { REMINDER: '/alert', EXPIRY: '/recipe' }

// 백엔드 푸시의 deeplink(PushMessage.deeplink) → 앱 화면 주소
const DEEPLINKS = {
  'bangguseok://reminders': ROUTES.REMINDER,
  'bangguseok://recipes': ROUTES.EXPIRY,
}

// 알림에 담긴 data 에서 이동할 화면 주소 찾기 (앱이 예약한 알림: url, 백엔드 푸시: deeplink)
export function routeFromData(data) {
  if (!data) return null
  if (typeof data.url === 'string') return data.url
  if (typeof data.deeplink === 'string') return DEEPLINKS[data.deeplink] ?? null
  return null
}

// 예약할 알림 목록 → [{ id, date, title, body, data, channel }] (시각순, 최대 MAX_SCHEDULED 개)
// reminders: getReminders().groups 의 items 전부, ingredients: getIngredients().items,
// recipes: 추천 카드 목록 (없으면 [])
export function buildNotifications({ reminders = [], ingredients = [], recipes = [], now = new Date() }) {
  const list = [
    ...reminders.flatMap((reminder) => reminderNotifications(reminder, now)),
    ...expiryNotifications(ingredients, recipes, now),
  ]
  return list.sort((a, b) => a.date - b.date).slice(0, MAX_SCHEDULED)
}

// ----- 생활 알림 -----

export function reminderNotifications(reminder, now = new Date()) {
  const until = new Date(now.getTime() + REMINDER_DAYS_AHEAD * 24 * 60 * 60 * 1000)
  return upcomingNotifications(reminder, now, until).map(({ notifyAt }) => ({
    id: `bangguseok.reminder.${reminder.id}.${notifyAt.getTime()}`,
    date: notifyAt,
    ...reminderMessage(reminder),
    data: { url: ROUTES.REMINDER, type: 'REMINDER', reminderId: reminder.id },
    channel: 'reminders',
  }))
}

export function reminderMessage(reminder) {
  const rule = repeatRuleLabel(reminder)
  const time = formatRemindTime(reminder.remind_time)
  const days = reminder.notify_before_days

  if (!days) {
    // '빨래하기' → '지금 빨래 시간이에요'
    const what = reminder.title.replace(/\s*하기$/, '')
    return { title: `지금 ${what} 시간이에요`, body: `${rule} ${time} 알림으로 설정했어요` }
  }
  if (reminder.category === 'BILL') {
    return {
      title: `${reminder.title} 납부일이 ${days}일 남았어요`,
      body: `${rule} 납부 · ${days}일 전 알림으로 설정했어요`,
    }
  }
  return {
    title: `${reminder.title}까지 ${days}일 남았어요`,
    body: `${rule} ${time} · ${days}일 전 알림으로 설정했어요`,
  }
}

// ----- 유통기한 알림 -----

export function expiryNotifications(ingredients, recipes = [], now = new Date()) {
  const result = []
  for (let k = 0; k < EXPIRY_DAYS_AHEAD; k++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k, EXPIRY_HOUR, 0, 0)
    if (date <= now) continue

    // 그날 기준 남은 날 (지난 재료는 빼고, D-3 이하만)
    const urgent = ingredients
      .map((item) => ({ item, daysLeft: item.d_day - k }))
      .filter(({ daysLeft }) => daysLeft >= 0 && daysLeft <= IMMINENT_DAYS)
      .sort((a, b) => a.daysLeft - b.daysLeft)
    if (urgent.length === 0) continue

    const { item, daysLeft } = urgent[0]
    result.push({
      id: `bangguseok.expiry.${date.getTime()}`,
      date,
      ...expiryMessage(item, daysLeft, findRecipe(recipes, item.name)),
      data: { url: ROUTES.EXPIRY, type: 'EXPIRY', ingredientId: item.id },
      channel: 'expiry',
    })
  }
  return result
}

export function expiryMessage(item, daysLeft, recipeTitle = null) {
  const when =
    daysLeft === 0 ? '오늘까지예요' : daysLeft === 1 ? '내일까지예요' : `${daysLeft}일 남았어요`
  const suggestion = recipeTitle
    ? `${withJosa(recipeTitle, '은', '는')} 어때요?`
    : '만들 수 있는 요리를 추천해 드릴게요'
  return {
    title: `${item.name} 유통기한이 ${when}`,
    // '냉장고에 두부가 1모 있어요. 두부계란찜은 어때요?'
    body: `냉장고에 ${withJosa(item.name, '이', '가')} ${item.quantity}${item.unit} 있어요. ${suggestion}`,
  }
}

// 그 재료를 쓰는 추천 레시피 이름 (레시피 카드 tags 의 이름이 겹치면)
function findRecipe(recipes, name) {
  const recipe = recipes.find((card) =>
    card.tags?.some((tag) => tag.owned && (tag.name.includes(name) || name.includes(tag.name))),
  )
  return recipe?.title ?? null
}
