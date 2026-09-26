// 테스트용 처음 데이터. 앱을 처음 열 때(저장된 데이터가 없을 때) 이 값으로 시작합니다.
// 날짜는 '오늘'을 기준으로 만들어서 언제 열어도 유통기한 임박 재료가 보입니다.
import { addDays, todayString, createId } from './utils.js'

export function createDummyIngredients() {
  const today = todayString()
  const item = (name, quantity, unit, storage, daysLeft, registeredDaysAgo, unitPrice) => ({
    id: createId(),
    name,
    quantity,
    unit,
    storage,
    expiryDate: addDays(today, daysLeft),
    registeredDate: addDays(today, -registeredDaysAgo),
    unitPrice,
  })

  // 와이어프레임 2번(냉장고) 화면과 같은 재료. daysLeft = 오늘부터 유통기한까지 남은 날
  //    이름, 수량, 단위, 보관, daysLeft, 며칠 전 등록, 단위당 가격
  return [
    item('우유', 1, '개', '냉장', 1, 9, 2900), // D-1
    item('두부', 1, '모', '냉장', 2, 5, 1800), // D-2
    item('대파', 1, '단', '냉장', 3, 7, 2500), // D-3
    item('돼지고기 앞다리살', 300, 'g', '냉장', 4, 1, 14), // D-4
    item('계란', 10, '개', '냉장', 12, 9, 350), // D-12
    item('양파', 2, '개', '실온', 20, 10, 833), // D-20
    item('김치', 500, 'g', '냉장', 15, 15, 8), // D-15
    item('스팸', 1, '캔', '냉동', 60, 30, 4000), // D-60
  ]
}

export function createDummyProgress() {
  const today = todayString()
  const yesterday = addDays(today, -1)
  const at = (dateString, time) => new Date(`${dateString}T${time}`).toISOString()

  return {
    xp: 240,
    streak: {
      current: 7,
      best: 12,
      lastXpDate: yesterday, // 어제까지 7일 연속. 오늘 XP를 얻으면 8일이 됩니다.
    },
    stats: {
      onTimeUseCount: 14,
      savedMoney: 32000,
      cookCount: 12,
      choreCount: 9,
      photoRegisterCount: 4,
      completedRecipes: [
        '두부계란찜', '김치볶음밥', '계란말이', '된장찌개', '콩나물국',
        '닭가슴살 샐러드', '참치마요덮밥', '감자볶음', '어묵볶음',
      ],
    },
    history: [
      { id: createId(), label: '요리 완료: 김치볶음밥', xp: 10, date: at(yesterday, '19:20:00') },
      { id: createId(), label: '유통기한 내 소진 보너스', xp: 10, date: at(yesterday, '19:20:00') },
      { id: createId(), label: '집안일 완료: 분리수거', xp: 5, date: at(yesterday, '09:10:00') },
      { id: createId(), label: '사진으로 재료 3개 등록', xp: 15, date: at(addDays(today, -2), '18:05:00') },
      { id: createId(), label: '요리 완료: 계란말이', xp: 10, date: at(addDays(today, -3), '08:30:00') },
    ],
  }
}
