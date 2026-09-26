// 가짜 모드의 XP · 레벨 · 연속 기록 · 뱃지
// 돌려주는 모양은 백엔드 gamification API 와 같습니다.
import { loadProgress, saveProgress } from './storage.js'
import { BADGES, LEVELS, SAVED_MONEY_PER_SAVE, XP_TABLE } from './rules.js'
import { addDays, todayString } from '../utils.js'

const MAX_LOGS = 50

// GET /gamification/stats
export async function getStats() {
  const progress = await loadProgress()
  const saved = progress.counts.EXPIRY_SAVE_BONUS
  return {
    ...levelSummary(progress),
    saved_count: saved,
    saved_money_estimate: saved * SAVED_MONEY_PER_SAVE,
    cook_count: progress.counts.COOK_COMPLETE,
  }
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

// XP 지급. entries: [{ action: 'COOK_COMPLETE', description: '요리 완료: 김치찌개' }, ...]
// 돌려주는 값: 백엔드 XpGain 모양 { amount, reasons, level_up, new_badges }
export async function awardXp(entries) {
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

function levelFor(xp) {
  return LEVELS.filter(([, required]) => xp >= required).at(-1)[0]
}

function levelSummary(progress) {
  const level = levelFor(progress.xp)
  const [, , title] = LEVELS.find(([lv]) => lv === level)
  const next = LEVELS.find(([lv]) => lv === level + 1)
  const today = todayString()
  const { lastXpDate } = progress.streak
  // 어제도 오늘도 XP를 못 얻었으면 연속 기록은 끊긴 것
  const alive = lastXpDate === today || lastXpDate === addDays(today, -1)
  return {
    level,
    title,
    xp: progress.xp,
    next_level_xp: next ? next[1] : null,
    xp_to_next_level: next ? next[1] - progress.xp : null,
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
