// 재료 추가 화면 (아직 빈 화면)
import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { BackIcon } from '../components/Icons'
import { PageTitle, Screen } from '../components/Screen'

export default function IngredientAddScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/fridge'))}
          accessibilityLabel="뒤로 가기"
        >
          <BackIcon />
        </Pressable>
        <PageTitle>재료 추가</PageTitle>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  back: {
    padding: 4,
    marginLeft: -8,
  },
})
