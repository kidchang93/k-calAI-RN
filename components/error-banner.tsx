import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// 저장·조회 실패 배너. 홈 화면의 errorBox 패턴(#fbeaea / #b8524e)을 공용화한 것.
// 402(이용 한도)는 재시도로 풀리지 않으므로 actionLabel="확인" + onRetry 에 닫기를 넘긴다. 문구는 서버 402 detail 이 정한다.
// 예외: iOS 의 사진 인식 한도(vision_daily)는 '플러스 알아보기' → /plus (2026-10-06, app/meals/compose.tsx).
// 판매 경로가 iOS 인앱 구독뿐이라 웹·Android 에서는 여전히 '확인'만 둔다(심사 3.1.1·Play 정책).
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
