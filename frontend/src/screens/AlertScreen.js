import { StyleSheet, View } from 'react-native'
import { PageTitle, Screen } from '../components/Screen'

export default function AlertScreen() {
  return (
    <Screen>
      <View style={styles.content}>
        <PageTitle>생활알림</PageTitle>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 28 },
})
