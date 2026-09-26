// 앱 전체의 가장 바깥 틀
// 웹 브라우저에서 넓은 화면으로 열면 가운데에 휴대폰 모양 틀을 보여 줍니다.
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { colors } from '../theme/colors'

export default function RootLayout() {
  const { width, height } = useWindowDimensions()
  const showPhoneFrame = Platform.OS === 'web' && width > 500

  return (
    <View style={[styles.page, showPhoneFrame && styles.pageWide]}>
      <View
        style={
          showPhoneFrame ? [styles.phoneFrame, { height: Math.min(844, height - 32) }] : styles.app
        }
      >
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
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
