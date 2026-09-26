// 하단 탭바 (홈 / 냉장고 / 레시피 / 생활알림)
// 선택된 탭은 메인 색상, 나머지는 회색
import { Platform } from 'react-native'
import { Tabs } from 'expo-router'
import { BellIcon, FridgeIcon, HomeIcon, RecipeIcon } from '../../components/Icons'
import { colors } from '../../theme/colors'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSub,
        tabBarStyle: {
          backgroundColor: colors.screenBg,
          borderTopColor: colors.border,
          // 웹의 휴대폰 틀은 아래 모서리가 둥글어서 글자가 잘리지 않게 여백을 줍니다
          ...(Platform.OS === 'web' && { height: 72, paddingTop: 6, paddingBottom: 14 }),
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: '홈', tabBarIcon: ({ color }) => <HomeIcon color={color} /> }}
      />
      <Tabs.Screen
        name="fridge"
        options={{ title: '냉장고', tabBarIcon: ({ color }) => <FridgeIcon color={color} /> }}
      />
      <Tabs.Screen
        name="recipe"
        options={{ title: '레시피', tabBarIcon: ({ color }) => <RecipeIcon color={color} /> }}
      />
      <Tabs.Screen
        name="alert"
        options={{ title: '생활알림', tabBarIcon: ({ color }) => <BellIcon color={color} /> }}
      />
    </Tabs>
  )
}
