// ⭐ 데이터 모드 스위치. 이 파일만 고치면 됩니다.
//
// 'mock'   : 가짜 모드 (기본값). 서버 없이 폰(브라우저) 안에 저장합니다. 발표·화면 개발용
// 'server' : 서버 모드. 백엔드 API(backend/README.md, Swagger /docs)를 호출합니다.
export const DATA_MODE = 'mock'

// 서버 모드에서 부를 백엔드 주소 (끝에 / 없이)
// - 웹 브라우저로 테스트: 'http://localhost:8000'
// - 폰(Expo Go)으로 테스트: PC의 IP 주소. 예) 'http://192.168.0.12:8000'
//   (폰에서 localhost 는 폰 자신이라 PC 서버에 닿지 않아요. PC IP는 cmd 에서 ipconfig 로 확인)
export const API_BASE_URL = 'http://localhost:8000'

// 개발용: true 면 앱을 켤 때마다 온보딩(기본 양념 설정)이 뜹니다. 커밋할 때는 false 로!
export const DEV_ALWAYS_SHOW_ONBOARDING = false

// 개발용: true 면 스플래시(파란 '방구석 매니저' 화면)를 1.5초 기다리지 않고 데이터만 불러오면 바로 넘어갑니다.
// 커밋할 때는 false 로!
export const DEV_SKIP_SPLASH = false
