import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { PaymentStatusBadge } from '@/components/payment-status-badge';
import { getPayment, PaymentItem, PaymentNotFoundError } from '@/services/payment-api';

export default function PaymentDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const paymentId = Number(params.id);
  const isValidId = Number.isInteger(paymentId) && paymentId > 0;

  const [payment, setPayment] = useState<PaymentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPayment = useCallback(async () => {
    if (!isValidId) {
      setIsLoading(false);
      setNotFound(true);

      return;
    }

    setIsLoading(true);
    setNotFound(false);
    setErrorMessage(null);

    try {
      setPayment(await getPayment(paymentId));
    } catch (error) {
      // 404는 결정적이라 재시도 버튼 대신 '찾을 수 없어요' 안내를 그린다.
      if (error instanceof PaymentNotFoundError) {
        setPayment(null);
        setNotFound(true);

        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [isValidId, paymentId]);

  useFocusEffect(
    useCallback(() => {
      void loadPayment();
    }, [loadPayment])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>영수증을 불러오는 중입니다.</Text>
            </View>
          ) : notFound ? (
            <View style={styles.emptyCard}>
              <MaterialIcons color="#8b95a1" name="receipt-long" size={28} />
              <Text style={styles.emptyTitle}>영수증을 찾을 수 없어요</Text>
              <Text style={styles.emptyText}>이미 삭제되었거나 접근할 수 없는 결제예요.</Text>
            </View>
          ) : payment === null ? (
            errorMessage ? (
              <ErrorBanner message={errorMessage} onRetry={() => void loadPayment()} />
            ) : null
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>영수증</Text>
                <Text style={styles.subtitle}>{payment.plan_label}</Text>
              </View>

              {errorMessage ? (
                <ErrorBanner message={errorMessage} onRetry={() => void loadPayment()} />
              ) : null}

              {/* 배지를 금액 아래가 아니라 라벨 옆(오른쪽 위)에 둔다 — 720px 카드에서 내용이
                  왼쪽 1/3에만 몰려 오른쪽이 비어 보이던 자리다. */}
              <View style={styles.amountCard}>
                <View style={styles.amountTopLine}>
                  <Text style={styles.amountLabel}>결제금액</Text>
                  <PaymentStatusBadge status={payment.status} />
                </View>
                <Text style={styles.amountValue}>{`₩${payment.amount.toLocaleString()}`}</Text>
              </View>

              {/* 상품명은 헤더 부제에 이미 있다 — 여기 또 두면 한 화면에 같은 값이 세 번 나온다
                  (목록에서 넘어온 것까지 치면 네 번). */}
              <View style={styles.receiptCard}>
                <ReceiptRow label="결제수단" value={payment.method ?? '정보 없음'} />
                {/* 승인 시각이 없으면 결제가 이뤄지지 않은 것이다(실패·대기). 그때 created_at을
                    '결제일시'로 부르면 나가지도 않은 돈에 결제 시각을 붙이는 셈이다. */}
                <ReceiptRow
                  label={payment.approved_at !== null ? '결제일시' : '시도일시'}
                  value={formatDateTime(payment.approved_at ?? payment.created_at)}
                />
                <ReceiptRow label="주문번호" value={payment.order_id} />
                {payment.fail_reason !== null ? (
                  <ReceiptRow label="실패 사유" value={payment.fail_reason} />
                ) : null}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={styles.receiptValue}>{value}</Text>
    </View>
  );
}

// 서버의 ISO 문자열을 기기 로컬 날짜·시각(YYYY.MM.DD HH:MM)으로 표시한다.
function formatDateTime(isoText: string): string {
  const date = new Date(isoText);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

const styles = StyleSheet.create({
  amountCard: {
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    gap: 8,
    padding: 20,
  },
  amountLabel: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  amountTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountValue: {
    color: '#191f28',
    fontSize: 28,
    fontWeight: '900',
  },
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    padding: 24,
  },
  emptyText: {
    color: '#6b7684',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#191f28',
    fontSize: 19,
    fontWeight: '900',
  },
  header: {
    gap: 4,
  },
  receiptCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 14,
    padding: 20,
  },
  receiptLabel: {
    color: '#6b7684',
    fontSize: 14,
    fontWeight: '700',
  },
  receiptRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  receiptValue: {
    color: '#191f28',
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
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
  },
  subtitle: {
    color: '#6b7684',
    fontSize: 14,
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
});
