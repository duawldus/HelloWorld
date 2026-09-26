// 사진으로 등록 화면 (와이어프레임 3-1)
// - 가운데 큰 원: 카메라로 촬영 / 왼쪽 작은 원: 앨범에서 선택 (웹에서는 둘 다 파일 선택)
// - 사진을 고르면 촬영 영역에 보여 주고, AI 인식이 끝나면 인식 결과 확인(3-2)으로 이동합니다.
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { recognizeIngredients } from '../data'
import { CameraIcon, ImageIcon } from '../components/Icons'
import { BackHeader, Screen } from '../components/Screen'
import { colors } from '../theme/colors'

const PICKER_OPTIONS = { mediaTypes: ['images'], quality: 0.7 }

export default function PhotoAddScreen() {
  const [photoUri, setPhotoUri] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [notice, setNotice] = useState(null) // { message, canOpenSettings }
  const leftScreen = useRef(false) // 인식 중에 뒤로 가면 결과 화면으로 넘어가지 않게

  useEffect(() => {
    leftScreen.current = false
    return () => {
      leftScreen.current = true
    }
  }, [])

  // 촬영: 카메라 권한을 먼저 요청하고, 허용되면 카메라를 엽니다.
  const takePhoto = () =>
    openPicker({
      requestPermission: ImagePicker.requestCameraPermissionsAsync,
      launch: ImagePicker.launchCameraAsync,
      deniedMessage: '설정에서 카메라를 허용해 주세요',
    })

  // 앨범: 사진 접근 권한을 먼저 요청하고, 허용되면 앨범을 엽니다.
  const pickFromAlbum = () =>
    openPicker({
      requestPermission: ImagePicker.requestMediaLibraryPermissionsAsync,
      launch: ImagePicker.launchImageLibraryAsync,
      deniedMessage: '설정에서 사진 접근을 허용해 주세요',
    })

  const openPicker = async ({ requestPermission, launch, deniedMessage }) => {
    setNotice(null)
    try {
      const permission = await requestPermission()
      if (!permission.granted) {
        setNotice({ message: deniedMessage, canOpenSettings: Platform.OS !== 'web' })
        return
      }
      analyze(await launch(PICKER_OPTIONS))
    } catch (error) {
      // 오류가 조용히 묻히지 않게 화면에 보여 줍니다.
      setNotice({ message: `카메라/앨범을 열지 못했어요: ${error?.message ?? error}` })
    }
  }

  const analyze = async (result) => {
    if (result.canceled) return
    const photo = result.assets[0]
    setNotice(null)
    setPhotoUri(photo.uri)
    setAnalyzing(true)
    try {
      const candidates = await recognizeIngredients(photo)
      if (leftScreen.current) return
      router.push({
        pathname: '/ingredient/review',
        params: { candidates: JSON.stringify(candidates) },
      })
      setPhotoUri(null) // 결과 화면에서 돌아오면 다시 찍을 수 있게
    } catch {
      setNotice({ message: '재료를 찾지 못했어요. 다시 시도해 주세요.' })
      setPhotoUri(null)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader title="사진으로 등록" />

      <View style={styles.body}>
        <View style={styles.viewfinder}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <CameraIcon size={44} color={colors.cameraIcon} />
          )}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          {analyzing && (
            <View style={styles.analyzing}>
              <ActivityIndicator size="large" color={colors.textOnPrimary} />
              <Text style={styles.analyzingText}>재료를 찾는 중이에요...</Text>
            </View>
          )}
        </View>

        {notice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice.message}</Text>
            {notice.canOpenSettings && (
              <Pressable style={styles.settingsButton} onPress={() => Linking.openSettings()}>
                <Text style={styles.settingsButtonText}>설정 열기</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Text style={styles.hint}>
            재료들이 겹치지 않게, 밝은 곳에서 촬영하면 인식률이 올라가요
          </Text>
        )}

        <View style={styles.controls}>
          <View style={styles.side}>
            <Pressable
              style={styles.albumButton}
              onPress={pickFromAlbum}
              disabled={analyzing}
              accessibilityLabel="앨범에서 사진 선택"
            >
              <ImageIcon color={colors.text} />
            </Pressable>
          </View>
          <Pressable
            style={styles.shutterRing}
            onPress={takePhoto}
            disabled={analyzing}
            accessibilityLabel="촬영"
          >
            <View style={styles.shutter} />
          </Pressable>
          <View style={styles.side} />
        </View>

        <Text style={styles.hint}>왼쪽 아이콘으로 앨범에서 사진을 선택할 수도 있어요</Text>
      </View>
    </Screen>
  )
}

const CORNER = 32

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },

  // 어두운 촬영 영역
  viewfinder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: colors.cameraBg,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: colors.cameraGuide,
  },
  topLeft: {
    top: 18,
    left: 18,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 6,
  },
  topRight: {
    top: 18,
    right: 18,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 6,
  },
  bottomLeft: {
    bottom: 18,
    left: 18,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 6,
  },
  bottomRight: {
    bottom: 18,
    right: 18,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 6,
  },
  analyzing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: colors.cameraDim,
  },
  analyzingText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },

  hint: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSub,
  },
  notice: {
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  noticeText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.warning,
  },
  settingsButton: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  settingsButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },

  // 앨범 · 촬영 버튼 (촬영 버튼이 가운데 오도록 양옆에 같은 폭의 칸)
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    marginTop: 24,
  },
  side: {
    width: 56,
    alignItems: 'center',
  },
  albumButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  shutterRing: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.border,
    borderRadius: 40,
    backgroundColor: colors.screenBg,
  },
  shutter: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.surface,
  },
})
