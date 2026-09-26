// 식재료 추가 화면 (와이어프레임 3번)
// - 자주 쓰는 재료를 탭하면 프리셋 유통기한으로 바로 등록되고, 아래에 3초간 알림이 뜹니다.
// - 검색창에 입력하면 그리드 대신 프리셋 검색 결과가 나오고, 탭하면 똑같이 바로 등록됩니다.
// - 목록에 없는 재료는 직접 입력 화면(/ingredient/form)에서 등록합니다.
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { addIngredient, getPresets, matchesName, storageLabel } from '../data'
import { CameraIcon, ImageIcon } from '../components/Icons'
import { BackHeader, Screen } from '../components/Screen'
import { SearchBar } from '../components/SearchBar'
import { Toast, useToast } from '../components/Toast'
import { colors } from '../theme/colors'

export default function IngredientAddScreen() {
  const [query, setQuery] = useState('')
  const [presets, setPresets] = useState([]) // 전체 프리셋 (검색용)
  const [frequentPresets, setFrequentPresets] = useState([]) // 자주 쓰는 재료 8개
  const [toast, showToast, hideToast] = useToast()

  useEffect(() => {
    Promise.all([getPresets(), getPresets({ frequent: true })])
      .then(([all, frequent]) => {
        setPresets(all)
        setFrequentPresets(frequent)
      })
      .catch((error) => showToast({ message: error.message }))
  }, [showToast])

  const isSearching = query.trim().length > 0
  const results = isSearching ? presets.filter((preset) => matchesName(preset.name, query)) : []

  // 같은 재료를 또 누르면 따로 한 개 더 등록됩니다.
  const handleAdd = async (preset) => {
    let added
    try {
      added = await addIngredient({ name: preset.name, preset_id: preset.id }, 'PRESET')
    } catch (error) {
      showToast({ message: error.message })
      return
    }
    showToast({
      message: `${withSubject(added.name)} 냉장고에 추가됐어요`,
      actionLabel: '수정',
      onAction: () => {
        hideToast()
        router.push({ pathname: '/ingredient/form', params: { id: added.id } })
      },
    })
  }

  const openManualForm = () => {
    router.push({ pathname: '/ingredient/form', params: isSearching ? { name: query.trim() } : {} })
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader title="식재료 추가" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.photoButton} onPress={() => router.push('/ingredient/photo')}>
          <CameraIcon />
          <Text style={styles.photoButtonText}>사진으로 한 번에 등록</Text>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        </Pressable>
        <Text style={styles.photoHint}>
          장 봐온 재료나 냉장고 속을 촬영하면 멀티모달 AI가 자동으로 목록을 만들어줘요
        </Text>

        <SearchBar value={query} onChangeText={setQuery} style={styles.search} />

        {isSearching ? (
          <View style={styles.section}>
            {results.map((preset) => (
              <PresetRow key={preset.id} preset={preset} onPress={() => handleAdd(preset)} />
            ))}
            {results.length === 0 && (
              <View style={styles.noResult}>
                <Text style={styles.noResultText}>'{query.trim()}'은(는) 목록에 없어요</Text>
                <Pressable onPress={openManualForm}>
                  <Text style={styles.noResultLink}>직접 입력해서 등록하기</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>자주 쓰는 재료</Text>
            <View style={styles.grid}>
              {frequentPresets.map((preset) => (
                <Pressable
                  key={preset.id}
                  style={styles.gridItem}
                  onPress={() => handleAdd(preset)}
                  accessibilityLabel={`${preset.name} 바로 등록`}
                >
                  <View style={styles.gridPhoto}>
                    <ImageIcon size={24} />
                  </View>
                  <Text style={styles.gridName}>{preset.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.gridHint}>
              탭하면 바로 등록돼요 · 유통기한 자동 지정 (예: 계란 {shelfDays(presets, '계란', 21)}일,
              두부 {shelfDays(presets, '두부', 7)}일)
            </Text>
          </View>
        )}

        <Pressable style={styles.manualButton} onPress={openManualForm}>
          <Text style={styles.manualButtonText}>목록에 없어요, 직접 검색</Text>
        </Pressable>
      </ScrollView>

      <Toast toast={toast} />
    </Screen>
  )
}

function PresetRow({ preset, onPress }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowPhoto}>
        <ImageIcon />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{preset.name}</Text>
        <Text style={styles.rowDetails}>
          {storageLabel(preset.default_storage)} · {preset.default_quantity}
          {preset.default_unit} · 유통기한 {preset.shelf_life_days}일
        </Text>
      </View>
      <Text style={styles.rowAdd}>추가</Text>
    </Pressable>
  )
}

// 프리셋 기본 유통기한(일). 불러오기 전에는 fallback
function shelfDays(presets, name, fallback) {
  return presets.find((preset) => preset.name === name)?.shelf_life_days ?? fallback
}

// 받침에 따라 '계란이' / '두부가'
function withSubject(name) {
  const code = name.charCodeAt(name.length - 1) - 0xac00
  if (code < 0 || code >= 11172) return `${name}이(가)`
  return code % 28 === 0 ? `${name}가` : `${name}이`
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 96, // 아래 알림에 버튼이 가리지 않게
  },

  // 사진으로 한 번에 등록
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 60,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  photoButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  aiBadge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: colors.onPrimaryBadge,
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  photoHint: {
    marginTop: 12,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSub,
  },

  search: {
    marginTop: 24,
  },

  section: {
    marginTop: 24,
  },
  sectionTitle: {
    marginBottom: 14,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },

  // 자주 쓰는 재료 4칸 그리드
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  gridItem: {
    width: '23%',
    alignItems: 'center',
  },
  gridPhoto: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  gridName: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  gridHint: {
    marginTop: 18,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSub,
  },

  // 검색 결과 한 줄
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  rowPhoto: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  rowDetails: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSub,
  },
  rowAdd: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  noResult: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  noResultText: {
    fontSize: 14,
    color: colors.textSub,
  },
  noResultLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },

  // 목록에 없어요, 직접 검색
  manualButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    marginTop: 28,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  manualButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
})
