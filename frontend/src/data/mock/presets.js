// 가짜 모드의 재료 프리셋. 백엔드 backend/app/seeds/data.py 의 PRESETS 와 같은 값입니다.
// 서버 모드에서는 GET /api/v1/ingredients/presets 로 받아 옵니다.
// 모양은 백엔드 PresetRead 와 같습니다: { id, name, icon, default_storage, shelf_life_days, default_quantity, default_unit }

// [이름, 아이콘, 보관, 유통기한(일), 기본 수량, 단위, 자주 쓰는 재료]
const ROWS = [
  ['계란', '🥚', 'FRIDGE', 21, 10, '개', true],
  ['두부', '🧊', 'FRIDGE', 7, 1, '모', true],
  ['대파', '🌿', 'FRIDGE', 10, 1, '단', true],
  ['양파', '🧅', 'ROOM', 30, 2, '개', true],
  ['우유', '🥛', 'FRIDGE', 10, 1, '개', true],
  ['김치', '🥬', 'FRIDGE', 30, 1, '통', true],
  ['돼지고기', '🥩', 'FRIDGE', 4, 300, 'g', true],
  ['스팸', '🥫', 'ROOM', 365, 1, '캔', true],
  ['감자', '🥔', 'ROOM', 30, 3, '개', false],
  ['당근', '🥕', 'FRIDGE', 21, 1, '개', false],
  ['애호박', '🥒', 'FRIDGE', 7, 1, '개', false],
  ['버섯', '🍄', 'FRIDGE', 5, 1, '팩', false],
  ['쪽파', '🌱', 'FRIDGE', 7, 1, '단', false],
  ['소시지', '🌭', 'FRIDGE', 14, 1, '봉', false],
  ['햄', '🍖', 'FRIDGE', 14, 1, '개', false],
  ['참치캔', '🐟', 'ROOM', 365, 1, '캔', false],
  ['닭가슴살', '🍗', 'FRIDGE', 3, 1, '팩', false],
  ['소고기', '🥩', 'FRIDGE', 3, 200, 'g', false],
  ['냉동만두', '🥟', 'FREEZER', 180, 1, '봉', false],
  ['밥', '🍚', 'FREEZER', 30, 2, '공기', false],
  ['라면', '🍜', 'ROOM', 150, 1, '개', false],
  ['치즈', '🧀', 'FRIDGE', 30, 1, '봉', false],
  ['콩나물', '🌱', 'FRIDGE', 3, 1, '봉', false],
  ['어묵', '🍢', 'FRIDGE', 7, 1, '봉', false],
  ['떡', '🍡', 'FRIDGE', 5, 1, '봉', false],
  ['고추', '🌶️', 'FRIDGE', 10, 3, '개', false],
  ['마늘', '🧄', 'FRIDGE', 14, 1, '봉', false],
]

const PRESETS = ROWS.map(([name, icon, storage, days, quantity, unit, frequent], index) => ({
  id: index + 1,
  name,
  icon,
  default_storage: storage,
  shelf_life_days: days,
  default_quantity: quantity,
  default_unit: unit,
  is_frequent: frequent,
}))

// GET /ingredients/presets?frequent=&q= 와 같게 동작
export function listPresets({ frequent = false, q } = {}) {
  return PRESETS.filter((p) => (!frequent || p.is_frequent) && (!q || p.name.includes(q))).map(
    ({ is_frequent, ...preset }) => preset,
  )
}

export function findPresetById(id) {
  return PRESETS.find((p) => p.id === id)
}

export function findPresetByName(name) {
  return PRESETS.find((p) => p.name === name.trim())
}
