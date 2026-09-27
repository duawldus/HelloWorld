// 앱 전체의 가장 바깥 틀
// 웹 브라우저에서 넓은 화면으로 열면 가운데에 휴대폰 모양 틀을 보여 줍니다.
// 앱을 켜면 맨 위에 스플래시를 덮어 두고, 그동안 온보딩 여부를 불러옵니다. (빈 화면 깜빡임 방지)
import { useCallback, useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { isOnboarded } from '../data'
import { SplashOverlay } from '../components/SplashOverlay'
import { colors } from '../theme/colors'

export default function RootLayout() {
  const { width, height } = useWindowDimensions()
  const showPhoneFrame = Platform.OS === 'web' && width > 500
  const [dataReady, setDataReady] = useState(false)
  const [splashDone, setSplashDone] = useState(false)

  // 온보딩 여부를 미리 불러 둡니다. 결과는 기억돼서 (tabs)/_layout.js 가 바로 온보딩/홈을 고릅니다.
  // 실패해도(서버 연결 실패 등) 스플래시에 갇히지 않게 넘어갑니다.
  useEffect(() => {
    isOnboarded()
      .catch(() => {})
      .finally(() => setDataReady(true))
  }, [])

  const finishSplash = useCallback(() => setSplashDone(true), [])

  return (
    <View style={[styles.page, showPhoneFrame && styles.pageWide]}>
      <View
        style={
          showPhoneFrame ? [styles.phoneFrame, { height: Math.min(844, height - 32) }] : styles.app
        }
      >
        {/* 상태바 글씨: 파란 스플래시 위에서는 흰색, 사라진 뒤에는 밝은 화면에 맞춰 어두운 색 */}
        <StatusBar style={splashDone ? 'dark' : 'light'} />
        <Stack screenOptions={{ headerShown: false }} />
        {!splashDone && <SplashOverlay ready={dataReady} onFinish={finishSplash} />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  pageWide: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pageBg,
  },
  app: {
    flex: 1,
    width: '100%',
  },
  phoneFrame: {
    width: 390,
    borderWidth: 3,
    borderColor: colors.phoneFrame,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: colors.screenBg,
    boxShadow: `0 20px 40px ${colors.phoneFrameShadow}`,
  },
})
