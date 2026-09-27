// 아래에서 올라오는 창 (바텀시트). 바깥(어두운 부분)을 누르면 닫힙니다.
// 사용법: 화면 맨 바깥 <View style={{ flex: 1 }}> 안에서 <Screen> 다음에 둡니다.
//   {open && <BottomSheet onClose={() => setOpen(false)}>...내용...</BottomSheet>}
// 탭바가 있는 화면은 bottomInset={false} (탭바가 이미 아래 영역을 차지함)
import { useEffect, useRef } from 'react'
import { Animated, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../theme/colors'

export function BottomSheet({ onClose, children, bottomInset = true }) {
  const insets = useSafeAreaInsets()
  const slide = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start()
  }, [slide])

  return (
    // 키보드가 올라오면 창도 같이 올라가도록 아래 정렬
    <KeyboardAvoidingView
      style={styles.layer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="창 닫기" />
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: 20 + (bottomInset ? insets.bottom : 0) },
          { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 500] }) }] },
        ]}
      >
        <View style={styles.handle} />
        {children}
      </Animated.View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute', // 화면 전체 덮기 (RN 0.86 에는 absoluteFillObject 가 없어서 직접 씀)
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute', // 화면 전체 덮기 (RN 0.86 에는 absoluteFillObject 가 없어서 직접 씀)
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.backdrop,
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.screenBg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
})
