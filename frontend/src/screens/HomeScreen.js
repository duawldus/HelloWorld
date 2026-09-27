// 홈 대시보드 (와이어프레임 1번)
// 냉장고 현황, AI 추천, 다가오는 생활 알림을 한 화면에서 요약해서 보여 줍니다.
// - 위 오른쪽: 트로피 → 성과 · 뱃지(/achievements), 종 → 생활 알림(/alert)
// - 레벨 · 연속기록 카드: 누르면 성과 · 뱃지 화면
// - 유통기한 임박 안내: 누르면 냉장고 화면
// - 오늘의 집안일: 켜 둔 생활 알림 중 3일 안에 할 것만 (누르면 생활 알림 화면)
// - 내 냉장고 요약: 등록 재료 수 / 임박 재료 수
// - 오늘의 추천 레시피: 임박 재료를 많이 쓰는 레시피 1개 + '레시피 추천 더보기'
// 영역마다 따로 불러와서 한 곳이 실패해도(서버 모드에서 준비 중인 API 등) 나머지는 보입니다.
// 화면이 보일 때마다 다시 불러옵니다. (다른 탭에서 재료·알림을 바꾸고 돌아와도 최신 상태)
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import {
  daysUntil,
  difficultyLabel,
  getIngredients,
  getLevelProgress,
  getRecipeRecommendations,
  getReminders,
  getStats,
  STREAK_READY,
} from '../data'
import {
  BellIcon,
  ChevronRightIcon,
  ImageIcon,
  StreakFlameIcon,
  TrophyIcon,
  WarningIcon,
} from '../components/Icons'
import { PageTitle, Screen } from '../components/Screen'
import { colors } from '../theme/colors'

const CHORE_DAYS = 3 // '오늘의 집안일'에 보여 줄 범위: 오늘 ~ 3일 뒤
const CHORE_MAX = 4 // 칩 최대 개수

// 영역 하나의 불러오기 상태: { data, error } (둘 다 null 이면 불러오는 중)
const LOADING = { data: null, error: null }

function useSection(load) {
  const [state, setState] = useState(LOADING)
  const reload = useCallback(() => {
    load()
      .then((data) => setState({ data, error: null }))
      .catch((error) => setState({ data: null, error: error.message }))
  }, [load])
  return [state, reload]
}

const loadRecipes = () => getRecipeRecommendations({ imminent_first: true })

export default function HomeScreen() {
  const [stats, reloadStats] = useSection(getStats)
  const [fridge, reloadFridge] = useSection(getIngredients)
  const [reminders, reloadReminders] = useSection(getReminders)
  const [recipes, reloadRecipes] = useSection(loadRecipes)

  useFocusEffect(
    useCallback(() => {
      reloadStats()
      reloadFridge()
      reloadReminders()
      reloadRecipes()
    }, [reloadStats, reloadFridge, reloadReminders, reloadRecipes]),
  )

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header />
        <LevelCard section={stats} />
        <ImminentNotice section={fridge} />
        <ChoreSection section={reminders} />
        <FridgeSummary section={fridge} />
        <RecipeSection section={recipes} />
      </ScrollView>
    </Screen>
  )
}

// ----- 위쪽 제목 + 트로피 · 종 버튼 -----

function Header() {
  return (
    <View style={styles.header}>
      <PageTitle>방구석 매니저</PageTitle>
      <View style={styles.headerButtons}>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.push('/achievements')}
          accessibilityLabel="성과 · 뱃지 보기"
          hitSlop={4}
        >
          <TrophyIcon size={20} color={colors.textSub} />
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.push('/alert')}
          accessibilityLabel="생활 알림 보기"
          hitSlop={4}
        >
          <BellIcon size={20} color={colors.textSub} />
        </Pressable>
      </View>
    </View>
  )
}

// ----- 레벨 · 연속기록 카드 -----

function LevelCard({ section }) {
  const stats = section.data
  return (
    <Pressable
      style={styles.levelCard}
      onPress={() => router.push('/achievements')}
      accessibilityLabel="레벨과 성과 보기"
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="homeLevelCard" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primaryGradient[0]} />
            <Stop offset="1" stopColor={colors.primaryGradient[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#homeLevelCard)" />
      </Svg>

      {!stats ? (
        <Text style={styles.levelSub}>{section.error ?? '불러오는 중...'}</Text>
      ) : (
        <>
          {STREAK_READY && (
            <View style={styles.streakRow}>
              <StreakFlameIcon size={14} color={colors.textOnPrimarySub} />
              <Text style={styles.streakText}>
                {stats.current_streak > 0
                  ? `${stats.current_streak}일 연속 냉장고 관리중`
                  : '오늘부터 연속 기록을 시작해 보세요'}
              </Text>
            </View>
          )}
          <Text style={styles.levelTitle}>
            Lv.{stats.level} {stats.title} · {stats.xp} XP
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${getLevelProgress(stats) * 100}%` }]} />
          </View>
          <Text style={styles.levelSub}>
            {stats.next_level_xp === null
              ? '최고 레벨 달성!'
              : `다음 레벨까지 XP ${stats.xp_to_next_level} 남음 · 재료를 제때 소진하면 XP를 받아요`}
          </Text>
        </>
      )}
    </Pressable>
  )
}

// ----- 유통기한 임박 안내 -----

function ImminentNotice({ section }) {
  const imminent = section.data?.items.filter((item) => item.is_imminent) ?? []
  if (imminent.length === 0) return null // 임박 재료가 없으면 안내를 숨김

  const first = imminent[0] // 목록이 임박순이라 가장 급한 재료
  const others = imminent.length > 1 ? ` 외 ${imminent.length - 1}개` : ''
  const hasExpired = imminent.some((item) => item.d_day < 0)
  return (
    <Pressable
      style={styles.notice}
      onPress={() => router.push('/fridge')}
      accessibilityLabel="냉장고에서 임박 재료 보기"
    >
      <WarningIcon />
      <Text style={styles.noticeText} numberOfLines={1}>
        {first.name}
        {others},{' '}
        {hasExpired ? '유통기한을 확인해 주세요' : '유통기한이 얼마 안 남았어요'}
      </Text>
      <ChevronRightIcon color={colors.primaryDark} />
    </Pressable>
  )
}

// ----- 오늘의 집안일 -----

// 켜 둔 알림 중 CHORE_DAYS 일 안에 해야 하는 것만, 가까운 순서로
function upcomingChores(reminderList) {
  return reminderList.groups
    .flatMap((group) => group.items)
    .filter((item) => item.enabled && item.next_due_at)
    .map((item) => ({ ...item, days: daysUntil(item.next_due_at.slice(0, 10)) }))
    .filter((item) => item.days >= 0 && item.days <= CHORE_DAYS)
    .sort((a, b) => a.days - b.days || a.next_due_at.localeCompare(b.next_due_at))
    .slice(0, CHORE_MAX)
}

function ChoreSection({ section }) {
  const chores = section.data ? upcomingChores(section.data) : null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>오늘의 집안일</Text>
      {!chores ? (
        <Text style={styles.sectionNotice}>{section.error ?? '불러오는 중...'}</Text>
      ) : chores.length === 0 ? (
        <Pressable onPress={() => router.push('/alert')}>
          <Text style={styles.sectionNotice}>
            {CHORE_DAYS}일 안에 할 집안일이 없어요 · <Text style={styles.link}>생활 알림 보기</Text>
          </Text>
        </Pressable>
      ) : (
        <View style={styles.chips}>
          {chores.map((chore, index) => {
            const urgent = index === 0 // 가장 가까운 집안일만 강조
            return (
              <Pressable
                key={chore.id}
                style={[styles.chip, urgent && styles.chipActive]}
                onPress={() => router.push('/alert')}
                accessibilityLabel={`${chore.title} D-${chore.days}, 생활 알림 보기`}
              >
                <Text style={[styles.chipText, urgent && styles.chipTextActive]}>
                  {chore.title} D-{chore.days}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

// ----- 내 냉장고 요약 -----

function FridgeSummary({ section }) {
  const fridge = section.data
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>내 냉장고</Text>
      {section.error ? (
        <Text style={styles.sectionNotice}>{section.error}</Text>
      ) : (
        <Pressable
          style={styles.statRow}
          onPress={() => router.push('/fridge')}
          accessibilityLabel="냉장고 보기"
        >
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{fridge ? `${fridge.total}개` : '-'}</Text>
            <Text style={styles.statLabel}>등록된 재료</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{fridge ? `${fridge.imminent_count}개` : '-'}</Text>
            <Text style={styles.statLabel}>유통기한 임박</Text>
          </View>
        </Pressable>
      )}
    </View>
  )
}

// ----- 오늘의 추천 레시피 -----

function RecipeSection({ section }) {
  const result = section.data
  // 바로 만들 수 있는 것 중 첫 번째(임박 재료 우선 정렬), 없으면 1~2개 더 필요한 것
  const recipe = result ? (result.ready[0] ?? result.almost[0] ?? null) : null
  const needsIngredients = section.error?.includes('식재료')

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>오늘의 추천 레시피</Text>

      {needsIngredients ? (
        <Pressable onPress={() => router.push('/ingredient/add')}>
          <Text style={styles.sectionNotice}>
            재료를 등록하면 만들 수 있는 요리를 추천해 드려요 ·{' '}
            <Text style={styles.link}>재료 추가하기</Text>
          </Text>
        </Pressable>
      ) : section.error ? (
        <Text style={styles.sectionNotice}>{section.error}</Text>
      ) : !result ? (
        <Text style={styles.sectionNotice}>불러오는 중...</Text>
      ) : !recipe ? (
        <Text style={styles.sectionNotice}>지금 재료로 추천할 수 있는 레시피가 없어요</Text>
      ) : (
        <RecipeCard recipe={recipe} />
      )}

      <Pressable style={styles.moreButton} onPress={() => router.push('/recipe')}>
        <Text style={styles.moreButtonText}>레시피 추천 더보기</Text>
      </Pressable>
    </View>
  )
}

function RecipeCard({ recipe }) {
  const meta = [`${recipe.cook_minutes}분`, difficultyLabel(recipe.difficulty)]
  if (recipe.missing_count > 0) meta.push(`재료 ${recipe.missing_count}개 더 필요`)

  return (
    <Pressable
      style={styles.recipeCard}
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
      accessibilityLabel={`${recipe.title} 레시피 보기`}
    >
      <View style={styles.thumb}>
        <ImageIcon size={22} />
      </View>
      <View style={styles.recipeBody}>
        <Text style={styles.recipeTitle} numberOfLines={1}>
          {recipe.title}
        </Text>
        <Text style={[styles.recipeMeta, recipe.missing_count > 0 && styles.recipeMetaWarn]}>
          {meta.join(' · ')}
        </Text>
        {recipe.imminent_count > 0 && (
          <View style={styles.imminentPill}>
            <Text style={styles.imminentPillText}>임박재료 {recipe.imminent_count}개 사용</Text>
          </View>
        )}
      </View>
      <ChevronRightIcon color={colors.textSub} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
  },

  // 위쪽 제목 + 버튼
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  // 레벨 카드
  levelCard: {
    overflow: 'hidden',
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.primary, // 그라데이션을 못 그릴 때 대신
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textOnPrimarySub,
  },
  levelTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textOnPrimary,
  },
  progressTrack: {
    height: 6,
    marginTop: 14,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: colors.onPrimaryTrack,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.textOnPrimary,
  },
  levelSub: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    color: colors.textOnPrimarySub,
  },

  // 유통기한 임박 안내
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },

  // 섹션 공통
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sectionNotice: {
    paddingVertical: 8,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSub,
  },
  link: {
    fontWeight: '700',
    color: colors.primary,
  },

  // 오늘의 집안일 칩
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
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

  // 내 냉장고 요약
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSub,
  },

  // 추천 레시피 카드
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  recipeBody: {
    flex: 1,
    alignItems: 'flex-start',
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  recipeMeta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSub,
  },
  recipeMetaWarn: {
    color: colors.warning,
  },
  imminentPill: {
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  imminentPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  moreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    marginTop: 12,
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
})
