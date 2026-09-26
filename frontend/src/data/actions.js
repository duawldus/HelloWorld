// XP를 얻는 행동들: 요리 완료, 집안일 완료, 사진으로 재료 등록
// 모두 { gainedXp, levelUp, newBadges, progress } 를 돌려줍니다.
//   gainedXp : 이번에 얻은 XP
//   levelUp  : 레벨이 올랐으면 true
//   newBadges: 이번에 새로 딴 뱃지 목록 (없으면 [])
//   progress : 바뀐 뒤의 진행 상황 (getProgress 결과와 같은 모양)
import { loadIngredients, saveIngredients } from './storage.js'
import { applyDeduction, buildIngredient, isExpiringSoon } from './ingredients.js'
import { rewardXp } from './progress.js'
import { XP_RULES } from './rules.js'

// 요리 완료: 쓴 재료를 차감하고 +10 XP.
// 유통기한 3일 이내 재료를 썼으면 +10 보너스, 제때 소진 횟수와 절약 식비도 올라갑니다.
// 예) completeCooking({ recipeName: '두부계란찜', usedIngredients: [{ id: '두부id', amount: 1 }] })
export async function completeCooking({ recipeName, usedIngredients = [] }) {
  const ingredients = await loadIngredients()
  const { used, remaining } = applyDeduction(ingredients, usedIngredients)
  await saveIngredients(remaining)

  const onTimeUsed = used.filter(({ ingredient }) => isExpiringSoon(ingredient))
  const savedMoney = Math.round(
    onTimeUsed.reduce((sum, { ingredient, amount }) => sum + ingredient.unitPrice * amount, 0),
  )

  const entries = [{ label: `요리 완료: ${recipeName}`, xp: XP_RULES.cook }]
  if (onTimeUsed.length > 0) {
    entries.push({ label: '유통기한 내 소진 보너스', xp: XP_RULES.expiringBonus })
  }

  return rewardXp(entries, (stats) => ({
    ...stats,
    cookCount: stats.cookCount + 1,
    onTimeUseCount: stats.onTimeUseCount + onTimeUsed.length,
    savedMoney: stats.savedMoney + savedMoney,
    completedRecipes: stats.completedRecipes.includes(recipeName)
      ? stats.completedRecipes
      : [...stats.completedRecipes, recipeName],
  }))
}

// 집안일 완료: +5 XP. 예) completeChore('세탁')
export async function completeChore(choreName) {
  return rewardXp([{ label: `집안일 완료: ${choreName}`, xp: XP_RULES.chore }], (stats) => ({
    ...stats,
    choreCount: stats.choreCount + 1,
  }))
}

// 사진으로 재료 등록: 냉장고에 넣고 재료 1개당 +5 XP.
// 예) addIngredientsByPhoto([{ name: '계란' }, { name: '두부' }, { name: '우유' }]) → +15 XP
export async function addIngredientsByPhoto(inputs) {
  const ingredients = await loadIngredients()
  const added = inputs.map(buildIngredient)
  await saveIngredients([...ingredients, ...added])

  const result = await rewardXp(
    [{ label: `사진으로 재료 ${added.length}개 등록`, xp: XP_RULES.photoPerIngredient * added.length }],
    (stats) => ({ ...stats, photoRegisterCount: stats.photoRegisterCount + 1 }),
  )
  return { ...result, added }
}
