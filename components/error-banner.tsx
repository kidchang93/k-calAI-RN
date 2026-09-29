import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// 저장·조회 실패 배너. 홈 화면의 errorBox 패턴(#fbeaea / #b8524e)을 공용화한 것.
// 402(이용 한도)는 재시도로 풀리지 않으므로 actionLabel="확인" + onRetry 에 닫기를 넘긴다. 무료 출시라 '업그레이드'로
// 잇지 않는다(2026-09-29) — 판매 경로 없이 결제를 권하면 스토어 심사 3.1.1 에 걸린다. 문구는 서버 402 detail 이 정한다.
export function ErrorBanner({
  message,
  onRetry,
  actionLabel = '다시 시도',
}: {
  message: string;
  onRetry: () => void;
  actionLabel?: string;
}) {
  return (
    <View style={styles.errorBox}>
      <MaterialIcons color="#b8524e" name="error-outline" size={20} />
      <View style={styles.errorBody}>
        <Text style={styles.errorText}>{message}</Text>
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
          <Text style={styles.retryButtonText}>{actionLabel}</Text>
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
    backgroundColor: '#fbeaea',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  errorText: {
    color: '#b8524e',
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
    color: '#b8524e',
    fontSize: 14,
    fontWeight: '700',
  },
});
