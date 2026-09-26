// 냉장고 화면 (와이어프레임 2번)
// - 재료 카드를 누르면 아래에서 메뉴가 올라옵니다: 수정 / 다 먹었어요(소진) / 버렸어요(폐기)
// - 다 먹었어요·버렸어요는 화면에서 바로 빼고 3초 동안 '되돌리기'를 기다린 뒤에 저장(서버 요청)합니다.
//   되돌리기를 누르면 아무 요청도 보내지 않고 그대로 복구됩니다. (백엔드에 복구 API가 없어서 프론트에서 처리)
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import {
  consumeIngredient,
  deleteIngredient,
  getIngredients,
  matchesName,
  storageLabel,
  withJosa,
  CAN_CONSUME,
  STORAGE_TYPES,
} from '../data'
import { BottomSheet } from '../components/BottomSheet'
import { ChevronDownIcon, CloseIcon, ImageIcon, PlusIcon, SearchIcon } from '../components/Icons'
import { PageTitle, Screen } from '../components/Screen'
import { SearchBar } from '../components/SearchBar'
import { Toast, TOAST_MS, useToast } from '../components/Toast'
import { colors } from '../theme/colors'

const ALL = 'ALL'
const FILTERS = [ALL, ...STORAGE_TYPES]

export default function FridgeScreen() {
  const [allItems, setAllItems] = useState([]) // 유통기한 임박순
  const [loadError, setLoadError] = useState(null)
  const [filter, setFilter] = useState(ALL)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [menuItem, setMenuItem] = useState(null) // 메뉴가 열린 재료
  const [toast, showToast, hideToast] = useToast()
  const { photoAdded, xp } = useLocalSearchParams()

  const load = useCallback(() => {
    getIngredients()
      .then((data) => {
        setAllItems(data.items)
        setLoadError(null)
      })
      .catch((error) => setLoadError(error.message))
  }, [])

  // ----- 다 먹었어요 / 버렸어요: 3초 뒤에 저장, 그 전에 되돌리기 가능 -----
  const [pending, setPending] = useState(null) // { item, action: 'consume' | 'discard' }
  const pendingRef = useRef(null)
  const pendingTimer = useRef(null)

  const setPendingBoth = (value) => {
    pendingRef.current = value
    setPending(value)
  }

  // 기다리던 요청을 지금 보냅니다. (3초가 지났거나, 다른 재료를 또 빼거나, 화면을 떠날 때)
  const flushPending = useCallback(async () => {
    clearTimeout(pendingTimer.current)
    const target = pendingRef.current
    if (!target) return
    pendingRef.current = null
    try {
      if (target.action === 'consume') await consumeIngredient(target.item.id)
      else await deleteIngredient(target.item.id)
      // 성공: 다시 불러오기 전에도 잠깐 보이지 않게 목록에서 먼저 뺌
      setAllItems((prev) => prev.filter((item) => item.id !== target.item.id))
    } catch (error) {
      showToast({ message: error.message }) // 실패: 다시 불러오면 재료가 돌아옴
    }
    // 요청하는 사이 다른 재료를 또 뺐다면 그 재료는 계속 숨김
    setPending((current) => (current?.item.id === target.item.id ? null : current))
    load()
  }, [load, showToast])

  const removeLater = async (item, action) => {
    setMenuItem(null)
    await flushPending()
    setPendingBoth({ item, action })
    showToast({
      message: `${withJosa(item.name, '을', '를')} 냉장고에서 뺐어요`,
      actionLabel: '되돌리기',
      onAction: undo,
    })
    pendingTimer.current = setTimeout(flushPending, TOAST_MS)
  }

  const undo = () => {
    clearTimeout(pendingTimer.current)
    setPendingBoth(null)
    hideToast()
  }

  const handleConsume = (item) => {
    if (!CAN_CONSUME) {
      // 서버 모드: 백엔드에 소진 API가 아직 없음 (frontend/BACKEND_REQUESTS.md)
      setMenuItem(null)
      showToast({ message: '아직 서버에 준비되지 않은 기능이에요. (501)' })
      return
    }
    removeLater(item, 'consume')
  }

  const handleEdit = (item) => {
    setMenuItem(null)
    router.push({ pathname: '/ingredient/form', params: { id: item.id } })
  }

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
  // 화면을 떠날 때 기다리던 요청이 있으면 바로 보냅니다.
  useFocusEffect(
    useCallback(() => {
      load()
      return () => {
        flushPending()
      }
    }, [load, flushPending]),
  )

  // 빼기를 기다리는 재료는 화면에서 숨김. is_imminent = D-3 이하
  const items = allItems.filter((item) => item.id !== pending?.item.id)
  const shown = items.filter(
    (item) => (filter === ALL || item.storage === filter) && matchesName(item.name, query),
  )
  const urgent = shown.filter((item) => item.is_imminent)
  const relaxed = shown.filter((item) => !item.is_imminent)

  const filterLabel = (name) => (name === ALL ? '전체' : storageLabel(name))
  const countOf = (name) =>
    name === ALL ? items.length : items.filter((item) => item.storage === name).length

  return (
    <View style={styles.page}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <PageTitle>내 냉장고</PageTitle>
              <Text style={styles.summary}>
                재료 {items.length}개 · 임박 {items.filter((item) => item.is_imminent).length}개
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
                    {filterLabel(name)} {countOf(name)}
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
                <IngredientRow key={item.id} item={item} urgent onPress={() => setMenuItem(item)} />
              ))}
            </View>
          )}

          {relaxed.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>여유 있어요</Text>
              </View>
              {relaxed.map((item) => (
                <IngredientRow key={item.id} item={item} onPress={() => setMenuItem(item)} />
              ))}
            </View>
          )}

          {shown.length === 0 && (
            <Text style={styles.empty}>
              {loadError
                ? loadError
                : query.trim()
                  ? `'${query.trim()}'에 맞는 재료가 없어요`
                  : filter === ALL
                    ? '냉장고가 비어 있어요'
                    : `${storageLabel(filter)} 보관 재료가 없어요`}
            </Text>
          )}
        </ScrollView>

        <Pressable style={styles.addButton} onPress={() => router.push('/ingredient/add')}>
          <PlusIcon />
          <Text style={styles.addButtonText}>재료 추가</Text>
        </Pressable>

        <Toast toast={toast} style={styles.toast} />
      </Screen>

      {menuItem && (
        <IngredientMenu
          item={menuItem}
          onClose={() => setMenuItem(null)}
          onEdit={() => handleEdit(menuItem)}
          onConsume={() => handleConsume(menuItem)}
          onDiscard={() => removeLater(menuItem, 'discard')}
        />
      )}
    </View>
  )
}

function IngredientRow({ item, urgent = false, onPress }) {
  const details = [storageLabel(item.storage), `${item.quantity}${item.unit}`]
  if (urgent) details.push(`${formatMonthDay(item.expires_on)}까지`)

  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityLabel={`${item.name} 메뉴 열기`}>
      <View style={styles.photo}>
        <ImageIcon />
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.details}>{details.join(' · ')}</Text>
      </View>
      <DdayBadge dDay={item.d_day} strong={urgent} />
    </Pressable>
  )
}

function DdayBadge({ dDay, strong }) {
  return (
    <View style={[styles.badge, strong && styles.badgeStrong]}>
      <Text style={[styles.badgeText, strong && styles.badgeTextStrong]}>{formatDday(dDay)}</Text>
    </View>
  )
}

// 재료 카드를 누르면 올라오는 메뉴. '버렸어요'는 한 번 더 확인합니다.
function IngredientMenu({ item, onClose, onEdit, onConsume, onDiscard }) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  return (
    <BottomSheet onClose={onClose} bottomInset={false}>
      <View style={styles.menuHeader}>
        <View style={styles.info}>
          <Text style={styles.menuName}>{item.name}</Text>
          <Text style={styles.details}>
            {item.quantity}
            {item.unit} · {storageLabel(item.storage)} · 유통기한 {formatMonthDay(item.expires_on)}
          </Text>
        </View>
        <DdayBadge dDay={item.d_day} strong={item.is_imminent} />
      </View>

      {confirmingDiscard ? (
        <View>
          <Text style={styles.confirmText}>{withJosa(item.name, '을', '를')} 정말 버릴까요?</Text>
          <View style={styles.confirmButtons}>
            <Pressable
              style={[styles.menuButton, styles.confirmButton]}
              onPress={() => setConfirmingDiscard(false)}
            >
              <Text style={styles.menuButtonText}>취소</Text>
            </Pressable>
            <Pressable
              style={[styles.menuButton, styles.confirmButton, styles.dangerButton]}
              onPress={onDiscard}
            >
              <Text style={styles.dangerButtonText}>버리기</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.menuButtons}>
          <Pressable style={styles.menuButton} onPress={onEdit}>
            <Text style={styles.menuButtonText}>수정</Text>
          </Pressable>
          <Pressable style={styles.menuButton} onPress={onConsume}>
            <Text style={styles.menuButtonText}>다 먹었어요</Text>
          </Pressable>
          <Pressable style={styles.menuButton} onPress={() => setConfirmingDiscard(true)}>
            <Text style={[styles.menuButtonText, styles.dangerText]}>버렸어요</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
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
  page: {
    flex: 1,
  },
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

  // 재료 메뉴 (아래에서 올라오는 창)
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    marginBottom: 20,
  },
  menuName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  menuButtons: {
    gap: 10,
  },
  menuButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  menuButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  dangerText: {
    color: colors.danger,
  },
  confirmText: {
    marginBottom: 14,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
  },
  dangerButton: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
})
