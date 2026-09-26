// 방구석 매니저 공통 색상
// 색을 바꾸거나 새로 쓸 때는 이 파일만 고치고,
// 다른 파일에서는 import { colors } from '../theme/colors' 로 불러서 쓰세요.
//   예) style={{ color: colors.primary }}

export const colors = {
  // 메인 색상 (파란 보라)
  primary: '#4a5ae8',
  primaryDark: '#3a45c4',
  primaryLight: '#eceffd', // 알림 박스, 요약 카드, 사진 자리 배경
  primaryGradient: ['#5563ea', '#3a45c4'], // 레벨 카드 그라데이션 (왼쪽 위 → 오른쪽 아래)
  primaryShadow: 'rgba(74, 90, 232, 0.35)', // 떠 있는 버튼 그림자

  // 배경
  pageBg: '#e9ebf3', // 웹에서 휴대폰 틀 바깥 배경
  screenBg: '#f5f6fc', // 화면 배경
  surface: '#ffffff', // 흰 카드, 버튼, 칩

  // 글자
  text: '#1c1d2b',
  textSub: '#6b6f80',
  textOnPrimary: '#ffffff',

  // 테두리
  border: '#dfe2ec',
  phoneFrame: '#cfd2de', // 웹에서 휴대폰 틀 테두리
  phoneFrameShadow: 'rgba(28, 29, 43, 0.12)', // 웹에서 휴대폰 틀 그림자

  // 경고 (AI 인식 신뢰도 낮음 등)
  warning: '#ee8a1c',
  warningLight: '#fdf1e2',

  // 카메라 촬영 영역
  cameraBg: '#181824',
  cameraGuide: 'rgba(255, 255, 255, 0.3)', // 네 모서리 ㄱ자 선
  cameraIcon: '#7c7f92',
  cameraDim: 'rgba(24, 24, 36, 0.6)', // 인식 중일 때 사진 위를 어둡게

  // 기타
  backdrop: 'rgba(28, 29, 43, 0.4)', // 아래에서 올라오는 창 뒤 배경
  onPrimaryBadge: 'rgba(255, 255, 255, 0.24)', // 메인 색 버튼 위의 작은 뱃지 (예: AI)
  toastBg: '#2a2c3d', // 아래에 잠깐 뜨는 알림
  toastAction: '#aab3ff', // 알림 안의 '수정' 같은 버튼 글자
  danger: '#e5484d', // 삭제, 입력 오류
}
