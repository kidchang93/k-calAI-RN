import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { TAB_TONES, TabTone } from '@/constants/tab-tone';
import { DISPLAY_FONT } from '@/constants/typography';

// 탭 색의 두툼한 버튼 (2026-10-05). 상세 화면 아래 고정 버튼과 화면 안의 주요 버튼이 같은 모양을
// 쓰도록 한 곳에 둔다. solid = 그 화면의 할 일 하나, outline = 보조 동작(낮춘 버튼).
// 그림자 대신 아래 테두리(5)로 눌리는 느낌을 낸다 — 웹·네이티브가 같은 코드다.
export function ChunkyButton({
  tone,
  label,
  onPress,
  variant = 'solid',
  disabled = false,
  loading = false,
}: {
  tone: TabTone;
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
  disabled?: boolean;
  loading?: boolean;
}) {
  const toneStyle = TAB_TONES[tone];
  const isSolid = variant === 'solid';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isSolid
          ? { backgroundColor: toneStyle.fill, borderColor: toneStyle.shade }
          : { backgroundColor: '#ffffff', borderColor: toneStyle.fill },
        isDisabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={isSolid ? '#ffffff' : toneStyle.text} />
      ) : (
        <Text style={[styles.label, { color: isSolid ? '#ffffff' : toneStyle.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderBottomWidth: 5,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.74,
  },
});
