// 재료 직접 입력 / 수정 화면
// - /ingredient/form            : 새 재료 직접 입력 (?name=고추 로 이름을 미리 채울 수 있음)
// - /ingredient/form?id=재료id  : 방금 추가한 재료의 수량·유통기한 등 수정
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import {
  addDays,
  addIngredient,
  deleteIngredient,
  getIngredient,
  storageLabel,
  todayString,
  updateIngredient,
  STORAGE_TYPES,
} from '../data'
import { Chip, ExpiryPicker, Field, TextField } from '../components/FormFields'
import { BackHeader, Screen } from '../components/Screen'
import { colors } from '../theme/colors'

export default function IngredientFormScreen() {
  const params = useLocalSearchParams()
  const editId = params.id ? Number(params.id) : null // 주소의 값은 글자라서 숫자 id로 바꿈
  const [loaded, setLoaded] = useState(!editId)
  const [name, setName] = useState(params.name ?? '')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('개')
  const [storage, setStorage] = useState('FRIDGE')
  const [daysLeft, setDaysLeft] = useState(7) // 오늘부터 유통기한까지 남은 날
  const [error, setError] = useState(null)

  // 수정이면 저장된 재료 값으로 채웁니다.
  useEffect(() => {
    if (!editId) return
    getIngredient(editId)
      .then((item) => {
        setName(item.name)
        setQuantity(String(item.quantity))
        setUnit(item.unit)
        setStorage(item.storage)
        setDaysLeft(item.d_day)
        setLoaded(true)
      })
      .catch(() => router.back())
  }, [editId])

  const quantityNumber = Number(quantity)
  const canSave = name.trim() && unit.trim() && quantityNumber > 0

  // 저장이 실패하면(서버 연결 실패 등) 이유를 버튼 위에 보여 줍니다.
  const run = async (action) => {
    try {
      setError(null)
      await action()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSave = () =>
    run(async () => {
      if (!canSave) return
      const values = {
        name: name.trim(),
        quantity: quantityNumber,
        unit: unit.trim(),
        storage,
        expires_on: addDays(todayString(), daysLeft),
      }
      if (editId) {
        await updateIngredient(editId, values)
        router.back()
      } else {
        await addIngredient(values)
        router.dismissTo('/fridge') // 냉장고 화면으로 돌아가 바로 확인
      }
    })

  const handleDelete = () =>
    run(async () => {
      await deleteIngredient(editId)
      router.back()
    })

  if (!loaded) return <Screen edges={['top', 'bottom']} />

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader title={editId ? '재료 수정' : '직접 입력'} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="이름">
          <TextField
            value={name}
            onChangeText={setName}
            placeholder="예) 고추"
            autoFocus={!editId && !params.name}
          />
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

        <Field label="보관 위치">
          <View style={styles.chips}>
            {STORAGE_TYPES.map((type) => (
              <Chip
                key={type}
                label={storageLabel(type)}
                active={storage === type}
                onPress={() => setStorage(type)}
              />
            ))}
          </View>
        </Field>

        <Field label="유통기한">
          {/* 새로 등록할 때는 지난 날짜를 고를 수 없음 (백엔드도 거절) */}
          <ExpiryPicker
            daysLeft={daysLeft}
            onChange={setDaysLeft}
            minDays={editId ? undefined : 0}
          />
        </Field>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveButtonText}>{editId ? '저장' : '냉장고에 등록'}</Text>
        </Pressable>

        {editId && (
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteText}>이 재료 삭제</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
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
    marginTop: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
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
})
