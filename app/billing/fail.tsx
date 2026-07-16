import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isBillingSupported } from '@/services/toss-sdk';

// 토스 결제창의 failUrl 착지점. 결제창이 `?code=…&message=…`를 붙여 되돌린다.
// 서버를 부르지 않는다 — 카드 등록이 없었으므로 청구도, 취소할 것도 없다.
//
// **사용자 취소는 실패가 아니다.** 스스로 닫은 것을 빨간 오류로 그리면 앱이 고장난 것처럼 보인다
// (카카오 error=cancelled를 KakaoCancelledError로 조용히 넘기는 것과 같은 판단, DESIGN.md).

// 토스가 사용자 취소에 쓰는 코드. 결제 수단·창 종류에 따라 둘 다 나온다.
const CANCEL_CODES = ['USER_CANCEL', 'PAY_PROCESS_CANCELED'];

export default function BillingFailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const code = singleParam(params.code);
  const message = singleParam(params.message);
  const isCanceled = code !== null && CANCEL_CODES.includes(code);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.resultCard}>
            <View style={[styles.iconWrap, isCanceled ? styles.iconWrapInfo : styles.iconWrapError]}>
              <MaterialIcons
                color={isCanceled ? '#3182f6' : '#e5484d'}
                name={isCanceled ? 'info-outline' : 'error-outline'}
                size={32}
              />
            </View>

            <Text style={styles.resultTitle}>
              {isCanceled ? '결제를 취소했어요' : '결제를 완료하지 못했어요'}
            </Text>
            <Text style={styles.resultMessage}>
              {isCanceled
                ? '카드는 등록되지 않았고 결제된 금액도 없어요. 필요할 때 다시 시작할 수 있어요.'
                : (message ?? '결제 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.')}
            </Text>

            {/* 취소가 아닐 때만 코드를 보여준다 — 문의 시 식별용. 취소에는 노이즈다. */}
            {!isCanceled && code !== null ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{`오류 코드 ${code}`}</Text>
              </View>
            ) : null}
          </View>

          {isBillingSupported() ? null : (
            <Text style={styles.note}>결제는 웹에서 진행해주세요.</Text>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={() => router.replace('/plan')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>요금제로 돌아가기</Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace('/home')}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>홈으로</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 쿼리 파라미터는 string | string[]로 온다. 빈 값은 없는 것으로 취급한다.
function singleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return singleParam(value[0]);
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  return value;
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  codeBox: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  codeText: {
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '700',
  },
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  iconWrapError: {
    backgroundColor: '#fff5f5',
  },
  iconWrapInfo: {
    backgroundColor: '#edf6ff',
  },
  note: {
    color: '#8b95a1',
    fontSize: 12,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  resultCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 24,
  },
  resultMessage: {
    color: '#6b7684',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  resultTitle: {
    color: '#191f28',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    justifyContent: 'center',
    padding: 20,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
  },
  secondaryButtonText: {
    color: '#4e5968',
    fontSize: 15,
    fontWeight: '800',
  },
});
