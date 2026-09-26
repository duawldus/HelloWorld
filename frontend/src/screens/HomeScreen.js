import { StyleSheet, View } from 'react-native'
import { PageTitle, Screen } from '../components/Screen'

export default function HomeScreen() {
  return (
    <Screen>
      <View style={styles.content}>
        <PageTitle>홈</PageTitle>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 28 },
})
