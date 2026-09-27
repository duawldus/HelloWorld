// 앱을 켤 때 잠깐 뜨는 스플래시: 메인 색 배경 + 가운데 흰 글씨 '방구석 매니저'
// - 사라지는 동작까지 합쳐 1.5초 보여 줍니다. (앱 데이터(ready)가 그때까지 안 됐으면 준비될 때까지 기다림)
// - 탭바·헤더 등 모든 화면 위에 휴대폰 화면 전체(상태바·아래 영역 포함)를 덮습니다.
// - 뒤에서는 이미 온보딩/홈 화면이 준비되고 있어서, 사라지면 바로 그 화면이 보입니다.
// - 개발 중에는 src/data/config.js 의 DEV_SKIP_SPLASH = true 로 1.5초 기다리기를 끌 수 있습니다.
import { useEffect, useRef, useState } from 'react'
import { Animated, Platform, StyleSheet, Text } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { DEV_SKIP_SPLASH } from '../data'
import { colors } from '../theme/colors'

const TOTAL_MS = 1500 // 스플래시가 떠 있는 전체 시간 (사라지는 동작 포함)
const FADE_MS = 300 // 마지막에 부드럽게 사라지는 시간
const MIN_VISIBLE_MS = TOTAL_MS - FADE_MS

export function SplashOverlay({ ready, onFinish }) {
  const [minTimePassed, setMinTimePassed] = useState(DEV_SKIP_SPLASH)
  const [fading, setFading] = useState(false)
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (DEV_SKIP_SPLASH) return
    const timer = setTimeout(() => setMinTimePassed(true), MIN_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready || !minTimePassed || fading) return
    setFading(true)
    Animated.timing(opacity, {
      toValue: 0,
      duration: DEV_SKIP_SPLASH ? 0 : FADE_MS,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => onFinish())
  }, [ready, minTimePassed, fading, opacity, onFinish])

  return (
    <Animated.View
      style={[styles.splash, { opacity }]}
      pointerEvents={fading ? 'none' : 'auto'} // 떠 있는 동안은 뒤 화면을 누를 수 없게
      accessibilityLabel="방구석 매니저"
    >
      {/* 파란 배경 위라 상태바 글씨를 흰색으로 */}
      {!fading && <StatusBar style="light" />}
      <Text style={styles.title}>방구석 매니저</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    // 뒤 화면의 탭바·헤더보다 항상 위에 (Android 는 elevation 이 높은 뷰가 위에 그려져서 둘 다 줌)
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.textOnPrimary,
  },
})
