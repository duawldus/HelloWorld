// XP, 레벨, 연속 기록, 통계, 뱃지, 최근 XP 기록
import { loadProgress, saveProgress } from './storage.js'
import { BADGES, LEVELS } from './rules.js'
import { addDays, createId, todayString } from './utils.js'

const MAX_HISTORY = 50

// 화면에 보여줄 진행 상황을 한 번에 가져옵니다.
// {
//   xp: 240,
//   level: { level: 3, name: '알뜰 자취러', title: 'Lv.3 알뜰 자취러', xpToNext: 150, percent: 21, ... },
//   streak: { current: 7, best: 12 },
//   stats: { onTimeUseCount, savedMoney, cookCount, choreCount, photoRegisterCount, completedRecipes },
//   badges: [{ id, name, description, earned: true/false }, ...],
//   history: [{ id, label: '요리 완료: 두부계란찜', xp: 10, date: '2026-09-25T10:20:00.000Z' }, ...] (최신순)
// }
export async function getProgress() {
  return describeProgress(await loadProgress())
}

// XP 숫자로 레벨 정보를 계산합니다. 예) getLevelInfo(240)
export function getLevelInfo(xp) {
  const index = LEVELS.findLastIndex((lv) => xp >= lv.minXp)
  const current = LEVELS[index]
  const next = LEVELS[index + 1]
  return {
    level: current.level,
    name: current.name,
    title: `Lv.${current.level} ${current.name}`,
    nextLevelXp: next ? next.minXp : null,
    xpToNext: next ? next.minXp - xp : 0,
    percent: next ? Math.floor(((xp - current.minXp) / (next.minXp - current.minXp)) * 100) : 100,
    isMaxLevel: !next,
  }
}

// ----- 아래는 데이터 파일 안에서만 쓰는 함수 -----

// XP 를 주고 저장합니다. updateStats 로 통계도 같이 바꿉니다.
// 돌려주는 값: { gainedXp, levelUp, newBadges, progress }
export async function rewardXp(entries, updateStats = (stats) => stats) {
  const before = await loadProgress()
  const now = new Date().toISOString()
  const gainedXp = entries.reduce((sum, e) => sum + e.xp, 0)
  const newEntries = entries.map((e) => ({ id: createId(), label: e.label, xp: e.xp, date: now }))

  const after = {
    ...before,
    xp: before.xp + gainedXp,
    streak: nextStreak(before.streak, todayString()),
    stats: updateStats({ ...before.stats }),
    history: [...newEntries.reverse(), ...before.history].slice(0, MAX_HISTORY),
  }
  await saveProgress(after)

  const newBadges = BADGES.filter((b) => b.check(after) && !b.check(before)).map(
    ({ id, name, description }) => ({ id, name, description }),
  )

  return {
    gainedXp,
    levelUp: getLevelInfo(after.xp).level > getLevelInfo(before.xp).level,
    newBadges,
    progress: describeProgress(after),
  }
}

function nextStreak(streak, today) {
  if (streak.lastXpDate === today) return streak // 오늘 이미 XP를 얻음
  const current = streak.lastXpDate === addDays(today, -1) ? streak.current + 1 : 1
  return { current, best: Math.max(streak.best, current), lastXpDate: today }
}

function describeProgress(progress) {
  const today = todayString()
  const { lastXpDate } = progress.streak
  // 어제도 오늘도 XP를 못 얻었으면 연속 기록은 끊긴 것
  const isAlive = lastXpDate === today || lastXpDate === addDays(today, -1)
  return {
    xp: progress.xp,
    level: getLevelInfo(progress.xp),
    streak: { current: isAlive ? progress.streak.current : 0, best: progress.streak.best },
    stats: progress.stats,
    badges: BADGES.map(({ id, name, description, check }) => ({
      id,
      name,
      description,
      earned: check(progress),
    })),
    history: progress.history,
  }
}
