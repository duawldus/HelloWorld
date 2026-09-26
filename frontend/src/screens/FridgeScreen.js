// 냉장고 화면 (와이어프레임 2번)
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import {
  getIngredients,
  getDaysLeft,
  matchesName,
  STORAGE_TYPES,
  EXPIRING_SOON_DAYS,
} from '../data'
import { ChevronDownIcon, CloseIcon, ImageIcon, PlusIcon, SearchIcon } from '../components/Icons'
import { PageTitle, Screen } from '../components/Screen'
import { SearchBar } from '../components/SearchBar'
import { Toast, useToast } from '../components/Toast'
import { colors } from '../theme/colors'

const FILTERS = ['전체', ...STORAGE_TYPES]

export default function FridgeScreen() {
  const [ingredients, setIngredients] = useState([])
  const [filter, setFilter] = useState('전체')
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, showToast] = useToast()
  const { photoAdded, xp } = useLocalSearchParams()

  // 사진으로 등록하고 돌아왔을 때 (/fridge?photoAdded=3&xp=15)
  useEffect(() => {
    if (!photoAdded) return
    showToast({ message: `재료 ${photoAdded}개를 등록했어요 · +${xp} XP` })
    router.setParams({ photoAdded: undefined, xp: undefined }) // 다시 보일 때 또 뜨지 않게
  }, [photoAdded, xp, showToast])

  const toggleSearch = () => {
    setSearching(!searching)
    setQuery('')
  }

  // 이 화면이 보일 때마다 재료를 다시 불러옵니다 (재료 추가 후 돌아왔을 때 등)
  useFocusEffect(
    useCallback(() => {
      getIngredients().then(setIngredients)
    }, []),
  )

  const sorted = ingredients
    .map((item) => ({ ...item, daysLeft: getDaysLeft(item) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
  const shown = sorted.filter(
    (item) => (filter === '전체' || item.storage === filter) && matchesName(item.name, query),
  )
  const urgent = shown.filter((item) => item.daysLeft <= EXPIRING_SOON_DAYS)
  const relaxed = shown.filter((item) => item.daysLeft > EXPIRING_SOON_DAYS)
  const urgentTotal = sorted.filter((item) => item.daysLeft <= EXPIRING_SOON_DAYS).length

  const countOf = (name) =>
    name === '전체' ? ingredients.length : ingredients.filter((i) => i.storage === name).length

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <PageTitle>내 냉장고</PageTitle>
            <Text style={styles.summary}>
              재료 {ingredients.length}개 · 임박 {urgentTotal}개
            </Text>
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={toggleSearch}
            accessibilityLabel={searching ? '검색 닫기' : '재료 검색'}
          >
            {searching ? <CloseIcon size={22} /> : <SearchIcon />}
          </Pressable>
        </View>

        {searching && (
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="내 냉장고에서 찾기"
            autoFocus
            style={styles.search}
          />
        )}

        <View style={styles.chips}>
          {FILTERS.map((name) => {
            const active = name === filter
            return (
              <Pressable
                key={name}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(name)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {name} {countOf(name)}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {urgent.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>3일 안에 먹어야 해요</Text>
              <View style={styles.sortLabel}>
                <Text style={styles.sortText}>유통기한 임박순</Text>
                <ChevronDownIcon />
              </View>
            </View>
            {urgent.map((item) => (
              <IngredientRow key={item.id} item={item} urgent />
            ))}
          </View>
        )}

        {relaxed.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>여유 있어요</Text>
            </View>
            {relaxed.map((item) => (
              <IngredientRow key={item.id} item={item} />
            ))}
          </View>
        )}

        {shown.length === 0 && (
          <Text style={styles.empty}>
            {query.trim()
              ? `'${query.trim()}'에 맞는 재료가 없어요`
              : filter === '전체'
                ? '냉장고가 비어 있어요'
                : `${filter} 보관 재료가 없어요`}
          </Text>
        )}
      </ScrollView>

      <Pressable style={styles.addButton} onPress={() => router.push('/ingredient/add')}>
        <PlusIcon />
        <Text style={styles.addButtonText}>재료 추가</Text>
      </Pressable>

      <Toast toast={toast} style={styles.toast} />
    </Screen>
  )
}

function IngredientRow({ item, urgent = false }) {
  const details = [item.storage, `${item.quantity}${item.unit}`]
  if (urgent) details.push(`${formatMonthDay(item.expiryDate)}까지`)

  return (
    <View style={styles.row}>
      <View style={styles.photo}>
        <ImageIcon />
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.details}>{details.join(' · ')}</Text>
      </View>
      <View style={[styles.badge, urgent && styles.badgeStrong]}>
        <Text style={[styles.badgeText, urgent && styles.badgeTextStrong]}>
          {formatDday(item.daysLeft)}
        </Text>
      </View>
    </View>
  )
}

// 2 → 'D-2', 0 → 'D-day', -1 → 'D+1'(지남)
function formatDday(daysLeft) {
  if (daysLeft === 0) return 'D-day'
  return daysLeft > 0 ? `D-${daysLeft}` : `D+${-daysLeft}`
}

// '2026-09-23' → '9월 23일'
function formatMonthDay(dateString) {
  const [, month, day] = dateString.split('-').map(Number)
  return `${month}월 ${day}일`
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 96, // 마지막 재료가 '재료 추가' 버튼에 가리지 않게
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summary: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSub,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  search: {
    marginTop: 16,
  },

  // 보관 위치 필터 칩
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
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

  // 섹션
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sortLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sortText: {
    fontSize: 12,
    color: colors.textSub,
  },

  // 재료 한 줄
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 6,
  },
  photo: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  details: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSub,
  },

  // D-day 뱃지: 기본은 연하게, strong 은 진하게
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  badgeStrong: {
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  badgeTextStrong: {
    color: colors.textOnPrimary,
  },

  empty: {
    marginTop: 40,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSub,
  },

  // 오른쪽 아래 떠 있는 '재료 추가' 버튼
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: colors.primary,
    boxShadow: `0 8px 20px ${colors.primaryShadow}`,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  toast: {
    bottom: 84, // '재료 추가' 버튼 위
  },
})
