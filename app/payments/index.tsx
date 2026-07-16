import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { PaymentStatusBadge } from '@/components/payment-status-badge';
import { getPayments, PaymentItem } from '@/services/payment-api';

export default function PaymentsScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setPayments(await getPayments());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 영수증 상세에서 돌아왔을 때 갱신되도록 포커스마다 다시 읽는다 (목록 화면 패턴).
  useFocusEffect(
    useCallback(() => {
      void loadPayments();
    }, [loadPayments])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>결제 내역</Text>
            <Text style={styles.subtitle}>요금제 결제와 영수증을 여기서 확인하세요.</Text>
          </View>

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>결제 내역을 불러오는 중입니다.</Text>
            </View>
          ) : errorMessage ? (
            <ErrorBanner message={errorMessage} onRetry={() => void loadPayments()} />
          ) : payments === null || payments.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialIcons color="#3182f6" name="receipt-long" size={28} />
              <Text style={styles.emptyTitle}>아직 결제 내역이 없어요</Text>
              <Text style={styles.emptyText}>결제가 발생하면 영수증을 여기서 확인할 수 있어요.</Text>
            </View>
          ) : (
            <View style={styles.paymentList}>
              {payments.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  onPress={() =>
                    router.push({
                      pathname: '/payments/[id]',
                      params: { id: String(payment.id) },
                    })
                  }
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PaymentRow({ payment, onPress }: { payment: PaymentItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.paymentRow, pressed && styles.pressed]}>
      <View style={styles.paymentBody}>
        <Text style={styles.paymentLabel}>{payment.plan_label}</Text>
        <Text style={styles.paymentMeta}>{formatDate(payment.approved_at ?? payment.created_at)}</Text>
        <PaymentStatusBadge status={payment.status} />
      </View>
      <View style={styles.paymentTrailing}>
        <Text style={styles.paymentAmount}>{`₩${payment.amount.toLocaleString()}`}</Text>
        <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
      </View>
    </Pressable>
  );
}

// 서버의 ISO 문자열을 기기 로컬 날짜(YYYY.MM.DD)로 표시한다.
function formatDate(isoText: string): string {
  const date = new Date(isoText);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

const styles = StyleSheet.create({
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
  paymentAmount: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  paymentBody: {
    flex: 1,
    gap: 6,
  },
  paymentLabel: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '800',
  },
  paymentList: {
    gap: 10,
  },
  paymentMeta: {
    color: '#6b7684',
    fontSize: 13,
  },
  paymentRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  paymentTrailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  pressed: {
    opacity: 0.74,
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
