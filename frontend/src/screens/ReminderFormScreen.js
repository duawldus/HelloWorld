// 알림 추가 / 수정 화면 (와이어프레임 7번)
// - /reminder/form           : 새 알림 추가
// - /reminder/form?id=알림id : 알림 수정 (+ 삭제)
// 저장하면 생활 알림 화면으로 돌아가고, 처음 저장할 때 푸시 알림 권한을 물어봅니다.
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import {
  REMINDER_CATEGORIES,
  WEEKDAY_LABELS,
  addReminder,
  categoryLabel,
  deleteReminder,
  formatRemindTime,
  getReminder,
  parseTime,
  repeatRuleLabel,
  toTimeString,
  updateReminder,
} from '../data'
import { requestNotificationPermission } from '../notifications'
import { BottomSheet } from '../components/BottomSheet'
import { Chip, Field, TextField } from '../components/FormFields'
import { CategoryIcon, CheckIcon, ChevronDownIcon, ClockIcon, InfoIcon } from '../components/Icons'
import { BackHeader, Screen } from '../components/Screen'
import { colors } from '../theme/colors'

const REPEAT_OPTIONS = [
  ['DAILY', '매일'],
  ['WEEKLY', '매주'],
  ['MONTHLY', '매달'],
]
const BEFORE_OPTIONS = [0, 1, 2, 3, 5, 7] // 미리 알림 (백엔드는 0~14일)
const MINUTE_STEP = 5

const PLACEHOLDERS = {
  LAUNDRY: '예: 빨래하기',
  CLEANING: '예: 분리수거',
  BILL: '예: 전기요금',
  ETC: '예: 화분 물 주기',
}

// 종류를 처음 고를 때 채워 주는 기본값 (사용자가 반복 설정을 건드리기 전까지만)
const CATEGORY_DEFAULTS = {
  LAUNDRY: { repeat_type: 'WEEKLY', hour: 20, minute: 0, notify_before_days: 0 },
  CLEANING: { repeat_type: 'WEEKLY', hour: 21, minute: 0, notify_before_days: 0 },
  BILL: { repeat_type: 'MONTHLY', hour: 9, minute: 0, notify_before_days: 3 },
  ETC: { repeat_type: 'WEEKLY', hour: 9, minute: 0, notify_before_days: 0 },
}

// 오늘 요일 (0=월 ... 6=일)
const todayWeekday = () => (new Date().getDay() + 6) % 7

export default function ReminderFormScreen() {
  const params = useLocalSearchParams()
  const editId = params.id ? Number(params.id) : null // 주소의 값은 글자라서 숫자 id로 바꿈
  const [loaded, setLoaded] = useState(!editId)

  const [category, setCategory] = useState('LAUNDRY')
  const [title, setTitle] = useState('')
  const [repeatType, setRepeatType] = useState('WEEKLY')
  const [repeatInterval, setRepeatInterval] = useState(1) // N일/N주/N달마다
  const [weekdays, setWeekdays] = useState(() => [todayWeekday()])
  const [dayOfMonth, setDayOfMonth] = useState(() => new Date().getDate())
  const [hour, setHour] = useState(20)
  const [minute, setMinute] = useState(0)
  const [beforeDays, setBeforeDays] = useState(0)
  const [touched, setTouched] = useState(false) // 반복·시간을 직접 바꿨는지 (바꿨으면 종류 기본값을 덮어쓰지 않음)

  const [sheet, setSheet] = useState(null) // 'time' | 'before'
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  // 수정이면 저장된 값으로 채웁니다.
  useEffect(() => {
    if (!editId) return
    getReminder(editId)
      .then((item) => {
        const time = parseTime(item.remind_time)
        setCategory(item.category)
        setTitle(item.title)
        setRepeatType(item.repeat_type)
        setRepeatInterval(item.interval)
        if (item.weekdays.length) setWeekdays(item.weekdays)
        if (item.day_of_month) setDayOfMonth(item.day_of_month)
        setHour(time.hour)
        setMinute(time.minute)
        setBeforeDays(item.notify_before_days)
        setTouched(true)
        setLoaded(true)
      })
      .catch(() => router.back())
  }, [editId])

  const touch = (setter) => (value) => {
    setTouched(true)
    setter(value)
  }

  const selectCategory = (next) => {
    setCategory(next)
    if (touched) return
    const preset = CATEGORY_DEFAULTS[next]
    setRepeatType(preset.repeat_type)
    setHour(preset.hour)
    setMinute(preset.minute)
    setBeforeDays(preset.notify_before_days)
  }

  const selectRepeat = (next) => {
    setTouched(true)
    setRepeatType(next)
    setRepeatInterval(1)
  }

  const toggleWeekday = (day) => {
    setTouched(true)
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    )
  }

  // 백엔드에 보낼 값 (ReminderCreate 모양)
  const values = {
    category,
    title: title.trim(),
    repeat_type: repeatType,
    interval: repeatInterval,
    weekdays: repeatType === 'WEEKLY' ? weekdays : [],
    day_of_month: repeatType === 'MONTHLY' ? dayOfMonth : null,
    remind_time: toTimeString(hour, minute),
    notify_before_days: beforeDays,
  }
  const missingWeekday = repeatType === 'WEEKLY' && weekdays.length === 0
  const canSave = values.title.length > 0 && !missingWeekday && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      if (editId) await updateReminder(editId, values)
      else await addReminder(values)
      // 처음 알림을 만들 때 푸시 권한을 물어봅니다. (이미 허용·거절했으면 창이 뜨지 않음)
      await requestNotificationPermission()
      router.dismissTo({ pathname: '/alert', params: { saved: editId ? 'updated' : 'added' } })
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteReminder(editId)
      router.dismissTo({ pathname: '/alert', params: { saved: 'deleted' } })
    } catch (e) {
      setError(e.message)
    }
  }

  if (!loaded) return <Screen edges={['top', 'bottom']} />

  return (
    <View style={styles.page}>
      <Screen edges={['top', 'bottom']}>
        <BackHeader title={editId ? '알림 수정' : '알림 추가'} fallback="/alert" />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="어떤 알림인가요?">
            <View style={styles.categoryRow}>
              {REMINDER_CATEGORIES.map((item) => {
                const active = item === category
                return (
                  <Pressable
                    key={item}
                    style={[styles.categoryCard, active && styles.categoryCardActive]}
                    onPress={() => selectCategory(item)}
                    accessibilityState={{ selected: active }}
                  >
                    <CategoryIcon
                      category={item}
                      size={22}
                      color={active ? colors.primaryDark : colors.textSub}
                    />
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                      {categoryLabel(item)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </Field>

          <Field label="알림 이름">
            <TextField
              value={title}
              onChangeText={setTitle}
              placeholder={PLACEHOLDERS[category]}
              maxLength={40}
              autoFocus={!editId}
            />
          </Field>

          <Field label="반복 주기">
            <View style={styles.segmentRow}>
              {REPEAT_OPTIONS.map(([type, label]) => {
                const active = type === repeatType
                return (
                  <Pressable
                    key={type}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() => selectRepeat(type)}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            <Stepper
              label="간격"
              value={intervalLabel(repeatType, repeatInterval)}
              onMinus={() => touch(setRepeatInterval)(Math.max(1, repeatInterval - 1))}
              onPlus={() => touch(setRepeatInterval)(Math.min(12, repeatInterval + 1))}
              minusDisabled={repeatInterval <= 1}
              plusDisabled={repeatInterval >= 12}
            />
          </Field>

          {repeatType === 'WEEKLY' && (
            <Field label="요일">
              <View style={styles.dayRow}>
                {WEEKDAY_LABELS.map((label, day) => {
                  const active = weekdays.includes(day)
                  return (
                    <Pressable
                      key={label}
                      style={[styles.dayChip, active && styles.dayChipActive]}
                      onPress={() => toggleWeekday(day)}
                      accessibilityLabel={`${label}요일`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.dayText, active && styles.dayTextActive]}>{label}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </Field>
          )}

          {repeatType === 'MONTHLY' && (
            <Field label="날짜">
              <Stepper
                value={`매달 ${dayOfMonth}일`}
                onMinus={() => touch(setDayOfMonth)(dayOfMonth <= 1 ? 31 : dayOfMonth - 1)}
                onPlus={() => touch(setDayOfMonth)(dayOfMonth >= 31 ? 1 : dayOfMonth + 1)}
              />
              {dayOfMonth > 28 && (
                <Text style={styles.hint}>{dayOfMonth}일이 없는 달은 그 달 마지막 날에 알려드려요</Text>
              )}
            </Field>
          )}

          <View style={styles.twoColumns}>
            <Field label="시간" style={styles.flex}>
              <Pressable style={styles.selectBox} onPress={() => setSheet('time')}>
                <ClockIcon size={16} color={colors.textSub} />
                <Text style={styles.selectText}>{formatRemindTime(values.remind_time)}</Text>
              </Pressable>
            </Field>
            <Field label="미리 알림" style={styles.flex}>
              <Pressable style={styles.selectBox} onPress={() => setSheet('before')}>
                <Text style={[styles.selectText, styles.flex]}>{beforeLabel(beforeDays)}</Text>
                <ChevronDownIcon size={14} />
              </Pressable>
            </Field>
          </View>

          <View style={styles.infoBox}>
            <InfoIcon size={18} color={colors.primaryDark} />
            <Text style={styles.infoText}>
              {missingWeekday ? '요일을 1개 이상 골라 주세요' : sentence(values)}
            </Text>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.saveButton, !canSave && styles.disabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={styles.saveButtonText}>{saving ? '저장 중...' : '저장하기'}</Text>
          </Pressable>

          {editId && (
            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteText}>이 알림 삭제</Text>
            </Pressable>
          )}
        </ScrollView>
      </Screen>

      {sheet === 'time' && (
        <TimeSheet
          hour={hour}
          minute={minute}
          onClose={() => setSheet(null)}
          onDone={(h, m) => {
            setTouched(true)
            setHour(h)
            setMinute(m)
            setSheet(null)
          }}
        />
      )}

      {sheet === 'before' && (
        <BottomSheet onClose={() => setSheet(null)}>
          <Text style={styles.sheetTitle}>미리 알림</Text>
          {BEFORE_OPTIONS.map((days) => (
            <Pressable
              key={days}
              style={styles.optionRow}
              onPress={() => {
                touch(setBeforeDays)(days)
                setSheet(null)
              }}
            >
              <Text style={[styles.optionText, days === beforeDays && styles.optionTextActive]}>
                {beforeLabel(days)}
              </Text>
              {days === beforeDays && <CheckIcon size={18} />}
            </Pressable>
          ))}
        </BottomSheet>
      )}
    </View>
  )
}

// − 값 + 로 숫자 바꾸기
function Stepper({ label, value, onMinus, onPlus, minusDisabled, plusDisabled }) {
  return (
    <View style={[styles.stepper, label && styles.stepperWithLabel]}>
      {label && <Text style={styles.stepperLabel}>{label}</Text>}
      <Pressable
        style={[styles.stepButton, minusDisabled && styles.disabled]}
        onPress={onMinus}
        disabled={minusDisabled}
        accessibilityLabel={`${label ?? ''} 줄이기`}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={[styles.stepValue, !label && styles.flex]}>{value}</Text>
      <Pressable
        style={[styles.stepButton, plusDisabled && styles.disabled]}
        onPress={onPlus}
        disabled={plusDisabled}
        accessibilityLabel={`${label ?? ''} 늘리기`}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  )
}

// 시간 고르기 창: 오전/오후 + 시 + 분(5분 단위)
function TimeSheet({ hour, minute, onClose, onDone }) {
  const [pm, setPm] = useState(hour >= 12)
  const [hour12, setHour12] = useState(hour % 12 || 12)
  const [min, setMin] = useState(minute)

  const toHour24 = () => (hour12 % 12) + (pm ? 12 : 0)

  return (
    <BottomSheet onClose={onClose}>
      <Text style={styles.sheetTitle}>알림 시간</Text>
      <View style={styles.chipRow}>
        <Chip label="오전" active={!pm} onPress={() => setPm(false)} />
        <Chip label="오후" active={pm} onPress={() => setPm(true)} />
      </View>
      <Stepper
        label="시"
        value={`${hour12}시`}
        onMinus={() => setHour12(hour12 <= 1 ? 12 : hour12 - 1)}
        onPlus={() => setHour12(hour12 >= 12 ? 1 : hour12 + 1)}
      />
      <Stepper
        label="분"
        value={`${String(min).padStart(2, '0')}분`}
        onMinus={() => setMin((min - MINUTE_STEP + 60) % 60)}
        onPlus={() => setMin((min + MINUTE_STEP) % 60)}
      />
      <Pressable style={styles.saveButton} onPress={() => onDone(toHour24(), min)}>
        <Text style={styles.saveButtonText}>
          {formatRemindTime(toTimeString(toHour24(), min))}로 정하기
        </Text>
      </Pressable>
    </BottomSheet>
  )
}

// '매주' / '2주마다' / '매일' / '3일마다'
function intervalLabel(repeatType, interval) {
  const unit = { DAILY: '일', WEEKLY: '주', MONTHLY: '달' }[repeatType]
  const every = { DAILY: '매일', WEEKLY: '매주', MONTHLY: '매달' }[repeatType]
  return interval === 1 ? every : `${interval}${unit}마다`
}

function beforeLabel(days) {
  return days === 0 ? '당일' : `${days}일 전`
}

// 설정을 문장으로 한 번 더 확인: '매주 화·금 오후 8:00에 알려드려요'
function sentence(values) {
  const rule = repeatRuleLabel(values)
  const time = formatRemindTime(values.remind_time)
  if (values.notify_before_days === 0) return `${rule} ${time}에 알려드려요`
  return `${rule} 기준, ${values.notify_before_days}일 전 ${time}에 미리 알려드려요`
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
    paddingTop: 4,
    paddingBottom: 40,
  },

  // 알림 종류 카드
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  categoryCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSub,
  },
  categoryTextActive: {
    color: colors.primaryDark,
  },

  // 반복 주기
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  segmentActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSub,
  },
  segmentTextActive: {
    color: colors.primaryDark,
  },

  // − 값 +
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  stepperWithLabel: {
    paddingLeft: 16,
  },
  stepperLabel: {
    marginRight: 'auto',
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSub,
  },
  stepButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  stepText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primary,
  },
  stepValue: {
    minWidth: 96,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },

  // 요일
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayChip: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  dayChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSub,
  },
  dayTextActive: {
    color: colors.textOnPrimary,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSub,
  },

  // 시간 · 미리 알림
  twoColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  selectText: {
    fontSize: 15,
    color: colors.text,
  },

  // 요약 안내
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: colors.primaryDark,
  },

  error: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  disabled: {
    opacity: 0.4,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },

  // 아래에서 올라오는 창
  sheetTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
  },
  optionTextActive: {
    fontWeight: '700',
    color: colors.primary,
  },
})
