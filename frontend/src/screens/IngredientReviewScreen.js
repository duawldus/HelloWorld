// 인식 결과 확인 화면 (와이어프레임 3-2)
// - 사진 인식 결과를 신뢰도와 함께 보여 줍니다. 70% 미만은 주황색으로 표시하고 처음엔 선택하지 않습니다.
// - 왼쪽 체크(+)만 누르면 선택/해제, 카드를 누르면 아래에서 수정 창이 올라옵니다.
// - '재료 N개 등록하기' → 선택한 재료를 한 번에 저장(+XP)하고 냉장고 화면으로 이동합니다.
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  addDays,
  addIngredientsByPhoto,
  getDaysLeft,
  todayString,
  CONFIDENT_PERCENT,
} from '../data'
import { ExpiryPicker, Field, TextField } from '../components/FormFields'
import { CheckIcon, ImageIcon, PlusIcon, SparkleIcon } from '../components/Icons'
import { BackHeader, Screen } from '../components/Screen'
import { colors } from '../theme/colors'

// 화면에서 쓰는 후보 하나: 인식 결과 + { selected, confirmed(수정 창에서 확인함), autoExpiry }
function toReviewItems(candidatesJson) {
  try {
    return JSON.parse(candidatesJson).map((candidate) => ({
      ...candidate,
      selected: candidate.confidence >= CONFIDENT_PERCENT,
      confirmed: false,
      autoExpiry: true,
    }))
  } catch {
    return []
  }
}

export default function IngredientReviewScreen() {
  const { candidates } = useLocalSearchParams()
  const [items, setItems] = useState(() => toReviewItems(candidates))
  const [editing, setEditing] = useState(null) // 수정 창에 열린 후보
  const [saving, setSaving] = useState(false)

  const selected = items.filter((item) => item.selected)

  const toggle = (id) =>
    setItems(items.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)))

  const saveEdit = (changed) => {
    setItems(items.map((item) => (item.id === changed.id ? changed : item)))
    setEditing(null)
  }

  const removeItem = (id) => {
    setItems(items.filter((item) => item.id !== id))
    setEditing(null)
  }

  const handleRegister = async () => {
    if (selected.length === 0 || saving) return
    setSaving(true)
    const result = await addIngredientsByPhoto(
      selected.map(({ name, quantity, unit, storage, expiryDate }) => ({
        name,
        quantity,
        unit,
        storage,
        expiryDate,
      })),
    )
    // 냉장고 화면으로 돌아가서 '재료 N개를 등록했어요 · +N XP' 알림을 띄웁니다.
    router.dismissTo({
      pathname: '/fridge',
      params: { photoAdded: String(result.added.length), xp: String(result.gainedXp) },
    })
  }

  return (
    <View style={styles.page}>
      <Screen edges={['top', 'bottom']}>
        <BackHeader title="인식 결과 확인" />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.banner}>
            <SparkleIcon />
            <Text style={styles.bannerText}>사진 1장에서 재료 {items.length}개를 찾았어요</Text>
          </View>

          {items.map((item) => (
            <CandidateCard
              key={item.id}
              item={item}
              onToggle={() => toggle(item.id)}
              onPress={() => setEditing(item)}
            />
          ))}

          {items.length === 0 ? (
            <Text style={styles.empty}>다른 사진으로 다시 시도해 주세요</Text>
          ) : (
            <Text style={styles.hint}>
              항목을 탭하면 이름 · 수량 · 유통기한을 바로 수정할 수 있어요
            </Text>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.registerButton, selected.length === 0 && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={selected.length === 0 || saving}
          >
            <Text style={styles.registerButtonText}>재료 {selected.length}개 등록하기</Text>
          </Pressable>
        </View>
      </Screen>

      {editing && (
        <EditSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
          onDelete={() => removeItem(editing.id)}
        />
      )}
    </View>
  )
}

function CandidateCard({ item, onToggle, onPress }) {
  const confident = item.confidence >= CONFIDENT_PERCENT
  const needsCheck = !confident && !item.confirmed // 주황 '?' 와 '확실하지 않아요' 표시

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Pressable
        style={[
          styles.check,
          item.selected ? styles.checkOn : needsCheck ? styles.checkWarn : styles.checkOff,
        ]}
        onPress={onToggle}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.selected }}
        accessibilityLabel={`${item.name} 선택`}
      >
        {item.selected ? (
          <CheckIcon />
        ) : (
          <PlusIcon size={14} color={needsCheck ? colors.warning : colors.textSub} />
        )}
      </Pressable>

      <View style={styles.photo}>
        <ImageIcon />
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {needsCheck && <Text style={styles.question}>?</Text>}
        </View>
        <Text style={styles.details}>
          {needsCheck
            ? '확실하지 않아요 · 탭해서 확인'
            : `${item.quantity}${item.unit} · 유통기한 ${formatMonthDay(item.expiryDate)}${item.autoExpiry ? ' (자동)' : ''}`}
        </Text>
      </View>

      <View style={[styles.badge, !confident && styles.badgeWarn]}>
        <Text style={[styles.badgeText, !confident && styles.badgeTextWarn]}>
          {item.confidence}%
        </Text>
      </View>
    </Pressable>
  )
}

// 아래에서 올라오는 수정 창. '확인'을 누르면 선택된 상태가 됩니다.
function EditSheet({ item, onClose, onSave, onDelete }) {
  const insets = useSafeAreaInsets()
  const slide = useRef(new Animated.Value(1)).current
  const initialDays = getDaysLeft(item)
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [unit, setUnit] = useState(item.unit)
  const [daysLeft, setDaysLeft] = useState(initialDays)

  useEffect(() => {
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start()
  }, [slide])

  const quantityNumber = Number(quantity)
  const canSave = name.trim() && unit.trim() && quantityNumber > 0

  const handleConfirm = () => {
    if (!canSave) return
    onSave({
      ...item,
      name: name.trim(),
      quantity: quantityNumber,
      unit: unit.trim(),
      expiryDate: addDays(todayString(), daysLeft),
      autoExpiry: item.autoExpiry && daysLeft === initialDays,
      confirmed: true,
      selected: true,
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.sheetLayer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="수정 창 닫기" />
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: 20 + insets.bottom },
          { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 500] }) }] },
        ]}
      >
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>재료 확인</Text>

        <Field label="이름">
          <TextField value={name} onChangeText={setName} placeholder="예) 대파" />
        </Field>
        <View style={styles.twoColumns}>
          <Field label="수량" style={styles.column}>
            <TextField
              value={quantity}
              onChangeText={(text) => setQuantity(text.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="1"
            />
          </Field>
          <Field label="단위" style={styles.column}>
            <TextField value={unit} onChangeText={setUnit} placeholder="개, g, ml, 봉" />
          </Field>
        </View>
        <Field label="유통기한">
          <ExpiryPicker daysLeft={daysLeft} onChange={setDaysLeft} />
        </Field>

        <View style={styles.sheetButtons}>
          <Pressable style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteText}>삭제</Text>
          </Pressable>
          <Pressable
            style={[styles.confirmButton, !canSave && styles.registerButtonDisabled]}
            onPress={handleConfirm}
            disabled={!canSave}
          >
            <Text style={styles.registerButtonText}>확인</Text>
          </Pressable>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  )
}

// '2026-09-24' → '9월 24일'
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
    paddingTop: 20,
    paddingBottom: 24,
  },

  // 맨 위 연한 파란 배너
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },

  // 재료 카드
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  check: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  checkOn: {
    backgroundColor: colors.primaryLight,
  },
  checkWarn: {
    backgroundColor: colors.warningLight,
  },
  checkOff: {
    borderWidth: 1,
    borderColor: colors.border,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  question: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.warning,
  },
  details: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17, // 길면 줄바꿈되어 두 줄로 보임
    color: colors.textSub,
  },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  badgeWarn: {
    backgroundColor: colors.warningLight,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  badgeTextWarn: {
    color: colors.warning,
  },

  hint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSub,
  },
  empty: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSub,
  },

  // 하단 등록 버튼
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  registerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  registerButtonDisabled: {
    opacity: 0.4,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },

  // 수정 창 (키보드가 올라오면 창도 같이 올라가도록 아래 정렬)
  sheetLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.screenBg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  sheetTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
    height: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
})
