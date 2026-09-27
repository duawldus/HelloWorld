// 레시피 상세 화면 (와이어프레임 5번)
// - 재료 체크리스트: 가진 재료 ✓ / 없는 재료 + (대체 가능한 재료 안내), 조리 순서
// - '요리 완료 (재료 소진)': completeCooking 한 번으로 쓴 재료를 냉장고에서 빼고 XP 를 받습니다.
//   소진할 재료는 레시피에 맞는 내 재료 전부 (백엔드가 정함, ingredientIds 생략)
// - 완료 후 XP 배너의 '실행 취소'로 재료와 XP 를 되돌릴 수 있습니다. (undoCooking)
// - 몇 인분 만들지 고르면(기본 1인분) 재료 양이 그만큼 바뀝니다. (scaleAmount, '약간'처럼 숫자가 없는 양은 그대로)
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import {
  MAX_SERVINGS,
  completeCooking,
  difficultyLabel,
  getRecipe,
  scaleAmount,
  undoCooking,
  withJosa,
} from '../data'
import { ClockIcon, FlameIcon, ImageIcon } from '../components/Icons'
import { BackHeader, Screen } from '../components/Screen'
import { Toast, useToast } from '../components/Toast'
import { colors } from '../theme/colors'

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams()
  const [recipe, setRecipe] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [cooked, setCooked] = useState(null) // completeCooking 결과
  const [busy, setBusy] = useState(false)
  const [servings, setServings] = useState(1) // 몇 인분 만들지 (기본 1인분)
  const [toast, showToast] = useToast()

  const load = useCallback(() => {
    getRecipe(Number(id))
      .then((data) => {
        setRecipe(data)
        setLoadError(null)
      })
      .catch((error) => setLoadError(error.message))
  }, [id])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const handleComplete = async () => {
    setBusy(true)
    try {
      const result = await completeCooking({ recipeId: recipe.id, recipeName: recipe.title })
      setCooked(result) // 체크리스트는 요리 전 상태 그대로 둡니다 (방금 쓴 재료가 '없음'으로 바뀌면 헷갈려서)
    } catch (error) {
      showToast({ message: error.message })
    }
    setBusy(false)
  }

  const handleUndo = async () => {
    setBusy(true)
    try {
      await undoCooking(cooked.cook_log_id)
      setCooked(null)
      load()
      showToast({ message: '요리 완료를 취소했어요. 재료와 XP를 되돌렸어요' })
    } catch (error) {
      showToast({ message: error.message })
    }
    setBusy(false)
  }

  if (!recipe) {
    return (
      <Screen edges={['top', 'bottom']}>
        <BackHeader title="레시피" />
        <Text style={styles.empty}>{loadError ?? '불러오는 중...'}</Text>
      </Screen>
    )
  }

  const mainItems = recipe.checklist.filter((item) => !item.is_seasoning)
  const seasoningItems = recipe.checklist.filter((item) => item.is_seasoning)
  // 요리 완료 때 냉장고에서 빠질 재료 (양념 제외, 없으면 가진 대체 재료)
  const toConsume = mainItems
    .map((item) => (item.owned ? item.name : item.owned_substitutes[0]))
    .filter(Boolean)

  return (
    <View style={styles.page}>
      <Screen edges={['top', 'bottom']}>
        <BackHeader title={recipe.title} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.photo}>
            <ImageIcon size={40} />
          </View>

          <View style={styles.metaRow}>
            <ClockIcon />
            <Text style={styles.metaText}>
              {recipe.cook_minutes}분 · {difficultyLabel(recipe.difficulty)}
            </Text>
          </View>
          {recipe.description && <Text style={styles.description}>{recipe.description}</Text>}

          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInRow]}>재료 체크리스트</Text>
            <ServingsStepper value={servings} onChange={setServings} />
          </View>
          <View style={styles.checklist}>
            {[...mainItems, ...seasoningItems].map((item) => (
              <ChecklistRow
                key={item.name}
                item={item}
                amount={scaleAmount(item.amount, recipe.servings, servings)}
              />
            ))}
          </View>
          {servings !== recipe.servings && (
            <Text style={styles.servingsHint}>
              재료 양을 {servings}인분에 맞게 바꿨어요 · 조리 순서의 물 양 등은 {recipe.servings}인분 기준이에요
            </Text>
          )}

          <Text style={styles.sectionTitle}>조리 순서</Text>
          <View style={styles.steps}>
            {recipe.steps.map((step) => (
              <View key={step.step_no} style={styles.step}>
                <Text style={styles.stepNo}>{String(step.step_no).padStart(2, '0')}</Text>
                <Text style={styles.stepText}>{step.description}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {cooked ? (
            <RewardBanner result={cooked} busy={busy} onUndo={handleUndo} />
          ) : (
            <>
              <Pressable
                style={[styles.completeButton, busy && styles.buttonDisabled]}
                onPress={handleComplete}
                disabled={busy}
              >
                <Text style={styles.completeButtonText}>요리 완료 (재료 소진)</Text>
              </Pressable>
              <Text style={styles.footerHint}>
                {toConsume.length > 0
                  ? `완료하면 ${withJosa(toConsume.join('·'), '이', '가')} 냉장고에서 빠져요 · 실수로 눌러도 실행 취소할 수 있어요`
                  : '완료 후 실수로 눌렀다면 실행 취소로 되돌릴 수 있어요'}
              </Text>
            </>
          )}
        </View>

        <Toast toast={toast} style={styles.toast} />
      </Screen>
    </View>
  )
}

// 몇 인분: − 1인분 +  (1 ~ MAX_SERVINGS)
function ServingsStepper({ value, onChange }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepButton, value <= 1 && styles.buttonDisabled]}
        onPress={() => onChange(value - 1)}
        disabled={value <= 1}
        accessibilityLabel="인분 줄이기"
        hitSlop={6}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}인분</Text>
      <Pressable
        style={[styles.stepButton, value >= MAX_SERVINGS && styles.buttonDisabled]}
        onPress={() => onChange(value + 1)}
        disabled={value >= MAX_SERVINGS}
        accessibilityLabel="인분 늘리기"
        hitSlop={6}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  )
}

// 재료 한 줄: ✓ 가진 재료 / + 없는 재료. 없으면 대체 재료 안내
// amount: 고른 인분에 맞춘 양
function ChecklistRow({ item, amount }) {
  const labels = []
  if (item.is_seasoning) labels.push('기본 양념')
  if (item.is_optional) labels.push('선택')
  if (!item.owned) labels.push('없음')

  let hint = null
  if (!item.owned && item.owned_substitutes.length > 0) {
    hint = { text: `${withJosa(item.owned_substitutes.join(', '), '으로', '로')} 대신할 수 있어요`, have: true }
  } else if (!item.owned && item.substitutes.length > 0) {
    hint = { text: `대체 가능: ${item.substitutes.join(', ')}`, have: false }
  }

  return (
    <View>
      <View style={styles.checkRow}>
        <View style={[styles.mark, !item.owned && styles.markMissing]}>
          <Text style={[styles.markText, !item.owned && styles.markTextMissing]}>
            {item.owned ? '✓' : '+'}
          </Text>
        </View>
        <Text style={[styles.checkName, !item.owned && styles.checkNameMissing]}>
          {item.name}
          {labels.length > 0 && <Text style={styles.checkLabel}> ({labels.join(' · ')})</Text>}
        </Text>
        {amount && <Text style={styles.amount}>{amount}</Text>}
      </View>
      {hint && <Text style={[styles.checkHint, hint.have && styles.checkHintHave]}>{hint.text}</Text>}
    </View>
  )
}

// 요리 완료 후 XP 보상 배너 + 실행 취소
function RewardBanner({ result, busy, onUndo }) {
  const { xp, consumed } = result
  const extras = []
  if (xp.level_up) extras.push('레벨이 올랐어요!')
  if (xp.new_badges.length > 0) extras.push(`새 뱃지: ${xp.new_badges.join(', ')}`)

  return (
    <View>
      <View style={styles.reward}>
        <FlameIcon />
        <View style={styles.rewardBody}>
          <Text style={styles.rewardTitle}>+{xp.amount} XP 획득</Text>
          <Text style={styles.rewardText}>{[...xp.reasons, ...extras].join(' · ')}</Text>
        </View>
      </View>
      <View style={styles.afterRow}>
        <Text style={styles.footerHint} numberOfLines={2}>
          {consumed.length > 0
            ? `${consumed.map((c) => c.name).join('·')} 소진 완료`
            : '소진한 재료가 없어요'}
        </Text>
        <Pressable onPress={onUndo} disabled={busy} hitSlop={8}>
          <Text style={[styles.undoText, busy && styles.buttonDisabled]}>실행 취소</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  photo: {
    width: '100%',
    aspectRatio: 16 / 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSub,
  },
  description: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },

  // 재료 체크리스트 + 인분
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitleInRow: {
    marginTop: 0,
    marginBottom: 0,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  stepButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  stepText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  stepValue: {
    minWidth: 52,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  servingsHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSub,
  },
  checklist: {
    gap: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: colors.primaryLight,
  },
  markMissing: {
    backgroundColor: colors.warningLight,
  },
  markText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  markTextMissing: {
    color: colors.warning,
  },
  checkName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  checkNameMissing: {
    color: colors.textSub,
  },
  checkLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSub,
  },
  amount: {
    fontSize: 13,
    color: colors.textSub,
  },
  checkHint: {
    marginTop: 3,
    marginLeft: 32,
    fontSize: 12,
    color: colors.textSub,
  },
  checkHintHave: {
    fontWeight: '600',
    color: colors.primary,
  },

  // 조리 순서
  steps: {
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    gap: 10,
  },
  stepNo: {
    width: 22,
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },

  // 아래 고정 영역
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.screenBg,
  },
  completeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  footerHint: {
    flexShrink: 1,
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    color: colors.textSub,
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.warning,
  },
  rewardBody: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textOnPrimary,
  },
  rewardText: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textOnPrimary,
  },
  afterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  undoText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },

  empty: {
    marginTop: 40,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSub,
  },
  toast: {
    bottom: 120, // 아래 고정 버튼 위
  },
})
