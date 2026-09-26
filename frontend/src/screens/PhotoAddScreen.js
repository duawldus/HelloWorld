// 사진으로 한 번에 등록 화면 (와이어프레임 3-1, 아직 준비 중)
import { StyleSheet, Text, View } from 'react-native'
import { CameraIcon } from '../components/Icons'
import { BackHeader, Screen } from '../components/Screen'
import { colors } from '../theme/colors'

export default function PhotoAddScreen() {
  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader title="사진으로 등록" />
      <View style={styles.center}>
        <CameraIcon size={40} color={colors.primary} />
        <Text style={styles.text}>사진 등록 화면은 준비 중이에요</Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    fontSize: 14,
    color: colors.textSub,
  },
})
