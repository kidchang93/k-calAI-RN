// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'camera.fill': 'photo-camera',
  // 돌아보기 탭 (2026-09-16, KCAL-44). '진료'(medical-services)에서 바뀌었다 —
  // 이 탭은 진료 준비만이 아니라 지난 4주를 되짚는 곳이고, 십자 아이콘은 병원 자체를
  // 가리켜 진료 중개처럼 읽힌다(하지 않기로 한 것). 달력이 '지난 날들'을 가리킨다.
  calendar: 'calendar-month',
  'person.fill': 'person',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} />;
}
