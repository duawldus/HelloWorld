// XP·레벨·뱃지 규칙. 숫자를 바꾸고 싶으면 여기만 고치면 됩니다.

// 유통기한이 며칠 이하로 남으면 '임박' 재료로 보는지
export const EXPIRING_SOON_DAYS = 3

export const XP_RULES = {
  cook: 10, // 요리 완료
  expiringBonus: 10, // 유통기한 임박 재료를 써서 요리하면 추가
  photoPerIngredient: 5, // 사진으로 재료 등록 시 재료 1개당
  chore: 5, // 집안일 완료
}

// minXp 이상이면 그 레벨. 예) 240 XP → Lv.3, 다음 레벨(390)까지 150 남음
export const LEVELS = [
  { level: 1, name: '새내기 자취러', minXp: 0 },
  { level: 2, name: '초보 자취러', minXp: 100 },
  { level: 3, name: '알뜰 자취러', minXp: 200 },
  { level: 4, name: '살림 고수', minXp: 390 },
  { level: 5, name: '냉장고 지킴이', minXp: 650 },
  { level: 6, name: '자취 달인', minXp: 1000 },
  { level: 7, name: '방구석 마스터', minXp: 1500 },
]

// 뱃지. check 는 진행 상황(progress)을 받아 달성했으면 true 를 돌려줍니다.
export const BADGES = [
  {
    id: 'fridge-cleaner',
    name: '냉장고 클리너',
    description: '유통기한 임박 재료 제때 소진 10회',
    check: (p) => p.stats.onTimeUseCount >= 10,
  },
  {
    id: 'home-cook-master',
    name: '집밥 마스터',
    description: '요리 완료 10회',
    check: (p) => p.stats.cookCount >= 10,
  },
  {
    id: 'streak-7',
    name: '7일 연속 기록',
    description: '7일 연속으로 XP 얻기',
    check: (p) => p.streak.best >= 7,
  },
  {
    id: 'streak-30',
    name: '30일 연속 기록',
    description: '30일 연속으로 XP 얻기',
    check: (p) => p.streak.best >= 30,
  },
  {
    id: 'recipe-20',
    name: '레시피 20개 완성',
    description: '서로 다른 레시피 20개 요리하기',
    check: (p) => p.stats.completedRecipes.length >= 20,
  },
  {
    id: 'photo-10',
    name: '사진 등록 10회',
    description: '사진으로 재료 등록 10회',
    check: (p) => p.stats.photoRegisterCount >= 10,
  },
]
