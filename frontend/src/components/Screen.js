// 모든 화면이 같이 쓰는 바탕: 배경색 + 휴대폰 위쪽(노치·시계) 영역 피하기
import { StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../theme/colors'

export function Screen({ children, style }) {
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  )
}

export function PageTitle({ children }) {
  return <Text style={styles.title}>{children}</Text>
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
})
