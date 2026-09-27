// 앱에서 쓰는 선 아이콘 모음 (react-native-svg)
// color 를 넘기면 그 색으로 그립니다. 예) <HomeIcon color={colors.primary} />
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { colors } from '../theme/colors'

function Icon({ children, size = 24, color = colors.textSub, strokeWidth = 1.8 }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  )
}

export function HomeIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    </Icon>
  )
}

export function FridgeIcon(props) {
  return (
    <Icon {...props}>
      <Rect x="6" y="3" width="12" height="18" rx="2.5" />
      <Path d="M6 11h12" />
    </Icon>
  )
}

export function RecipeIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M4 15a8 8 0 0 1 16 0z" />
      <Path d="M3 18h18" />
      <Path d="M12 7V5.5" />
    </Icon>
  )
}

export function BellIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <Path d="M10 20.5a2 2 0 0 0 4 0" />
    </Icon>
  )
}

export function SearchIcon(props) {
  return (
    <Icon size={22} {...props}>
      <Circle cx="11" cy="11" r="7" />
      <Path d="m20 20-3.5-3.5" />
    </Icon>
  )
}

export function ImageIcon(props) {
  return (
    <Icon size={20} color={colors.primary} {...props}>
      <Rect x="3" y="4" width="18" height="16" rx="2.5" />
      <Circle cx="9" cy="9.5" r="1.5" />
      <Path d="m21 16-5-5-9 9" />
    </Icon>
  )
}

export function PlusIcon(props) {
  return (
    <Icon size={18} color={colors.textOnPrimary} {...props}>
      <Path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function BackIcon(props) {
  return (
    <Icon color={colors.text} {...props}>
      <Path d="m15 5-7 7 7 7" />
    </Icon>
  )
}

export function CameraIcon(props) {
  return (
    <Icon size={22} color={colors.textOnPrimary} {...props}>
      <Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <Circle cx="12" cy="13" r="3.5" />
    </Icon>
  )
}

export function SparkleIcon(props) {
  return (
    <Icon size={18} color={colors.primary} {...props}>
      <Path d="M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2z" />
    </Icon>
  )
}

export function CheckIcon(props) {
  return (
    <Icon size={16} color={colors.primary} strokeWidth={2.2} {...props}>
      <Path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  )
}

// ----- 성과 · 뱃지 -----

// 성과 화면의 연속 기록·뱃지용 불꽃 (레시피 화면의 FlameIcon 과 다른 두 겹 모양)
export function StreakFlameIcon(props) {
  return (
    <Icon size={16} color={colors.textOnPrimary} {...props}>
      <Path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.3-5.4 3.6-7.3.4 1.6 1.3 2.7 2.4 3.2C11.6 7.6 12.6 5 14.8 3c.3 3.1 3.7 5.7 3.7 10.4 0 4.3-2.8 7.6-6.5 7.6z" />
      <Path d="M12 21c-1.6 0-2.8-1.2-2.8-2.9 0-1.6 1.3-2.7 2.1-3.9.8 1.3 3.5 2.2 3.5 4.1 0 1.6-1.2 2.7-2.8 2.7z" />
    </Icon>
  )
}

export function LeafIcon(props) {
  return (
    <Icon color={colors.primary} {...props}>
      <Path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" />
      <Path d="M5 19 13 11" />
    </Icon>
  )
}

export function ChefHatIcon(props) {
  return (
    <Icon color={colors.primary} {...props}>
      <Path d="M7 14.5a4 4 0 0 1-.6-7.9A5.5 5.5 0 0 1 17 5.4a4 4 0 0 1 0 9.1V20H7z" />
      <Path d="M7 17h10" />
    </Icon>
  )
}

export function BookIcon(props) {
  return (
    <Icon color={colors.primary} {...props}>
      <Path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z" />
      <Path d="M12 6.5v13" />
    </Icon>
  )
}

export function TrophyIcon(props) {
  return (
    <Icon color={colors.primary} {...props}>
      <Path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <Path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <Path d="M12 13v4M8.5 20h7M10 17h4" />
    </Icon>
  )
}

export function LockIcon(props) {
  return (
    <Icon color={colors.textSub} {...props}>
      <Rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </Icon>
  )
}

export function CloseIcon(props) {
  return (
    <Icon size={18} {...props}>
      <Path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  )
}

export function ChevronDownIcon(props) {
  return (
    <Icon size={12} {...props}>
      <Path d="m6 9 6 6 6-6" />
    </Icon>
  )
}

export function RefreshIcon(props) {
  return (
    <Icon size={18} color={colors.text} {...props}>
      <Path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <Path d="M20 4v5h-5" />
    </Icon>
  )
}

export function ClockIcon(props) {
  return (
    <Icon size={14} {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 7.5V12l3 2" />
    </Icon>
  )
}

export function FlameIcon(props) {
  return (
    <Icon size={20} color={colors.textOnPrimary} {...props}>
      <Path d="M12 21a6.5 6.5 0 0 1-6.5-6.5c0-2.4 1.3-4.3 2.8-5.6.2 1.6 1 2.8 2.2 3.3-.4-3 .9-5.9 3.5-8.2.4 2.6 1.8 4.5 3.3 6A7 7 0 0 1 18.5 14.5 6.5 6.5 0 0 1 12 21z" />
    </Icon>
  )
}
