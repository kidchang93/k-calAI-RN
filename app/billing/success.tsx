import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BillingChargeError,
  BillingUnavailableError,
  confirmBilling,
} from '@/services/billing-api';
import { MySubscription } from '@/services/subscription-api';

// 토스 결제창의 successUrl 착지점. 결제창이 `?authKey=…&customerKey=…`를 덧붙여 되돌린다
// (plan은 우리가 successUrl에 미리 심어 둔 값). 여기서 서버 confirm을 불러 실제 청구가 일어난다.
//
// 뒤로가기(BackButton)를 두지 않는다 — 뒤는 토스 결제창이고, 이 화면으로 되돌아오면 이미 소비된
// authKey로 confirm을 다시 부르게 된다. 이동은 전부 router.replace로 끊는다.

type FailureKind = 'charge' | 'unavailable' | 'general';

export default function BillingSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const authKey = singleParam(params.authKey);
  const customerKey = singleParam(params.customerKey);
  const planCode = singleParam(params.plan);

  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [isConfirming, setIsConfirming] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failureKind, setFailureKind] = useState<FailureKind>('general');
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    // authKey는 **1회용**이다. 리렌더·StrictMode로 두 번 부르면 두 번째는 반드시 실패하므로
    // 마운트 1회만 보낸다. 레이아웃 가드 덕분에 이 시점의 세션은 이미 복원돼 있다.
    if (hasRequestedRef.current) {
      return;
    }

    if (authKey === null || customerKey === null || planCode === null) {
      setIsConfirming(false);
      return;
    }

    hasRequestedRef.current = true;

    const run = async () => {
      try {
        setSubscription(await confirmBilling({ authKey, customerKey, planCode }));
      } catch (error) {
        setFailureKind(toFailureKind(error));
        setErrorMessage(
          error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        );
      } finally {
        setIsConfirming(false);
      }
    };

    void run();
  }, [authKey, customerKey, planCode]);

  const hasParams = authKey !== null && customerKey !== null && planCode !== null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {isConfirming ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>결제를 확인하고 있어요. 잠시만 기다려주세요.</Text>
            </View>
          ) : !hasParams ? (
            <ResultCard
              accent="#e5484d"
              accentBackground="#fff5f5"
              icon="link-off"
              message="결제 정보가 확인되지 않았어요. 요금제 화면에서 다시 시도해주세요."
              title="잘못된 접근이에요"
            />
          ) : errorMessage !== null ? (
            <ResultCard
              accent="#e5484d"
              accentBackground="#fff5f5"
              icon="error-outline"
              message={errorMessage}
              title={failureTitle(failureKind)}
            />
          ) : subscription !== null ? (
            <SuccessCard subscription={subscription} />
          ) : null}

          {isConfirming ? null : (
            <View style={styles.actions}>
              <Pressable
                onPress={() => router.replace('/plan')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>
                  {errorMessage !== null || !hasParams ? '요금제로 돌아가 다시 시도' : '요금제 보기'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.replace('/payments')}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>결제 내역 보기</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SuccessCard({ subscription }: { subscription: MySubscription }) {
  const nextBilling = formatDay(subscription.next_billing_at);

  return (
    <View style={styles.resultCard}>
      <View style={[styles.iconWrap, { backgroundColor: '#edf6ff' }]}>
        <MaterialIcons color="#20c997" name="check-circle" size={32} />
      </View>
      <Text style={styles.resultTitle}>구독이 시작됐어요</Text>
      <Text style={styles.resultMessage}>
        {`${subscription.plan.label} 요금제를 바로 사용할 수 있어요.`}
      </Text>

      <View style={styles.detailBox}>
        <DetailRow label="요금제" value={subscription.plan.label} />
        <DetailRow
          label="결제 금액"
          value={
            subscription.plan.price_krw === 0
              ? '무료'
              : `월 ${subscription.plan.price_krw.toLocaleString()}원`
          }
        />
        <DetailRow
          label="사진 인식"
          value={`하루 ${subscription.plan.daily_vision_quota}건`}
        />
        {/* 다음 결제일이 없으면(해지·무료) 줄 자체를 그리지 않는다 — 빈 값을 보여주지 않는다. */}
        {nextBilling === null ? null : <DetailRow label="다음 결제" value={nextBilling} />}
      </View>
    </View>
  );
}

function ResultCard({
  accent,
  accentBackground,
  icon,
  message,
  title,
}: {
  accent: string;
  accentBackground: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  message: string;
  title: string;
}) {
  return (
    <View style={styles.resultCard}>
      <View style={[styles.iconWrap, { backgroundColor: accentBackground }]}>
        <MaterialIcons color={accent} name={icon} size={32} />
      </View>
      <Text style={styles.resultTitle}>{title}</Text>
      <Text style={styles.resultMessage}>{message}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// 502(청구 실패)·503(미설정)·그 외를 제목으로 구분한다. 본문은 서버가 준 한국어 detail을 쓴다.
function toFailureKind(error: unknown): FailureKind {
  if (error instanceof BillingChargeError) {
    return 'charge';
  }

  if (error instanceof BillingUnavailableError) {
    return 'unavailable';
  }

  return 'general';
}

function failureTitle(kind: FailureKind): string {
  if (kind === 'charge') {
    return '결제하지 못했어요';
  }

  if (kind === 'unavailable') {
    return '결제 서비스를 준비 중이에요';
  }

  return '결제를 완료하지 못했어요';
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

// ISO → 'M월 D일' (plan 화면의 표기와 같은 규칙).
function formatDay(isoText: string | null): string | null {
  if (isoText === null) {
    return null;
  }

  const date = new Date(isoText);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  detailBox: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    gap: 10,
    padding: 14,
    width: '100%',
  },
  detailLabel: {
    color: '#6b7684',
    fontSize: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailValue: {
    color: '#333d4b',
    fontSize: 14,
    fontWeight: '800',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 60,
    justifyContent: 'center',
    width: 60,
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
  stateBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 32,
  },
  stateText: {
    color: '#6b7684',
    fontSize: 14,
    textAlign: 'center',
  },
});
