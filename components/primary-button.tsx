import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

// 폼 제출용 민트 버튼. loading 이면 스피너로 바뀌고 눌리지 않는다(disabled 에 따로 넣지 않아도 된다).
// 기본은 위 여백 8을 두고, 보조 버튼과 묶인 그룹 안에서는 inGroup 으로 뺀다.
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  inGroup = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  inGroup?: boolean;
}) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        inGroup && styles.primaryButtonInGroup,
        isDisabled && styles.primaryButtonDisabled,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color="#22211f" />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#60beb8',
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: '#99d2ce',
  },
  primaryButtonInGroup: {
    marginTop: 0,
  },
  primaryButtonText: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
});
