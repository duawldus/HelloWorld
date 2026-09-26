// 자취생이 자주 사는 재료 목록.
// 재료를 추가할 때 이름이 여기 있으면 단위·보관 위치·유통기한·가격을 자동으로 채웁니다.
//
// packQuantity : 보통 한 번에 사는 양 (단위는 unit)
// price        : 그 양의 대략적인 가격(원). 절약 식비 계산에 씁니다.
// shelfLifeDays: 산 날부터 기본 유통기한(일)
// storage      : 기본 보관 위치 ('냉장' | '냉동' | '실온')

export const INGREDIENT_PRESETS = [
  { name: '계란', unit: '개', packQuantity: 10, price: 3500, shelfLifeDays: 21, storage: '냉장' },
  { name: '두부', unit: '모', packQuantity: 1, price: 1800, shelfLifeDays: 7, storage: '냉장' },
  { name: '우유', unit: 'ml', packQuantity: 1000, price: 2900, shelfLifeDays: 10, storage: '냉장' },
  { name: '양파', unit: '개', packQuantity: 3, price: 2500, shelfLifeDays: 30, storage: '실온' },
  { name: '대파', unit: '단', packQuantity: 1, price: 2500, shelfLifeDays: 10, storage: '냉장' },
  { name: '감자', unit: '개', packQuantity: 3, price: 3000, shelfLifeDays: 21, storage: '실온' },
  { name: '당근', unit: '개', packQuantity: 2, price: 2000, shelfLifeDays: 14, storage: '냉장' },
  { name: '애호박', unit: '개', packQuantity: 1, price: 1800, shelfLifeDays: 7, storage: '냉장' },
  { name: '양배추', unit: '통', packQuantity: 1, price: 3500, shelfLifeDays: 14, storage: '냉장' },
  { name: '콩나물', unit: 'g', packQuantity: 300, price: 1500, shelfLifeDays: 3, storage: '냉장' },
  { name: '팽이버섯', unit: '봉', packQuantity: 1, price: 1000, shelfLifeDays: 7, storage: '냉장' },
  { name: '다진마늘', unit: 'g', packQuantity: 200, price: 3000, shelfLifeDays: 30, storage: '냉장' },
  { name: '돼지고기', unit: 'g', packQuantity: 500, price: 7000, shelfLifeDays: 3, storage: '냉장' },
  { name: '소고기 다짐육', unit: 'g', packQuantity: 300, price: 8000, shelfLifeDays: 3, storage: '냉장' },
  { name: '닭가슴살', unit: '개', packQuantity: 4, price: 8000, shelfLifeDays: 90, storage: '냉동' },
  { name: '냉동만두', unit: '봉', packQuantity: 1, price: 6000, shelfLifeDays: 90, storage: '냉동' },
  { name: '소시지', unit: '개', packQuantity: 6, price: 3500, shelfLifeDays: 14, storage: '냉장' },
  { name: '어묵', unit: '장', packQuantity: 6, price: 2500, shelfLifeDays: 10, storage: '냉장' },
  { name: '김치', unit: 'g', packQuantity: 1000, price: 8000, shelfLifeDays: 30, storage: '냉장' },
  { name: '슬라이스 치즈', unit: '장', packQuantity: 10, price: 4000, shelfLifeDays: 30, storage: '냉장' },
  { name: '요거트', unit: '개', packQuantity: 4, price: 3000, shelfLifeDays: 14, storage: '냉장' },
  { name: '식빵', unit: '장', packQuantity: 12, price: 3000, shelfLifeDays: 5, storage: '실온' },
  { name: '참치캔', unit: '개', packQuantity: 3, price: 5000, shelfLifeDays: 365, storage: '실온' },
  { name: '라면', unit: '개', packQuantity: 5, price: 4500, shelfLifeDays: 180, storage: '실온' },
  { name: '즉석밥', unit: '개', packQuantity: 3, price: 3500, shelfLifeDays: 270, storage: '실온' },
]

export const STORAGE_TYPES = ['냉장', '냉동', '실온']

export function findPreset(name) {
  return INGREDIENT_PRESETS.find((preset) => preset.name === name)
}
