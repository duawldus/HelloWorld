// ⭐ 서버 모드의 백엔드 통신은 이 파일에서만 합니다.
// - 처음 요청할 때 게스트 로그인(POST /auth/guest)으로 토큰을 받아 저장하고, 모든 요청에 붙입니다.
// - 토큰이 만료되면(401) 한 번 다시 로그인해서 재시도합니다.
// - 실패하면 백엔드의 { code, message } 를 담은 에러를 던집니다. 화면에서는 error.message 를 보여 주면 됩니다.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_BASE_URL } from '../config.js'

const API_PREFIX = '/api/v1'

const KEYS = {
  deviceId: 'bangguseok.server.deviceId', // 앱 설치마다 한 번 만드는 기기 ID
  token: 'bangguseok.server.token',
}

let token = null

// 예) request('/ingredients')
//     request('/ingredients', { method: 'POST', query: { source: 'PRESET' }, body: { name: '두부' } })
//     request('/vision/recognize', { method: 'POST', form: formData })
export async function request(path, { method = 'GET', query, body, form } = {}) {
  const response = await send(path, { method, query, body, form, token: await getToken() })
  if (response.status !== 401) return parse(response)

  // 토큰이 만료됐거나 서버 DB가 초기화된 경우: 다시 로그인 후 한 번만 재시도
  await clearToken()
  return parse(await send(path, { method, query, body, form, token: await getToken() }))
}

// 사진 파일을 multipart 로 보낼 때 쓰는 FormData 만들기 (expo-image-picker 결과 하나)
export async function imageFormData(fieldName, photo) {
  const form = new FormData()
  const name = photo.fileName ?? 'photo.jpg'
  if (photo.file) {
    // 웹: 파일 선택 결과에 File 이 같이 들어 있음
    form.append(fieldName, photo.file, name)
  } else if (/^(blob|data):/.test(photo.uri)) {
    // 웹에서 File 이 없으면 주소로 내용을 읽어서 첨부
    form.append(fieldName, await (await fetch(photo.uri)).blob(), name)
  } else {
    // 폰: 파일 주소를 그대로 첨부
    form.append(fieldName, { uri: photo.uri, name, type: photo.mimeType ?? 'image/jpeg' })
  }
  return form
}

// 서버 모드에서 로그인 정보를 지웁니다. (다음 요청 때 같은 기기 ID로 다시 로그인)
export async function clearToken() {
  token = null
  await AsyncStorage.removeItem(KEYS.token).catch(() => {})
}

// ----- 아래는 이 파일 안에서만 쓰는 함수 -----

async function getToken() {
  if (token) return token
  token = await AsyncStorage.getItem(KEYS.token).catch(() => null)
  if (token) return token

  const response = await send('/auth/guest', {
    method: 'POST',
    body: { device_id: await getDeviceId() },
  })
  const data = await parse(response)
  token = data.access_token
  await AsyncStorage.setItem(KEYS.token, token).catch(() => {})
  return token
}

async function getDeviceId() {
  let deviceId = await AsyncStorage.getItem(KEYS.deviceId).catch(() => null)
  if (!deviceId) {
    deviceId = `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    await AsyncStorage.setItem(KEYS.deviceId, deviceId).catch(() => {})
  }
  return deviceId
}

async function send(path, { method, query, body, form, token: accessToken }) {
  const search = query
    ? '?' +
      new URLSearchParams(
        Object.entries(query).filter(([, value]) => value !== undefined && value !== null),
      )
    : ''
  const headers = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  try {
    return await fetch(`${API_BASE_URL}${API_PREFIX}${path}${search}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new ApiError(
      `서버에 연결할 수 없어요. 백엔드가 켜져 있는지, config.js 의 API_BASE_URL(${API_BASE_URL})이 맞는지 확인해 주세요.`,
      0,
      'NETWORK_ERROR',
    )
  }
}

async function parse(response) {
  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (response.ok) return data

  if (response.status === 501) throw notReadyError()
  // 백엔드 에러: { code, message } 또는 FastAPI 형식 오류 { detail: [...] }
  const message =
    data?.message ??
    (Array.isArray(data?.detail) ? data.detail.map((d) => d.msg).join(', ') : data?.detail) ??
    `서버 오류가 났어요. (${response.status})`
  throw new ApiError(message, response.status, data?.code)
}

// 백엔드에 아직 없는(또는 501을 주는) 기능
export function notReadyError() {
  return new ApiError('아직 서버에 준비되지 않은 기능이에요. (501)', 501, 'NOT_IMPLEMENTED')
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}
