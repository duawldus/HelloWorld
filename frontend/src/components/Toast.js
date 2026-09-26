// 화면 아래에 잠깐 떴다 사라지는 알림
// 사용법:
//   const [toast, showToast, hideToast] = useToast()
//   showToast({ message: '계란이 냉장고에 추가됐어요', actionLabel: '수정', onAction: () => {} })
//   <Toast toast={toast} />
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme/colors'

export const TOAST_MS = 3000 // 알림이 떠 있는 시간

export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const showToast = useCallback((next) => {
    clearTimeout(timer.current)
    setToast(next)
    timer.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  const hideToast = useCallback(() => {
    clearTimeout(timer.current)
    setToast(null)
  }, [])

  return [toast, showToast, hideToast]
}

export function Toast({ toast, style }) {
  if (!toast) return null
  return (
    <View style={[styles.toast, style]}>
      <Text style={styles.text} numberOfLines={1}>
        {toast.message}
      </Text>
      {toast.actionLabel && (
        <>
          <Text style={styles.text}>·</Text>
          <Pressable onPress={toast.onAction} hitSlop={8}>
            <Text style={styles.action}>{toast.actionLabel}</Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.toastBg,
  },
  text: {
    flexShrink: 1,
    fontSize: 14,
    color: colors.textOnPrimary,
  },
  action: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.toastAction,
  },
})
