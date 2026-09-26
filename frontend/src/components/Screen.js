// 모든 화면이 같이 쓰는 바탕: 배경색 + 휴대폰 위쪽(노치·시계) 영역 피하기
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BackIcon } from './Icons'
import { colors } from '../theme/colors'

// 탭바가 없는 하위 화면은 edges={['top', 'bottom']} 으로 아래쪽(홈 바) 영역도 피합니다.
export function Screen({ children, style, edges = ['top'] }) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  )
}

export function PageTitle({ children }) {
  return <Text style={styles.title}>{children}</Text>
}

// 하위 화면 윗부분: 왼쪽 '<' 뒤로 가기, 오른쪽 제목
export function BackHeader({ title }) {
  return (
    <View style={styles.backHeader}>
      <Pressable
        style={styles.back}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/fridge'))}
        accessibilityLabel="뒤로 가기"
        hitSlop={8}
      >
        <BackIcon />
      </Pressable>
      <PageTitle>{title}</PageTitle>
    </View>
  )
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
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  back: {
    padding: 4,
    marginLeft: -8,
  },
})
