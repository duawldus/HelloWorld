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
