import { StyleSheet, View } from 'react-native'
import { PageTitle, Screen } from '../components/Screen'

export default function RecipeScreen() {
  return (
    <Screen>
      <View style={styles.content}>
        <PageTitle>레시피</PageTitle>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 28 },
})
