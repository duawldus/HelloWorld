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
}
