// ⭐ 푸시 알림 (와이어프레임 9번) — expo-notifications 는 이 파일에서만 씁니다.
//
// 동작 방식 (src/data/config.js 의 PUSH_SOURCE)
// - 'local'(기본): 앱이 폰 안에서 알림을 직접 예약합니다. 서버 없이, Expo Go 에서도 동작해요.
//     생활 알림은 30일 앞까지, 유통기한 알림은 7일 앞까지 예약하고,
//     앱을 열 때 · 재료나 알림이 바뀔 때마다 예약을 새로 맞춥니다. (messages.js 가 문구·시각을 만듦)
// - 'server': 백엔드가 Expo Push 로 보냅니다. 앱은 푸시 토큰만 서버에 등록합니다.
//     (개발 빌드 + EAS projectId 필요. Android 는 Expo Go 에서 원격 푸시를 받을 수 없음)
//
// 화면에서 쓰는 것
//   PUSH_SUPPORTED                    웹이면 false (웹은 푸시 알림 없음)
//   getNotificationPermission()       'granted' | 'denied' | 'undetermined' | 'unsupported'
//   requestNotificationPermission()   권한 창 띄우기 (이미 허용·거절했으면 창 없이 결과만)
//   openNotificationSettings()        휴대폰 설정 앱 열기 (거절했을 때)
//   sendTestNotification()            5초 뒤 테스트 알림 (개발용)
// 앱 전체 틀(src/app/_layout.js)에서 한 번
//   useNotificationSetup()            알림 표시 방식·채널 설정, 알림을 누르면 해당 화면으로 이동, 예약 맞추기
import { useEffect } from 'react'
import { AppState, Linking, Platform } from 'react-native'
import { router } from 'expo-router'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Notifications from 'expo-notifications'
import {
  IS_SERVER_MODE,
  PUSH_SOURCE,
  getIngredients,
  getRecipeRecommendations,
  getReminders,
  onDataChange,
  registerPushDevice,
} from '../data'
import { buildNotifications, routeFromData } from './messages'
import { colors } from '../theme/colors'

export const PUSH_SUPPORTED = Platform.OS !== 'web'

const ID_PREFIX = 'bangguseok.' // 이 앱이 예약한 알림 id 앞부분 (다시 맞출 때 이것만 지움)
const TEST_PREFIX = 'bangguseok.test.'

// Android 알림 채널 (휴대폰 설정 > 알림에서 종류별로 끄고 켤 수 있음)
const CHANNELS = {
  reminders: '생활 알림',
  expiry: '유통기한 알림',
}

// 앱이 켜져 있을 때 온 알림도 위에 배너로 보여 줍니다.
if (PUSH_SUPPORTED) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
}

// ----- 권한 -----

export async function getNotificationPermission() {
  if (!PUSH_SUPPORTED) return 'unsupported'
  try {
    return toStatus(await Notifications.getPermissionsAsync())
  } catch {
    return 'unsupported'
  }
}

export async function requestNotificationPermission() {
  if (!PUSH_SUPPORTED) return 'unsupported'
  try {
    await ensureChannels() // Android 13+ 는 채널이 있어야 권한 창이 뜸
    const current = await Notifications.getPermissionsAsync()
    const result =
      current.granted || !current.canAskAgain
        ? current
        : await Notifications.requestPermissionsAsync()
    const status = toStatus(result)
    if (status === 'granted') requestSync()
    return status
  } catch {
    return 'unsupported'
  }
}

export function openNotificationSettings() {
  Linking.openSettings().catch(() => {})
}

function toStatus(permission) {
  if (permission.granted || permission.status === 'granted') return 'granted'
  if (permission.status === 'undetermined' || permission.canAskAgain) return 'undetermined'
  return 'denied'
}

// ----- 앱 전체 설정 (src/app/_layout.js 에서 한 번) -----

export function useNotificationSetup() {
  useEffect(() => {
    if (!PUSH_SUPPORTED) return undefined

    ensureChannels().catch(() => {})

    // 알림을 눌러서 앱이 켜졌을 때 (앱이 꺼져 있던 경우)
    if (Notifications.getLastNotificationResponse) {
      const last = Notifications.getLastNotificationResponse()
      if (last) openFromResponse(last)
    } else {
      Notifications.getLastNotificationResponseAsync?.().then(openFromResponse, () => {})
    }

    // 앱이 켜져 있거나 뒤에 있을 때 알림을 누른 경우
    const responseSub = Notifications.addNotificationResponseReceivedListener(openFromResponse)

    // 예약 맞추기: 지금 한 번, 앱으로 돌아올 때마다, 재료·알림이 바뀔 때마다
    requestSync()
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestSync()
    })
    const stopListening = onDataChange(requestSync)

    return () => {
      responseSub.remove()
      appStateSub.remove()
      stopListening()
    }
  }, [])
}

// 같은 알림으로 두 번 이동하지 않게 기억
let handledResponseId = null

function openFromResponse(response) {
  const request = response?.notification?.request
  if (!request) return
  const responseId = `${request.identifier}:${response.notification.date}`
  if (responseId === handledResponseId) return
  handledResponseId = responseId

  const route = routeFromData(request.content?.data)
  if (!route) return
  // 앱 틀이 다 뜬 뒤에 이동 (바로 부르면 화면이 준비되기 전이라 실패할 수 있음)
  setTimeout(() => router.push(route), 0)
}

// ----- 예약 맞추기 -----

let syncTimer = null
let syncChain = Promise.resolve()

// 짧은 시간에 여러 번 바뀌어도 한 번만 맞춥니다.
function requestSync() {
  if (!PUSH_SUPPORTED) return
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncChain = syncChain.then(syncNotifications).catch(() => {})
  }, 800)
}

// 지금 데이터로 예약 알림을 모두 새로 맞춥니다.
export async function syncNotifications() {
  if (!PUSH_SUPPORTED) return
  try {
    const permission = await Notifications.getPermissionsAsync()
    if (toStatus(permission) !== 'granted') return

    if (PUSH_SOURCE === 'server') {
      await cancelOurNotifications() // 서버가 보내므로 앱 예약은 지움 (두 번 오지 않게)
      await registerTokenToServer()
      return
    }

    const planned = await collectNotifications()
    await cancelOurNotifications()
    for (const item of planned) {
      await Notifications.scheduleNotificationAsync({
        identifier: item.id,
        content: { title: item.title, body: item.body, data: item.data, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.date,
          channelId: item.channel,
        },
      })
    }
  } catch (error) {
    console.warn('[notifications] 알림 예약을 맞추지 못했어요:', error?.message ?? error)
  }
}

async function collectNotifications() {
  // 하나가 실패해도(서버 준비 중 501 등) 나머지 알림은 예약합니다.
  const [reminders, ingredients, recipes] = await Promise.all([
    getReminders()
      .then((data) => data.groups.flatMap((group) => group.items))
      .catch(() => []),
    getIngredients()
      .then((data) => data.items)
      .catch(() => []),
    getRecipeRecommendations({ imminent_first: true })
      .then((data) => [...data.ready, ...data.almost])
      .catch(() => []),
  ])
  return buildNotifications({ reminders, ingredients, recipes })
}

async function cancelOurNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ID_PREFIX) && !n.identifier.startsWith(TEST_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  )
}

async function ensureChannels() {
  if (Platform.OS !== 'android') return
  await Promise.all(
    Object.entries(CHANNELS).map(([id, name]) =>
      Notifications.setNotificationChannelAsync(id, {
        name,
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: colors.primary,
      }),
    ),
  )
}

// ----- 서버 푸시 (PUSH_SOURCE = 'server') -----

let registeredToken = null

async function registerTokenToServer() {
  if (!IS_SERVER_MODE) return
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  if (Platform.OS === 'android' && isExpoGo) {
    console.warn('[notifications] Android Expo Go 는 원격 푸시를 받을 수 없어요. 개발 빌드가 필요해요.')
    return
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) {
    console.warn('[notifications] EAS projectId 가 없어서 푸시 토큰을 받을 수 없어요. (eas init 필요)')
    return
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
  if (token === registeredToken) return
  await registerPushDevice(token, Platform.OS === 'ios' ? 'IOS' : 'ANDROID')
  registeredToken = token
}

// ----- 개발용 -----

// 5초 뒤 테스트 알림 (누르면 생활 알림 화면)
export async function sendTestNotification(seconds = 5) {
  if (!PUSH_SUPPORTED) throw new Error('웹에서는 푸시 알림을 받을 수 없어요')
  const status = await requestNotificationPermission()
  if (status !== 'granted') throw new Error('알림 권한을 허용해야 테스트할 수 있어요')
  await Notifications.scheduleNotificationAsync({
    identifier: `${TEST_PREFIX}${Date.now()}`,
    content: {
      title: '지금 빨래 시간이에요',
      body: '방구석 매니저 테스트 알림이에요. 누르면 생활 알림 화면으로 가요',
      data: { url: '/alert' },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: 'reminders',
    },
  })
}
