// 하단 탭바 (홈 / 냉장고 / 레시피 / 생활알림)
// 선택된 탭은 메인 색상, 나머지는 회색
// 온보딩(기본 양념 설정)을 아직 안 했으면 탭 화면 대신 /onboarding 으로 보냅니다.
import { useEffect, useState } from 'react'
import { Platform, View } from 'react-native'
import { Redirect, Tabs } from 'expo-router'
import { isOnboarded } from '../../data'
import { BellIcon, FridgeIcon, HomeIcon, RecipeIcon } from '../../components/Icons'
import { colors } from '../../theme/colors'

export default function TabLayout() {
  const [onboarded, setOnboarded] = useState(null) // null = 확인 중

  useEffect(() => {
    isOnboarded()
      .then(setOnboarded)
      .catch(() => setOnboarded(true)) // 서버 연결 실패 등: 막지 않고 홈을 보여 줌 (홈에서 에러 표시)
  }, [])

  if (onboarded === null) return <View style={{ flex: 1, backgroundColor: colors.screenBg }} />
  if (!onboarded) return <Redirect href="/onboarding" />

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
