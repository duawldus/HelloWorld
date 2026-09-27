// 레시피 추천 화면 (와이어프레임 4번)
// - 내 냉장고 재료 + 보유 양념으로 추천. '바로 만들 수 있어요'(부족 0) / '1~2개만 더 있으면' 탭으로 나눠 보여 줍니다.
// - 필터 칩(임박 재료 먼저 / 15분 이내 / 1인분)을 누르면 다시 추천받습니다.
// - 한 번에 3개씩 보여 주고, '다른 레시피 추천받기'로 다음 3개를 봅니다. (마지막 다음은 처음으로)
// - 카드를 누르면 레시피 상세(/recipe/[id])로 이동합니다.
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { difficultyLabel, getOwnedSeasonings, getRecipeRecommendations } from '../data'
import { CheckIcon, ImageIcon, RefreshIcon, SparkleIcon } from '../components/Icons'
import { PageTitle, Screen } from '../components/Screen'
import { Toast, useToast } from '../components/Toast'
import { colors } from '../theme/colors'

const PAGE_SIZE = 3
const READY = 'ready'
const ALMOST = 'almost'

// 필터 칩: 켜면 백엔드 추천 쿼리에 들어갈 값
const FILTERS = [
  { key: 'imminent_first', label: '임박 재료 먼저', on: true },
  { key: 'max_minutes', label: '15분 이내', on: 15 },
  { key: 'servings', label: '1인분', on: 1 },
]

export default function RecipeScreen() {
  const [filters, setFilters] = useState({ imminent_first: true }) // 켜진 필터만
  const [result, setResult] = useState(null) // { basis_ingredient_count, ready, almost }
  const [seasonings, setSeasonings] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [tab, setTab] = useState(READY)
  const [page, setPage] = useState(0)
  const [toast, showToast] = useToast()

  const load = useCallback(() => {
    Promise.all([
      getRecipeRecommendations({ imminent_first: false, ...filters }),
      getOwnedSeasonings(),
    ])
      .then(([recommendations, owned]) => {
        setResult(recommendations)
        setSeasonings(owned)
        setLoadError(null)
      })
      .catch((error) => {
        setResult(null)
        setLoadError(error.message)
      })
  }, [filters])

  // 화면이 보일 때마다(냉장고에서 재료를 바꾸고 온 뒤 등), 필터를 바꿀 때마다 다시 추천
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const toggleFilter = ({ key, on }) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (next[key]) delete next[key]
      else next[key] = on
      return next
    })
    setPage(0)
  }

  const changeTab = (next) => {
    setTab(next)
    setPage(0)
  }

  const list = result?.[tab] ?? []
  const pageCount = Math.ceil(list.length / PAGE_SIZE)
  const shown = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const showOthers = () => {
    if (pageCount > 1) {
      setPage((page + 1) % pageCount)
      return
    }
    load()
    showToast({ message: '지금 재료로 추천할 수 있는 레시피는 이게 전부예요' })
  }

  return (
    <View style={styles.page}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <SparkleIcon size={22} />
            <PageTitle>AI 레시피 추천</PageTitle>
          </View>
          <Text style={styles.summary}>
            {result
              ? `내 냉장고 재료 ${result.basis_ingredient_count}개를 기준으로 추천했어요`
              : '내 냉장고 재료로 만들 수 있는 요리를 찾아요'}
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            style={styles.chipScroll}
          >
            {FILTERS.map((filter) => {
              const active = Boolean(filters[filter.key])
              return (
                <Pressable
                  key={filter.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleFilter(filter)}
                  accessibilityState={{ selected: active }}
                >
                  {active && <CheckIcon size={14} color={colors.textOnPrimary} />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {filter.label}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          {loadError ? (
            <ErrorState message={loadError} onRetry={load} />
          ) : (
            <>
              <View style={styles.segments}>
                <SegmentButton
                  label={`바로 만들 수 있어요 ${result?.ready.length ?? ''}`}
                  active={tab === READY}
                  onPress={() => changeTab(READY)}
                />
                <SegmentButton
                  label={`1~2개만 더 있으면 ${result?.almost.length ?? ''}`}
                  active={tab === ALMOST}
                  onPress={() => changeTab(ALMOST)}
                />
              </View>

              <SeasoningHint seasonings={seasonings} />

              {result && shown.length === 0 && (
                <Text style={styles.empty}>
                  {tab === READY
                    ? '지금 재료로 바로 만들 수 있는 요리가 없어요.\n‘1~2개만 더 있으면’ 탭을 확인해 보세요.'
                    : '재료 1~2개만 더 있으면 되는 요리가 없어요.'}
                </Text>
              )}

              <View style={styles.cards}>
                {shown.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onPress={() =>
                      router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })
                    }
                  />
                ))}
              </View>

              {result && list.length > 0 && (
                <Pressable style={styles.moreButton} onPress={showOthers}>
                  <RefreshIcon />
                  <Text style={styles.moreButtonText}>
                    다른 레시피 추천받기
                    {pageCount > 1 && (
                      <Text style={styles.pageText}>{`  ${page + 1}/${pageCount}`}</Text>
                    )}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>

        <Toast toast={toast} />
      </Screen>
    </View>
  )
}

function SegmentButton({ label, active, onPress }) {
  return (
    <Pressable
      style={[styles.segment, active && styles.segmentActive]}
      onPress={onPress}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  )
}

// 추천에 쓴 보유 양념 안내. 양념을 하나도 안 골랐으면 설정하러 가기
function SeasoningHint({ seasonings }) {
  if (seasonings.length === 0) {
    return (
      <Pressable onPress={() => router.push({ pathname: '/onboarding', params: { mode: 'edit' } })}>
        <Text style={styles.hint}>
          가진 양념을 알려주면 더 정확하게 추천해요 · <Text style={styles.hintLink}>양념 설정</Text>
        </Text>
      </Pressable>
    )
  }
  const names = seasonings.map((s) => s.name)
  const shownNames = names.length > 4 ? `${names.slice(0, 4).join('·')} 외 ${names.length - 4}개` : names.join('·')
  return <Text style={styles.hint}>보유 양념({shownNames})은 있다고 보고 추천해요</Text>
}

function RecipeCard({ recipe, onPress }) {
  const meta = [`${recipe.cook_minutes}분`, difficultyLabel(recipe.difficulty)]
  if (recipe.missing_count > 0) meta.push(`재료 ${recipe.missing_count}개 더 필요`)

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityLabel={`${recipe.title} 레시피 보기`}>
      <View style={styles.thumb}>
        <ImageIcon size={24} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
          {recipe.uses_imminent && (
            <View style={styles.imminentPill}>
              <Text style={styles.imminentPillText}>임박재료 사용</Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardMeta, recipe.missing_count > 0 && styles.cardMetaWarn]}>
          {meta.join(' · ')}
        </Text>
        <View style={styles.tags}>
          {recipe.tags.map((tag) => (
            <IngredientTag key={tag.name} tag={tag} />
          ))}
        </View>
      </View>
    </Pressable>
  )
}

// 재료 태그: 임박 재료는 진하게, 없는 재료는 주황 '+'
function IngredientTag({ tag }) {
  const style = !tag.owned ? styles.tagMissing : tag.imminent ? styles.tagHit : null
  const textStyle = !tag.owned ? styles.tagTextMissing : tag.imminent ? styles.tagTextHit : null
  return (
    <View style={[styles.tag, style]}>
      <Text style={[styles.tagText, textStyle]}>
        {!tag.owned && '+ '}
        {tag.name}
      </Text>
    </View>
  )
}

function ErrorState({ message, onRetry }) {
  const needsIngredients = message.includes('식재료')
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>
        {needsIngredients ? '냉장고에 재료를 1개 이상 등록하면\n만들 수 있는 요리를 추천해 드려요' : message}
      </Text>
      <Pressable
        style={styles.errorButton}
        onPress={needsIngredients ? () => router.push('/ingredient/add') : onRetry}
      >
        <Text style={styles.errorButtonText}>{needsIngredients ? '재료 추가하기' : '다시 시도'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summary: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSub,
  },

  // 필터 칩
  chipScroll: {
    marginTop: 20,
    marginHorizontal: -20, // 칩이 화면 끝까지 스크롤되게
  },
  chips: {
    gap: 8,
    paddingHorizontal: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSub,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },

  // 바로 / 1~2개 탭
  segments: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  segmentActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSub,
  },
  segmentTextActive: {
    color: colors.primaryDark,
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSub,
  },
  hintLink: {
    fontWeight: '700',
    color: colors.primary,
  },

  // 레시피 카드
  cards: {
    gap: 10,
    marginTop: 14,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  imminentPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  imminentPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  cardMeta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSub,
  },
  cardMetaWarn: {
    color: colors.warning,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  tag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.screenBg,
  },
  tagHit: {
    backgroundColor: colors.primaryLight,
  },
  tagMissing: {
    backgroundColor: colors.warningLight,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSub,
  },
  tagTextHit: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  tagTextMissing: {
    fontWeight: '700',
    color: colors.warning,
  },

  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  moreButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  pageText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSub,
  },

  empty: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSub,
  },
  errorBox: {
    alignItems: 'center',
    gap: 14,
    marginTop: 48,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSub,
  },
  errorButton: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
})
