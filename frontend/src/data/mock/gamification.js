// 가짜 모드의 XP · 레벨 · 연속 기록 · 뱃지
// 돌려주는 모양은 백엔드 gamification API 와 같습니다.
import { loadProgress, saveProgress } from './storage.js'
import { BADGES, DEFAULT_INGREDIENT_PRICE, LEVELS, XP_TABLE, levelHint } from './rules.js'
import { addDays, todayString } from '../utils.js'

const MAX_LOGS = 50

// GET /gamification/stats
export async function getStats() {
  const progress = await loadProgress()
  return {
    ...levelSummary(progress),
    saved_count: progress.counts.EXPIRY_SAVE_BONUS,
    saved_money_estimate: savedMoneyOf(progress),
    cook_count: progress.counts.COOK_COMPLETE,
  }
}

// 절약 추정 식비 누적(원). 예전 저장 데이터·더미에는 값이 없어서 '제때 소진 1회 = 2,300원'으로 시작
// (더미: 14회 × 2,300 = 32,200 → 화면 '약 32,000원')
function savedMoneyOf(progress) {
  return progress.saved_money ?? progress.counts.EXPIRY_SAVE_BONUS * DEFAULT_INGREDIENT_PRICE
}

// 금액을 따로 안 넘기면 '유통기한 내 소진 보너스' 1개당 기본 가격으로 셉니다.
function bonusMoney(actions) {
  return (
    actions.filter((action) => action === 'EXPIRY_SAVE_BONUS').length * DEFAULT_INGREDIENT_PRICE
  )
}

// GET /gamification/badges
export async function getBadges() {
  const progress = await loadProgress()
  const badges = BADGES.map(({ condition, ...badge }) => ({
    ...badge,
    acquired: Boolean(progress.badges[badge.code]),
    acquired_at: progress.badges[badge.code] ?? null,
    progress: badgeProgress(progress, condition),
  }))
  return {
    acquired_count: badges.filter((b) => b.acquired).length,
    total_count: badges.length,
    badges,
  }
}

// GET /gamification/xp-logs?limit=
export async function getXpLogs(limit = 20) {
  const progress = await loadProgress()
  return progress.logs.slice(0, limit)
}

// ----- 아래는 가짜 모드 안에서만 쓰는 함수 -----

// XP 지급. entries: [{ action: 'COOK_COMPLETE', description: '김치찌개 요리 완료' }, ...]
// savedMoney: 이번에 아낀 돈(원). 보너스 요리에서 쓴 임박 재료 값의 합계 (mock/rules.js 의 ingredientPrice)
//   생략하면 소진 보너스 1개당 기본 2,300원
// 돌려주는 값: 백엔드 XpGain 모양 { amount, reasons, level_up, new_badges }
export async function awardXp(entries, { savedMoney } = {}) {
  const before = await loadProgress()
  const now = new Date().toISOString()
  let logId = before.logs.reduce((max, log) => Math.max(max, log.id), 0)
  const newLogs = entries.map(({ action, description }) => ({
    id: ++logId,
    action,
    amount: XP_TABLE[action] ?? 0,
    description,
    created_at: now,
  }))
  const amount = newLogs.reduce((sum, log) => sum + log.amount, 0)

  const counts = { ...before.counts }
  for (const { action } of entries) counts[action] = (counts[action] ?? 0) + 1

  const after = {
    ...before,
    xp: before.xp + amount,
    streak: nextStreak(before.streak, todayString()),
    counts,
    saved_money: savedMoneyOf(before) + (savedMoney ?? bonusMoney(entries.map((e) => e.action))),
    logs: [...newLogs.reverse(), ...before.logs].slice(0, MAX_LOGS),
  }

  // 새로 조건을 채운 뱃지 지급
  const newBadges = BADGES.filter(
    (b) => !after.badges[b.code] && badgeProgress(after, b.condition) >= b.threshold,
  )
  after.badges = { ...after.badges, ...Object.fromEntries(newBadges.map((b) => [b.code, now])) }
  await saveProgress(after)

  return {
    amount,
    reasons: newLogs.map((log) => log.description).reverse(),
    level_up: levelFor(after.xp) > levelFor(before.xp),
    new_badges: newBadges.map((b) => b.name),
  }
}

// XP 회수 (요리 완료 실행 취소). 백엔드처럼 음수 XP 기록(COOK_UNDO)을 남기고,
// 그때 늘렸던 행동 횟수(countedActions)를 되돌립니다. 이미 딴 뱃지·연속 기록은 그대로 둡니다.
// savedMoney: 그 요리로 늘렸던 절약 식비 (생략하면 소진 보너스 1개당 기본 2,300원을 뺌)
export async function revokeXp({ amount, countedActions, description, savedMoney }) {
  const before = await loadProgress()
  const savedMoneyAfter = Math.max(
    0,
    savedMoneyOf(before) - (savedMoney ?? bonusMoney(countedActions)),
  )
  const counts = { ...before.counts }
  for (const action of countedActions) counts[action] = Math.max(0, (counts[action] ?? 0) - 1)
  const log = {
    id: before.logs.reduce((max, l) => Math.max(max, l.id), 0) + 1,
    action: 'COOK_UNDO',
    amount: -amount,
    description,
    created_at: new Date().toISOString(),
  }
  await saveProgress({
    ...before,
    xp: Math.max(0, before.xp - amount),
    counts,
    saved_money: savedMoneyAfter,
    logs: [log, ...before.logs].slice(0, MAX_LOGS),
  })
}

function levelFor(xp) {
  return LEVELS.filter(([, required]) => xp >= required).at(-1)[0]
}

function levelSummary(progress) {
  const level = levelFor(progress.xp)
  const [, levelMinXp, title] = LEVELS.find(([lv]) => lv === level)
  const next = LEVELS.find(([lv]) => lv === level + 1)
  const xpToNext = next ? next[1] - progress.xp : null
  const today = todayString()
  const { lastXpDate } = progress.streak
  // 어제도 오늘도 XP를 못 얻었으면 연속 기록은 끊긴 것
  const alive = lastXpDate === today || lastXpDate === addDays(today, -1)
  return {
    level,
    title,
    xp: progress.xp,
    level_min_xp: levelMinXp,
    next_level_xp: next ? next[1] : null,
    xp_to_next_level: xpToNext,
    level_hint: levelHint(xpToNext),
    current_streak: alive ? progress.streak.current : 0,
    best_streak: progress.streak.best,
  }
}

function badgeProgress(progress, condition) {
  switch (condition) {
    case 'SAVED_BEFORE_EXPIRY':
      return progress.counts.EXPIRY_SAVE_BONUS
    case 'COOK_COUNT':
      return progress.counts.COOK_COMPLETE
    case 'STREAK_DAYS':
      return progress.streak.best
    case 'PHOTO_REGISTER_COUNT':
      return progress.counts.PHOTO_REGISTER
    default:
      return 0
  }
}

function nextStreak(streak, today) {
  if (streak.lastXpDate === today) return streak // 오늘 이미 XP를 얻음
  const current = streak.lastXpDate === addDays(today, -1) ? streak.current + 1 : 1
  return { current, best: Math.max(streak.best, current), lastXpDate: today }
}
