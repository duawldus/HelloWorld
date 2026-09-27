// 온보딩 · 기본 양념 설정 (와이어프레임 0번)
// - /onboarding            : 앱을 처음 켰을 때. '시작하기' → 보유 양념 저장 후 홈으로
// - /onboarding?mode=edit  : 설정에서 다시 열 때 (수정 모드). '저장' → 이전 화면으로
// 선택한 양념은 레시피 매칭에서 '보유 재료'로 쓰입니다. (냉장고 목록과는 따로 저장)
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { getSeasonings, saveSeasonings } from '../data'
import { BackIcon, CheckIcon } from '../components/Icons'
import { PageTitle, Screen } from '../components/Screen'
import { colors } from '../theme/colors'

// 와이어프레임처럼 3칸 x 2줄 = 앞의 6개만 보여 줍니다. (백엔드 양념은 12종)
// 화면에 없는 양념의 보유 상태는 저장할 때 그대로 둡니다.
const VISIBLE_COUNT = 6

// 처음 켰을 때 미리 선택해 둘 양념
const DEFAULT_SELECTED = ['간장', '식용유', '소금']

export default function OnboardingScreen() {
  const { mode } = useLocalSearchParams()
  const isEdit = mode === 'edit'
  const [seasonings, setSeasonings] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSeasonings()
      .then((list) => {
        setSeasonings(list)
        // 수정 모드는 지금 가진 양념, 처음이면 기본 3개
        const initial = isEdit
          ? list.filter((s) => s.owned)
          : list.filter((s) => DEFAULT_SELECTED.includes(s.name))
        setSelectedIds(initial.map((s) => s.id))
      })
      .catch((e) => setError(e.message))
  }, [isEdit])

  const visible = seasonings.slice(0, VISIBLE_COUNT)

  const toggle = (id) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const hiddenOwned = seasonings.slice(VISIBLE_COUNT).filter((s) => s.owned).map((s) => s.id)
      await saveSeasonings([...selectedIds, ...hiddenOwned])
      if (isEdit) router.back()
      else router.replace('/') // 홈으로. 온보딩 화면으로 되돌아갈 수 없게 replace
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      {/* 처음 켰을 때는 뒤로 스와이프로 빠져나가지 못하게 */}
      <Stack.Screen options={{ gestureEnabled: isEdit }} />

      <ScrollView contentContainerStyle={styles.content}>
        {isEdit && (
          <Pressable
            style={styles.back}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityLabel="뒤로 가기"
            hitSlop={8}
          >
            <BackIcon />
          </Pressable>
        )}
        <PageTitle>기본 양념 설정</PageTitle>
        <Text style={styles.subtitle}>가지고 있는 양념을 선택해주세요 · 나중에 변경 가능</Text>

        <View style={styles.grid}>
          {visible.map((seasoning) => {
            const selected = selectedIds.includes(seasoning.id)
            return (
              <Pressable
                key={seasoning.id}
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => toggle(seasoning.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={seasoning.name}
              >
                {selected ? <CheckIcon size={24} /> : <View style={styles.checkbox} />}
                <Text style={[styles.name, selected && styles.nameSelected]}>{seasoning.name}</Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving || seasonings.length === 0}
        >
          <Text style={styles.buttonText}>{isEdit ? '저장' : '시작하기'}</Text>
        </Pressable>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  back: {
    alignSelf: 'flex-start',
    padding: 4,
    marginLeft: -8,
    marginBottom: 12,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textSub,
  },

  // 3칸 그리드
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: 20,
  },
  card: {
    width: '31.5%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 7,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  nameSelected: {
    color: colors.primary,
  },

  // 하단 버튼
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  error: {
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
})
