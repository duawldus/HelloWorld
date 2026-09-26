// 냉장고 탭 안에서의 화면 이동 (냉장고 목록 → 재료 추가)
// 재료 추가 화면에서도 하단 탭바는 그대로 보이고 '냉장고' 탭이 켜져 있습니다.
import { Stack } from 'expo-router'

export default function FridgeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
