// 가짜 모드의 처음 데이터. 앱을 처음 열 때(저장된 데이터가 없을 때) 이 값으로 시작합니다.
// 날짜는 '오늘'을 기준으로 만들어서 언제 열어도 유통기한 임박 재료가 보입니다.
// 이 파일을 바꾸면 storage.js 의 DATA_VERSION 을 1 올리세요.
import { findPresetByName } from './presets.js'
import { addDays, todayString } from '../utils.js'

// 저장 모양: 백엔드 재료 테이블과 같음 (d_day, is_imminent 는 불러올 때 계산)
// { id, preset_id, name, quantity, unit, storage, expires_on, status, source }
export function createDummyIngredients() {
  const today = todayString()
  const item = (id, name, quantity, unit, storage, daysLeft) => ({
    id,
    preset_id: findPresetByName(name)?.id ?? null,
    name,
    quantity,
    unit,
    storage,
    expires_on: addDays(today, daysLeft),
    status: 'ACTIVE',
    source: 'MANUAL',
  })

  // 와이어프레임 2번(냉장고) 화면과 같은 재료. daysLeft = 오늘부터 유통기한까지 남은 날
  return [
    item(1, '우유', 1, '개', 'FRIDGE', 1), // D-1
    item(2, '두부', 1, '모', 'FRIDGE', 2), // D-2
    item(3, '대파', 1, '단', 'FRIDGE', 3), // D-3
    item(4, '돼지고기 앞다리살', 300, 'g', 'FRIDGE', 4), // D-4
    item(5, '계란', 10, '개', 'FRIDGE', 12), // D-12
    item(6, '양파', 2, '개', 'ROOM', 20), // D-20
    item(7, '김치', 500, 'g', 'FRIDGE', 15), // D-15
    item(8, '스팸', 1, '캔', 'FREEZER', 60), // D-60
  ]
}

// XP·연속 기록·행동 횟수·뱃지·XP 기록
export function createDummyProgress() {
  const today = todayString()
  const yesterday = addDays(today, -1)
  const at = (dateString, time) => new Date(`${dateString}T${time}`).toISOString()
  const log = (id, action, amount, description, date, time) => ({
    id,
    action,
    amount,
    description,
    created_at: at(date, time),
  })

  return {
    xp: 240, // Lv.3 알뜰 자취러, 다음 레벨(390)까지 150
    streak: {
      current: 7,
      best: 12,
      lastXpDate: today, // 오늘까지 7일 연속 (와이어프레임 8번: '7일 연속 기록중 · 역대 최고 12일')
    },
    // 행동별 누적 횟수 (백엔드는 XP 기록을 세서 계산)
    counts: {
      COOK_COMPLETE: 12,
      EXPIRY_SAVE_BONUS: 14,
      PHOTO_REGISTER: 4,
      CHORE_COMPLETE: 9,
    },
    // 획득한 뱃지: { 코드: 획득 시각 }
    badges: {
      FRIDGE_CLEANER: at(addDays(today, -6), '19:00:00'),
      HOME_COOK_MASTER: at(addDays(today, -4), '20:10:00'),
      STREAK_7: at(addDays(today, -2), '09:00:00'),
    },
    // 최근 XP 기록 (최신순). 성과 화면에서는 요리 완료 + 보너스가 한 줄로 합쳐져 3줄로 보임
    logs: [
      log(4, 'EXPIRY_SAVE_BONUS', 10, '유통기한 내 소진 보너스', today, '12:30:00'),
      log(3, 'COOK_COMPLETE', 10, '두부계란찜 요리 완료', today, '12:30:00'),
      log(2, 'PHOTO_REGISTER', 15, '사진으로 재료 3개 등록', yesterday, '18:05:00'),
      log(1, 'CHORE_COMPLETE', 5, '분리수거 완료', addDays(today, -2), '09:10:00'),
    ],
  }
}

// 생활 알림 (와이어프레임 6번과 같은 항목. 관리비만 꺼 둠 → '알림 5개 켜짐')
// weekdays: 0=월 ... 6=일, remind_time: 'HH:MM:SS'
export function createDummyReminders() {
  const anchor_date = todayString() // 2주마다 같은 간격 계산의 기준일
  const reminder = (id, category, title, rule, remind_time, notify_before_days = 0, enabled = true) => ({
    id,
    category,
    title,
    interval: 1,
    weekdays: [],
    day_of_month: null,
    ...rule,
    remind_time,
    notify_before_days,
    enabled,
    anchor_date,
    last_done_at: null,
  })

  return [
    reminder(1, 'LAUNDRY', '빨래하기', { repeat_type: 'WEEKLY', weekdays: [1, 4] }, '20:00:00'), // 매주 화·금
    reminder(2, 'LAUNDRY', '수건·침구 빨래', { repeat_type: 'WEEKLY', interval: 2, weekdays: [5] }, '10:00:00'), // 2주마다 토
    reminder(3, 'CLEANING', '분리수거', { repeat_type: 'WEEKLY', weekdays: [2] }, '21:00:00'), // 매주 수
    reminder(4, 'CLEANING', '화장실 청소', { repeat_type: 'WEEKLY', weekdays: [6] }, '11:00:00'), // 매주 일
    reminder(5, 'BILL', '전기요금', { repeat_type: 'MONTHLY', day_of_month: 25 }, '09:00:00', 3), // 매달 25일, 3일 전
    reminder(6, 'BILL', '관리비', { repeat_type: 'MONTHLY', day_of_month: 10 }, '09:00:00', 3, false),
  ]
}
