// 가짜 모드의 푸시 기기 등록: 보낼 서버가 없어서 아무것도 하지 않습니다.
// (가짜 모드의 푸시 알림은 src/notifications/ 가 폰 안에서 직접 예약합니다)
export async function registerPushDevice(token, platform) {
  return { id: 0, platform }
}

export async function unregisterPushDevice() {
  return null
}
