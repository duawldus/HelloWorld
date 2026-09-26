// 입력 화면 부품: 라벨, 입력칸, 선택 칩, 유통기한 고르기
// (재료 직접 입력 화면, 인식 결과 수정 창에서 같이 씀)
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { addDays, todayString } from '../data'
import { colors } from '../theme/colors'

const QUICK_DAYS = [3, 7, 14, 30]

// 라벨 + 내용. 예) <Field label="이름"><TextField ... /></Field>
export function Field({ label, style, children }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  )
}

export function TextField({ style, ...props }) {
  return (
    <TextInput style={[styles.input, style]} placeholderTextColor={colors.textSub} {...props} />
  )
}

// 유통기한 고르기: −/+ 로 하루씩, 아래 칩으로 3·7·14·30일 빠르게
// daysLeft = 오늘부터 유통기한까지 남은 날. 예) <ExpiryPicker daysLeft={7} onChange={setDaysLeft} />
// minDays 를 주면 그보다 앞당길 수 없음 (예: minDays={0} → 오늘 이전 불가)
export function ExpiryPicker({ daysLeft, onChange, minDays }) {
  const expiryDate = addDays(todayString(), daysLeft)
  const atMin = minDays !== undefined && daysLeft <= minDays

  return (
    <View>
      <View style={styles.dateBox}>
        <Pressable
          style={[styles.stepButton, atMin && styles.stepButtonDisabled]}
          onPress={() => onChange(daysLeft - 1)}
          disabled={atMin}
          accessibilityLabel="하루 앞당기기"
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <View style={styles.dateInfo}>
          <Text style={styles.dateText}>{formatDate(expiryDate)}</Text>
          <Text style={styles.dateSub}>{formatDday(daysLeft)}</Text>
        </View>
        <Pressable
          style={styles.stepButton}
          onPress={() => onChange(daysLeft + 1)}
          accessibilityLabel="하루 늦추기"
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
      <View style={styles.chips}>
        {QUICK_DAYS.map((days) => (
          <Chip
            key={days}
            label={`${days}일`}
            active={daysLeft === days}
            onPress={() => onChange(days)}
          />
        ))}
      </View>
    </View>
  )
}

// 둥근 선택 칩 (선택되면 메인 색)
export function Chip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

// '2026-10-03' → '2026년 10월 3일'
function formatDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return `${year}년 ${month}월 ${day}일`
}

function formatDday(daysLeft) {
  if (daysLeft === 0) return '오늘까지'
  return daysLeft > 0 ? `${daysLeft}일 남음 (D-${daysLeft})` : `${-daysLeft}일 지남`
}

const styles = StyleSheet.create({
  field: {
    marginTop: 20,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    height: 50,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  stepButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  stepText: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.primary,
  },
  dateInfo: {
    flex: 1,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  dateSub: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSub,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSub,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
})
