// 생활 알림 화면 (와이어프레임 6번)
// - 위: '다음 알림' 배너 (가장 가까운 알림)
// - 세탁 · 청소 · 공과금 · 기타로 묶어서 보여 주고, 항목마다 스위치로 켜고 끕니다.
// - 항목을 누르면 아래에서 메뉴가 올라옵니다: 완료했어요(+5 XP) / 수정 / 삭제
// - 푸시 알림 권한이 없으면 맨 위에 '알림 켜기' 안내를 보여 줍니다. (src/notifications)
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import {
  CHORE_XP,
  categoryLabel,
  completeChore,
  deleteReminder,
  dueLabel,
  formatNotifyTime,
  getReminders,
  todayString,
  updateReminder,
  withJosa,
} from '../data'
import {
  PUSH_SUPPORTED,
  getNotificationPermission,
  openNotificationSettings,
  requestNotificationPermission,
  sendTestNotification,
} from '../notifications'
import { BottomSheet } from '../components/BottomSheet'
import { BellIcon, CategoryIcon, PlusIcon } from '../components/Icons'
import { PageTitle, Screen } from '../components/Screen'
import { Toast, useToast } from '../components/Toast'
import { colors } from '../theme/colors'

const SAVED_MESSAGES = {
  added: '알림을 추가했어요',
  updated: '알림을 수정했어요',
  deleted: '알림을 삭제했어요',
}

export default function AlertScreen() {
  const [data, setData] = useState(null) // getReminders() 결과
  const [loadError, setLoadError] = useState(null)
  const [menuItem, setMenuItem] = useState(null) // 메뉴가 열린 알림
  const [permission, setPermission] = useState('granted') // 푸시 권한 ('granted' | 'denied' | 'undetermined' | 'unsupported')
  const [toast, showToast] = useToast()
  const { saved } = useLocalSearchParams()

  const load = useCallback(() => {
    getReminders()
      .then((result) => {
        setData(result)
        setLoadError(null)
      })
      .catch((error) => setLoadError(error.message))
  }, [])

  const checkPermission = useCallback(() => {
    getNotificationPermission().then(setPermission)
  }, [])

  // 이 화면이 보일 때마다 새로 불러옵니다 (알림 추가·수정 후 돌아왔을 때 등)
  useFocusEffect(
    useCallback(() => {
      load()
      checkPermission()
    }, [load, checkPermission]),
  )

  // 알림 추가·수정 화면에서 돌아왔을 때 (/alert?saved=added)
  useEffect(() => {
    if (!saved) return
    if (SAVED_MESSAGES[saved]) showToast({ message: SAVED_MESSAGES[saved] })
    router.setParams({ saved: undefined }) // 다시 보일 때 또 뜨지 않게
  }, [saved, showToast])

  const askPermission = async () => {
    const status = await requestNotificationPermission()
    setPermission(status)
    if (status === 'denied') showToast({ message: '휴대폰 설정에서 알림을 허용해 주세요' })
  }

  // 스위치: 화면에서 먼저 바꾸고 저장. 실패하면 다시 불러와서 되돌림
  const handleToggle = async (item, enabled) => {
    setData((prev) => replaceItem(prev, { ...item, enabled }))
    try {
      await updateReminder(item.id, { enabled })
      if (enabled && permission === 'undetermined') await askPermission()
    } catch (error) {
      showToast({ message: error.message })
    }
    load()
  }

  const handleComplete = async (item) => {
    setMenuItem(null)
    try {
      const { xp } = await completeChore({ reminderId: item.id, name: item.title })
      const extras = []
      if (xp.level_up) extras.push('레벨 업!')
      if (xp.new_badges.length > 0) extras.push(`새 뱃지: ${xp.new_badges.join(', ')}`)
      showToast({
        message: [`+${xp.amount} XP · ${withJosa(item.title, '을', '를')} 완료했어요`, ...extras].join(' · '),
      })
      load()
    } catch (error) {
      showToast({ message: error.message })
    }
  }

  const handleEdit = (item) => {
    setMenuItem(null)
    router.push({ pathname: '/reminder/form', params: { id: item.id } })
  }

  const handleDelete = async (item) => {
    setMenuItem(null)
    try {
      await deleteReminder(item.id)
      showToast({ message: `${withJosa(item.title, '을', '를')} 삭제했어요` })
      load()
    } catch (error) {
      showToast({ message: error.message })
    }
  }

  const handleTest = async () => {
    try {
      await sendTestNotification()
      showToast({ message: '5초 뒤에 테스트 알림이 와요. 앱을 닫고 기다려 보세요' })
    } catch (error) {
      showToast({ message: error.message })
    }
  }

  const groups = data?.groups ?? []

  return (
    <View style={styles.page}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <PageTitle>생활 알림</PageTitle>
              <Text style={styles.summary}>
                {data ? `알림 ${data.enabled_count}개 켜짐` : ' '}
              </Text>
            </View>
            <Pressable
              style={styles.addButton}
              onPress={() => router.push('/reminder/form')}
              accessibilityLabel="알림 추가"
            >
              <PlusIcon size={14} />
              <Text style={styles.addButtonText}>추가</Text>
            </Pressable>
          </View>

          {PUSH_SUPPORTED && permission !== 'granted' && permission !== 'unsupported' && (
            <PermissionNotice
              denied={permission === 'denied'}
              onPress={permission === 'denied' ? openNotificationSettings : askPermission}
            />
          )}

          {data?.next_reminder && <NextBanner reminder={data.next_reminder} />}

          {groups.map((group) => (
            <View key={group.category} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={styles.categoryIcon}>
                  <CategoryIcon category={group.category} size={15} />
                </View>
                <Text style={styles.groupTitle}>{categoryLabel(group.category)}</Text>
              </View>
              {group.items.map((item) => (
                <ReminderRow
                  key={item.id}
                  item={item}
                  onPress={() => setMenuItem(item)}
                  onToggle={(enabled) => handleToggle(item, enabled)}
                />
              ))}
            </View>
          ))}

          {data && groups.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>아직 등록한 알림이 없어요</Text>
              <Text style={styles.emptyText}>빨래, 분리수거, 공과금 납부일을 등록하면{'\n'}제때 알려드려요</Text>
              <Pressable style={styles.emptyButton} onPress={() => router.push('/reminder/form')}>
                <Text style={styles.emptyButtonText}>첫 알림 추가하기</Text>
              </Pressable>
            </View>
          )}

          {loadError && <Text style={styles.error}>{loadError}</Text>}

          {/* 개발 중에만 보이는 버튼: 푸시가 오는지 바로 확인 */}
          {__DEV__ && PUSH_SUPPORTED && (
            <Pressable style={styles.devButton} onPress={handleTest}>
              <Text style={styles.devButtonText}>개발용 · 5초 뒤 테스트 알림 보내기</Text>
            </Pressable>
          )}
        </ScrollView>

        <Toast toast={toast} />
      </Screen>

      {menuItem && (
        <ReminderMenu
          item={menuItem}
          onClose={() => setMenuItem(null)}
          onComplete={() => handleComplete(menuItem)}
          onEdit={() => handleEdit(menuItem)}
          onDelete={() => handleDelete(menuItem)}
        />
      )}
    </View>
  )
}

// 목록의 알림 한 줄: 이름 + 날짜 뱃지, 아래에 반복 요약, 오른쪽 스위치
function ReminderRow({ item, onPress, onToggle }) {
  const label = item.enabled ? dueLabel(item) : null
  return (
    <View style={styles.row}>
      <Pressable style={styles.rowMain} onPress={onPress} accessibilityLabel={`${item.title} 메뉴 열기`}>
        <View style={styles.rowTitleLine}>
          <Text style={[styles.rowTitle, !item.enabled && styles.dimText]} numberOfLines={1}>
            {item.title}
          </Text>
          {label && (
            <View style={styles.dueBadge}>
              <Text style={styles.dueBadgeText}>{label}</Text>
            </View>
          )}
          {isDoneToday(item) && <Text style={styles.doneText}>오늘 완료</Text>}
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {item.summary}
        </Text>
      </Pressable>
      <Switch
        value={item.enabled}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
        activeThumbColor={colors.surface} // 웹
        accessibilityLabel={`${item.title} 알림 ${item.enabled ? '끄기' : '켜기'}`}
      />
    </View>
  )
}

// 가장 가까운 알림 배너 (메인 색 그라데이션)
function NextBanner({ reminder }) {
  return (
    <View style={styles.nextBanner}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="nextBanner" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primaryGradient[0]} />
            <Stop offset="1" stopColor={colors.primaryGradient[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#nextBanner)" />
      </Svg>
      <View style={styles.nextIcon}>
        <BellIcon size={20} color={colors.textOnPrimary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.nextLabel}>다음 알림 · {formatNotifyTime(reminder.next_notify_at)}</Text>
        <Text style={styles.nextText} numberOfLines={1}>
          {reminder.title}
        </Text>
      </View>
    </View>
  )
}

// 푸시 권한이 없을 때 안내 (처음: 알림 켜기 / 거절됨: 설정 열기)
function PermissionNotice({ denied, onPress }) {
  return (
    <Pressable style={styles.notice} onPress={onPress}>
      <BellIcon size={18} color={colors.primary} />
      <Text style={styles.noticeText}>
        {denied
          ? '알림 권한이 꺼져 있어서 푸시 알림을 받을 수 없어요'
          : '푸시 알림을 켜면 앱을 열지 않아도 제때 알려드려요'}
      </Text>
      <Text style={styles.noticeAction}>{denied ? '설정 열기' : '알림 켜기'}</Text>
    </Pressable>
  )
}

// 항목을 누르면 올라오는 메뉴. 삭제는 한 번 더 확인합니다.
function ReminderMenu({ item, onClose, onComplete, onEdit, onDelete }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const doneToday = isDoneToday(item)

  return (
    <BottomSheet onClose={onClose} bottomInset={false}>
      <View style={styles.menuHeader}>
        <View style={styles.menuIcon}>
          <CategoryIcon category={item.category} size={20} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.menuTitle}>{item.title}</Text>
          <Text style={styles.rowSub}>{item.summary}</Text>
          <Text style={styles.menuNext}>
            {item.enabled && item.next_notify_at
              ? `다음 알림 · ${formatNotifyTime(item.next_notify_at)}`
              : '알림이 꺼져 있어요'}
          </Text>
        </View>
      </View>

      {confirmingDelete ? (
        <View>
          <Text style={styles.confirmText}>{withJosa(item.title, '을', '를')} 삭제할까요?</Text>
          <View style={styles.confirmButtons}>
            <Pressable
              style={[styles.menuButton, styles.flex]}
              onPress={() => setConfirmingDelete(false)}
            >
              <Text style={styles.menuButtonText}>취소</Text>
            </Pressable>
            <Pressable style={[styles.menuButton, styles.flex, styles.dangerButton]} onPress={onDelete}>
              <Text style={styles.primaryButtonText}>삭제</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.menuButtons}>
          <Pressable
            style={[styles.menuButton, styles.primaryButton, doneToday && styles.disabled]}
            onPress={onComplete}
            disabled={doneToday}
          >
            <Text style={styles.primaryButtonText}>
              {doneToday ? '오늘 이미 완료했어요' : `완료했어요 · +${CHORE_XP} XP`}
            </Text>
          </Pressable>
          <Pressable style={styles.menuButton} onPress={onEdit}>
            <Text style={styles.menuButtonText}>수정</Text>
          </Pressable>
          <Pressable style={styles.menuButton} onPress={() => setConfirmingDelete(true)}>
            <Text style={[styles.menuButtonText, styles.dangerText]}>삭제</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  )
}

// 오늘 이미 완료했는지 (가짜 모드만 last_done_at 이 있음. 서버 모드는 요청서 참고)
function isDoneToday(item) {
  return Boolean(item.last_done_at) && item.last_done_at.slice(0, 10) === todayString()
}

function replaceItem(data, item) {
  if (!data) return data
  return {
    ...data,
    groups: data.groups.map((group) => ({
      ...group,
      items: group.items.map((it) => (it.id === item.id ? item : it)),
    })),
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },

  // 푸시 권한 안내
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.primaryDark,
  },
  noticeAction: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },

  // 다음 알림 배너
  nextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.primary,
  },
  nextIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.onPrimaryBadge,
  },
  nextLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textOnPrimary,
    opacity: 0.85,
  },
  nextText: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },

  // 종류별 묶음
  group: {
    marginTop: 24,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },

  // 알림 한 줄
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowMain: {
    flex: 1,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  dimText: {
    color: colors.textSub,
  },
  rowSub: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSub,
  },
  dueBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  dueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  doneText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSub,
  },

  // 비어 있을 때
  emptyBox: {
    alignItems: 'center',
    marginTop: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSub,
  },
  emptyButton: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  error: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
  },
  devButton: {
    alignSelf: 'center',
    marginTop: 32,
    padding: 8,
  },
  devButtonText: {
    fontSize: 12,
    color: colors.textSub,
    textDecorationLine: 'underline',
  },

  // 메뉴 (아래에서 올라오는 창)
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 14,
    marginBottom: 20,
  },
  menuIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  menuNext: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
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
  primaryButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  disabled: {
    opacity: 0.4,
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
  dangerButton: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },
})
