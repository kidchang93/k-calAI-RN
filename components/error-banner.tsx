import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// 저장·조회 실패 배너. 홈 화면의 errorBox 패턴(#fff5f5 / #e5484d)을 공용화한 것.
export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBox}>
      <MaterialIcons color="#e5484d" name="error-outline" size={20} />
      <View style={styles.errorBody}>
        <Text style={styles.errorText}>{message}</Text>
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  errorBody: {
    flex: 1,
    gap: 10,
  },
  errorBox: {
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  errorText: {
    color: '#e5484d',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.74,
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#e5484d',
    fontSize: 14,
    fontWeight: '700',
  },
});
