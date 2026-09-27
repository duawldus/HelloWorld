// 성과 · 뱃지 화면 (와이어프레임 8번). 홈에서 router.push('/achievements') 로 들어옵니다.
// - 화면에 들어올 때마다 최신 데이터를 다시 불러옵니다. (요리 완료 후 돌아오면 반영)
// - 레벨 카드 / 통계 / 뱃지 / 최근 XP 를 따로 불러와서, 한 곳이 실패해도 나머지는 보입니다.
// - 서버 모드에서 백엔드가 준비 중인 연속 기록·뱃지는 그 영역만 '준비 중이에요'로 보여 줍니다.
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import {
  getBadges,
  getLevelProgress,
  getStats,
  getXpLogs,
  relativeDayLabel,
  summarizeXpLogs,
  BADGES_READY,
  STREAK_READY,
} from '../data'
import {
  BookIcon,
  CameraIcon,
  ChefHatIcon,
  FlameIcon,
  LeafIcon,
  LockIcon,
  TrophyIcon,
} from '../components/Icons'
import { BackHeader, Screen } from '../components/Screen'
import { colors } from '../theme/colors'

const RECENT_XP_COUNT = 5

// 뱃지 코드 → 선 아이콘
const BADGE_ICONS = {
  FRIDGE_CLEANER: LeafIcon,
  HOME_COOK_MASTER: ChefHatIcon,
  STREAK_7: FlameIcon,
  STREAK_30: TrophyIcon,
  RECIPE_20: BookIcon,
  PHOTO_10: CameraIcon,
}

// 영역 하나의 불러오기 상태: { data, error } (data 가 null 이고 error 도 없으면 불러오는 중)
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

const loadLogs = () => getXpLogs(20)

export default function AchievementsScreen() {
  const [stats, reloadStats] = useSection(getStats)
  const [badges, reloadBadges] = useSection(getBadges)
  const [logs, reloadLogs] = useSection(loadLogs)
  const [openBadge, setOpenBadge] = useState(null) // 진행도 창에 보여 줄 뱃지

  useFocusEffect(
    useCallback(() => {
      reloadStats()
      reloadBadges()
      reloadLogs()
    }, [reloadStats, reloadBadges, reloadLogs]),
  )

  return (
    <View style={styles.page}>
      <Screen edges={['top', 'bottom']}>
        <BackHeader title="성과 · 뱃지" fallback="/" />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LevelCard section={stats} />
          <StatCards section={stats} />
          <BadgeSection section={badges} onPressBadge={setOpenBadge} />
          <XpSection section={logs} />
        </ScrollView>
      </Screen>

      {openBadge && <BadgeDialog badge={openBadge} onClose={() => setOpenBadge(null)} />}
    </View>
  )
}

// ----- 레벨 카드 -----

function LevelCard({ section }) {
  const stats = section.data
  return (
    <View style={styles.levelCard}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="levelCard" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primaryGradient[0]} />
            <Stop offset="1" stopColor={colors.primaryGradient[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#levelCard)" />
      </Svg>

      {!stats ? (
        <Text style={styles.levelSub}>{section.error ?? '불러오는 중...'}</Text>
      ) : (
        <>
          <View style={styles.streakPill}>
            <FlameIcon size={14} color={colors.textSub} />
            <Text style={styles.streakText}>
              {!STREAK_READY
                ? '연속 기록은 준비 중이에요'
                : stats.current_streak > 0
                  ? `${stats.current_streak}일 연속 기록중 · 역대 최고 ${stats.best_streak}일`
                  : `오늘 기록을 시작해 보세요 · 역대 최고 ${stats.best_streak}일`}
            </Text>
          </View>
          <Text style={styles.levelTitle}>
            Lv.{stats.level} {stats.title} · {stats.xp} XP
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${getLevelProgress(stats) * 100}%` }]} />
          </View>
          <Text style={styles.levelSub}>
            {stats.next_level_xp === null
              ? '최고 레벨 달성!'
              : `다음 레벨까지 XP ${stats.xp_to_next_level} 남음`}
          </Text>
        </>
      )}
    </View>
  )
}

// ----- 통계 카드 2개 -----

function StatCards({ section }) {
  const stats = section.data
  return (
    <View style={styles.statRow}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats ? `${stats.saved_count}회` : '-'}</Text>
        <Text style={styles.statLabel}>제때 소진</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>
          {stats ? `약 ${formatWon(stats.saved_money_estimate)}원` : '-'}
        </Text>
        <Text style={styles.statLabel}>절약 추정 식비</Text>
      </View>
    </View>
  )
}

// 32200 → '32,000' (참고용 수치라 천 원 단위로 반올림)
function formatWon(amount) {
  return String(Math.round(amount / 1000) * 1000).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// ----- 뱃지 -----

function BadgeSection({ section, onPressBadge }) {
  const data = section.data
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        획득한 뱃지{BADGES_READY && data ? ` ${data.acquired_count} / ${data.total_count}` : ''}
      </Text>
      {!BADGES_READY ? (
        <Text style={styles.notice}>뱃지는 준비 중이에요</Text>
      ) : !data ? (
        <Text style={styles.notice}>{section.error ?? '불러오는 중...'}</Text>
      ) : (
        <View style={styles.badgeGrid}>
          {data.badges.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} onPress={() => onPressBadge(badge)} />
          ))}
        </View>
      )}
    </View>
  )
}

function BadgeCard({ badge, onPress }) {
  const Icon = BADGE_ICONS[badge.code] ?? TrophyIcon
  return (
    <Pressable
      style={[styles.badgeCard, !badge.acquired && styles.badgeCardLocked]}
      onPress={onPress}
      accessibilityLabel={`${badge.name} ${badge.acquired ? '획득' : '미획득'}`}
    >
      <View style={[styles.badgeCircle, !badge.acquired && styles.badgeCircleLocked]}>
        {badge.acquired ? <Icon size={24} color={colors.primary} /> : <LockIcon size={22} />}
      </View>
      <Text style={[styles.badgeName, !badge.acquired && styles.badgeNameLocked]} numberOfLines={1}>
        {badge.name}
      </Text>
    </Pressable>
  )
}

// 뱃지를 누르면 뜨는 작은 창: 획득 조건과 진행도 (다음 목표 안내)
function BadgeDialog({ badge, onClose }) {
  const Icon = BADGE_ICONS[badge.code] ?? TrophyIcon
  const progress = Math.min(badge.progress, badge.threshold)
  const left = badge.threshold - progress

  return (
    <View style={styles.dialogLayer}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="창 닫기" />
      <View style={styles.dialog}>
        <View style={[styles.badgeCircle, !badge.acquired && styles.badgeCircleLocked]}>
          {badge.acquired ? <Icon size={24} color={colors.primary} /> : <LockIcon size={22} />}
        </View>
        <Text style={styles.dialogTitle}>{badge.name}</Text>
        <Text style={styles.dialogDescription}>
          {badge.description} · {progress}/{badge.threshold}
        </Text>
        <View style={styles.dialogTrack}>
          <View style={[styles.dialogFill, { width: `${(progress / badge.threshold) * 100}%` }]} />
        </View>
        <Text style={styles.dialogHint}>
          {badge.acquired
            ? badge.acquired_at
              ? `${formatMonthDay(badge.acquired_at)}에 획득했어요`
              : '획득했어요'
            : `다음 목표까지 ${left} 남았어요!`}
        </Text>
        <Pressable style={styles.dialogButton} onPress={onClose}>
          <Text style={styles.dialogButtonText}>확인</Text>
        </Pressable>
      </View>
    </View>
  )
}

// '2026-09-21T19:00:00' → '9월 21일'
function formatMonthDay(isoString) {
  const date = new Date(isoString)
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}

// ----- 최근 획득 XP -----

function XpSection({ section }) {
  const rows = section.data ? summarizeXpLogs(section.data).slice(0, RECENT_XP_COUNT) : null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>최근 획득 XP</Text>
      {!rows ? (
        <Text style={styles.notice}>{section.error ?? '불러오는 중...'}</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.notice}>아직 얻은 XP가 없어요. 재료를 제때 소진해 보세요!</Text>
      ) : (
        rows.map((row) => (
          <View key={row.id} style={styles.xpRow}>
            <View style={styles.xpInfo}>
              <Text style={styles.xpTitle}>{row.title}</Text>
              <Text style={styles.xpSub}>
                {[relativeDayLabel(row.created_at), ...row.reasons].join(' · ')}
              </Text>
            </View>
            <View style={styles.xpPill}>
              <Text style={styles.xpPillText}>+{row.amount} XP</Text>
            </View>
          </View>
        ))
      )}
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
    paddingBottom: 32,
  },

  // 레벨 카드
  levelCard: {
    overflow: 'hidden',
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.primary, // 그라데이션을 못 그릴 때 대신
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.onPrimaryPill,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSub,
  },
  levelTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '800',
    color: colors.textOnPrimary,
  },
  progressTrack: {
    height: 6,
    marginTop: 18,
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
    marginTop: 14,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textOnPrimarySub,
  },

  // 통계 카드
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    paddingVertical: 18,
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

  // 섹션 공통
  section: {
    marginTop: 26,
  },
  sectionTitle: {
    marginBottom: 14,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  notice: {
    paddingVertical: 16,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSub,
  },

  // 뱃지 3칸 그리드
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  badgeCard: {
    width: '31.5%',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  badgeCardLocked: {
    opacity: 0.5,
  },
  badgeCircle: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
  },
  badgeCircleLocked: {
    backgroundColor: colors.pageBg,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  badgeNameLocked: {
    color: colors.textSub,
  },

  // 뱃지 진행도 창
  dialogLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
  },
  dialog: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  dialogTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  dialogDescription: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSub,
  },
  dialogTrack: {
    alignSelf: 'stretch',
    height: 6,
    marginTop: 16,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: colors.primaryLight,
  },
  dialogFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  dialogHint: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  dialogButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  dialogButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },

  // 최근 획득 XP
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  xpInfo: {
    flex: 1,
  },
  xpTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  xpSub: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSub,
  },
  xpPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  xpPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
})
