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
  // 진료 탭 (2026-08-19). 이 탭은 추이만 보는 곳이 아니라 진료를 준비하는 곳이라
  // 그래프 아이콘으로는 성격이 드러나지 않는다.
  stethoscope: 'medical-services',
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
