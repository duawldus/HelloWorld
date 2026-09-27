// 가짜 모드의 레시피 추천 · 상세. 백엔드 recipes API 와 같은 모양으로 돌려줍니다.
// 레시피 목록은 백엔드 backend/app/seeds/data.py 의 RECIPES 와 같은 값입니다. (id 는 1부터 순서대로)
// 추천 규칙은 백엔드 recipes/service.py 의 recommend() 설명(TODO)을 그대로 따릅니다.
import { loadIngredients, loadSeasoningState } from './storage.js'
import { toRead } from './ingredients.js'
import { SEASONINGS } from './seasonings.js'

// 재료: [이름, 양, 양념 여부, 선택 여부, 대체 재료]
const RECIPE_ROWS = [
  {
    title: '김치찌개',
    cook_minutes: 25,
    difficulty: 'EASY',
    cookware: 'POT',
    ingredients: [
      ['김치', '1컵', false, false, []],
      ['두부', '1/2모', false, false, []],
      ['대파', '1/2대', false, true, ['쪽파', '양파']],
      ['돼지고기', '100g', false, false, ['스팸', '참치캔']],
      ['고춧가루', '1큰술', true, true, []],
      ['다진마늘', '1작은술', true, true, []],
    ],
    steps: [
      '냄비에 돼지고기와 김치를 넣고 중불에서 3분간 볶아요.',
      '물 2컵을 붓고 고춧가루·다진마늘을 넣어 끓여요.',
      '끓어오르면 두부와 대파를 넣고 5분 더 끓이면 완성!',
    ],
  },
  {
    title: '두부 계란부침',
    cook_minutes: 15,
    difficulty: 'EASY',
    cookware: 'ONE_PAN',
    ingredients: [
      ['두부', '1모', false, false, []],
      ['계란', '2개', false, false, []],
      ['대파', '약간', false, false, ['쪽파', '양파']],
      ['간장', '1큰술', true, false, []],
      ['식용유', '2큰술', true, false, []],
    ],
    steps: [
      '두부를 1cm 두께로 썰고 키친타월로 물기를 제거해요.',
      '계란을 풀고 다진 대파를 섞어 계란물을 만들어요.',
      '두부에 계란물을 입혀 기름 두른 팬에 앞뒤로 노릇하게 부쳐요.',
    ],
  },
  {
    title: '계란말이',
    cook_minutes: 10,
    difficulty: 'EASY',
    cookware: 'ONE_PAN',
    ingredients: [
      ['계란', '3개', false, false, []],
      ['양파', '1/4개', false, true, ['대파', '쪽파']],
      ['소금', '약간', true, false, []],
      ['식용유', '1큰술', true, false, []],
    ],
    steps: [
      '계란을 풀고 잘게 다진 양파와 소금을 넣어 섞어요.',
      '약불로 달군 팬에 계란물을 얇게 부어요.',
      '반쯤 익으면 돌돌 말고, 남은 계란물을 부어가며 반복해요.',
    ],
  },
  {
    title: '두부계란찜',
    cook_minutes: 12,
    difficulty: 'EASY',
    cookware: 'MICROWAVE',
    ingredients: [
      ['두부', '1/2모', false, false, []],
      ['계란', '2개', false, false, []],
      ['대파', '약간', false, true, ['쪽파']],
      ['소금', '약간', true, false, []],
    ],
    steps: [
      '두부를 으깨고 계란·물 3큰술·소금을 넣어 잘 섞어요.',
      '전자레인지용 그릇에 담고 대파를 올려요.',
      '랩을 씌워 전자레인지에 3~4분 돌리면 완성!',
    ],
  },
  {
    title: '양파 계란덮밥',
    cook_minutes: 15,
    difficulty: 'EASY',
    cookware: 'ONE_PAN',
    ingredients: [
      ['밥', '1공기', false, false, []],
      ['양파', '1/2개', false, false, []],
      ['계란', '2개', false, false, []],
      ['간장', '2큰술', true, false, []],
      ['설탕', '1큰술', true, false, []],
    ],
    steps: [
      '양파를 채 썰어 간장·설탕·물 4큰술과 함께 팬에서 졸여요.',
      '양파가 투명해지면 풀어둔 계란을 둘러 반숙으로 익혀요.',
      '밥 위에 올리면 완성!',
    ],
  },
  {
    title: '스팸마요덮밥',
    cook_minutes: 10,
    difficulty: 'EASY',
    cookware: 'ONE_PAN',
    ingredients: [
      ['밥', '1공기', false, false, []],
      ['스팸', '1/3캔', false, false, ['햄', '참치캔']],
      ['계란', '1개', false, false, []],
      ['마요네즈', '적당량', true, false, []],
      ['간장', '1큰술', true, false, []],
    ],
    steps: [
      '스팸을 깍둑썰기해 노릇하게 구워요.',
      '계란은 스크램블로 익혀요.',
      '밥 위에 스팸·계란을 올리고 간장과 마요네즈를 뿌려요.',
    ],
  },
  {
    title: '대파 계란볶음밥',
    cook_minutes: 15,
    difficulty: 'EASY',
    cookware: 'ONE_PAN',
    ingredients: [
      ['밥', '1공기', false, false, []],
      ['대파', '1대', false, false, ['쪽파', '양파']],
      ['계란', '2개', false, false, []],
      ['간장', '1큰술', true, false, []],
      ['식용유', '2큰술', true, false, []],
    ],
    steps: [
      '기름에 송송 썬 대파를 볶아 파기름을 내요.',
      '계란을 넣어 스크램블한 뒤 밥을 넣고 볶아요.',
      '팬 가장자리에 간장을 눌러 향을 입히면 완성!',
    ],
  },
]

const RECIPES = RECIPE_ROWS.map((row, index) => ({
  id: index + 1,
  title: row.title,
  description: null,
  image_url: null,
  cook_minutes: row.cook_minutes,
  difficulty: row.difficulty,
  servings: 1,
  cookware: row.cookware,
  ingredients: row.ingredients.map(([name, amount, is_seasoning, is_optional, substitutes]) => ({
    name,
    amount,
    is_seasoning,
    is_optional,
    substitutes,
  })),
  steps: row.steps.map((description, i) => ({ step_no: i + 1, description })),
}))

// 1~2개만 부족하면 '1~2개만 더 있으면', 3개 이상 부족하면 추천하지 않음
const MAX_MISSING = 2

// GET /recipes/recommendations → { basis_ingredient_count, ready, almost }
// 옵션 이름은 백엔드 쿼리와 같게 (imminent_first, max_minutes, servings, limit)
export async function getRecipeRecommendations({
  imminent_first = true,
  max_minutes = null,
  servings = null,
  limit = 10,
} = {}) {
  const pantry = await loadPantry()
  if (pantry.items.length === 0) throw new Error('식재료를 1개 이상 등록해 주세요')

  const cards = RECIPES.filter(
    (recipe) =>
      (!max_minutes || recipe.cook_minutes <= max_minutes) &&
      (!servings || recipe.servings === servings),
  )
    .map((recipe) => toCard(recipe, pantry))
    .filter((card) => card.missing_count <= MAX_MISSING)
    .sort(
      (a, b) =>
        (imminent_first ? b.imminent_count - a.imminent_count : 0) ||
        a.missing_count - b.missing_count ||
        a.cook_minutes - b.cook_minutes ||
        a.id - b.id,
    )
    .slice(0, limit)

  return {
    basis_ingredient_count: pantry.items.length,
    ready: cards.filter((card) => card.missing_count === 0),
    almost: cards.filter((card) => card.missing_count > 0),
  }
}

// GET /recipes/{id} → 재료 체크리스트(보유/부족/대체재) + 조리 순서
export async function getRecipe(id) {
  const recipe = findRecipe(id)
  const pantry = await loadPantry()
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    image_url: recipe.image_url,
    cook_minutes: recipe.cook_minutes,
    difficulty: recipe.difficulty,
    servings: recipe.servings,
    checklist: recipe.ingredients.map((ri) => ({
      name: ri.name,
      amount: ri.amount,
      owned: pantry.owns(ri.name),
      is_seasoning: ri.is_seasoning,
      is_optional: ri.is_optional,
      substitutes: ri.substitutes,
      owned_substitutes: ri.substitutes.filter((s) => pantry.owns(s)),
    })),
    steps: recipe.steps,
  }
}

// ----- 아래는 가짜 모드 안에서만 쓰는 함수 -----

export function findRecipe(id) {
  const recipe = RECIPES.find((r) => r.id === Number(id))
  if (!recipe) throw new Error('레시피를 찾을 수 없습니다.')
  return recipe
}

// 요리 완료 때 소진할 내 재료 id (백엔드: ingredient_ids 를 생략하면 '레시피에 매칭된 보유 재료 전부')
// 양념은 냉장고 재료가 아니라서 빠지고, 없는 재료 대신 가진 대체 재료가 있으면 그걸 씁니다.
export async function matchedIngredientIds(recipeId) {
  const recipe = findRecipe(recipeId)
  const pantry = await loadPantry()
  const ids = new Set()
  for (const ri of recipe.ingredients) {
    if (ri.is_seasoning) continue
    const name = [ri.name, ...ri.substitutes].find((n) => pantry.findItem(n))
    if (name) ids.add(pantry.findItem(name).id)
  }
  return [...ids]
}

// 사용자가 가진 것 = 냉장고 재료 + 보유 양념 (백엔드 load_pantry 와 같음)
async function loadPantry() {
  const items = (await loadIngredients())
    .filter((item) => item.status === 'ACTIVE')
    .map(toRead)
    .sort((a, b) => a.expires_on.localeCompare(b.expires_on) || a.id - b.id) // 급한 것부터 씀
  const { owned_ids } = await loadSeasoningState()
  const seasoningNames = new Set(
    SEASONINGS.filter((s) => owned_ids.includes(s.id)).map((s) => s.name),
  )
  // 재료 이름이 조금 달라도 포함되면 같은 재료로 봅니다. 예) 레시피 '돼지고기' ↔ 내 재료 '돼지고기 앞다리살'
  // (백엔드는 아직 이름이 똑같아야 매칭 — README 의 '재료명 동의어 매칭' TODO)
  const findItem = (name) => items.find((item) => item.name.replace(/\s/g, '').includes(name))
  return {
    items,
    findItem,
    owns: (name) => seasoningNames.has(name) || Boolean(findItem(name)),
  }
}

// 레시피 → 추천 카드 (백엔드 RecipeCard 모양)
function toCard(recipe, pantry) {
  let missing = 0
  let imminent = 0
  const tags = []
  for (const ri of recipe.ingredients) {
    const usable = [ri.name, ...ri.substitutes].find((n) => pantry.owns(n))
    if (!usable && !ri.is_optional) missing += 1
    if (ri.is_seasoning) continue // 태그는 주재료만
    const item = usable ? pantry.findItem(usable) : null
    if (item?.is_imminent) imminent += 1
    const own = pantry.findItem(ri.name)
    tags.push({ name: ri.name, owned: Boolean(own), imminent: Boolean(own?.is_imminent) })
  }
  return {
    id: recipe.id,
    title: recipe.title,
    image_url: recipe.image_url,
    cook_minutes: recipe.cook_minutes,
    difficulty: recipe.difficulty,
    servings: recipe.servings,
    uses_imminent: imminent > 0,
    imminent_count: imminent,
    missing_count: missing,
    tags,
  }
}
