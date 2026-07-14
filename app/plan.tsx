import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { SessionLoading } from '@/components/session-loading';
import { useAuthSession } from '@/services/auth-session';
import {
  changePlan,
  FALLBACK_PLANS,
  fetchMySubscription,
  fetchPlans,
  MySubscription,
  Plan,
} from '@/services/subscription-api';

export default function PlanScreen() {
  const authState = useAuthSession();
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [isLoading, setIsLoading] = useState(true);
  const [changingPlanCode, setChangingPlanCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAuthenticated = authState.status === 'authenticated';

  const loadPlan = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 가격표 조회가 실패해도 내 요금제는 보여준다 — 폴백 상수로 비교표를 그린다.
      const [mine, available] = await Promise.all([
        fetchMySubscription(),
        fetchPlans().catch(() => FALLBACK_PLANS),
      ]);

      setSubscription(mine);
      setPlans(available.length > 0 ? available : FALLBACK_PLANS);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // 사진 인식 사용량은 기록 탭을 다녀오면 늘어난다 — 포커스마다 다시 읽는다 (목록 화면 패턴).
  useFocusEffect(
    useCallback(() => {
      void loadPlan();
    }, [loadPlan])
  );

  if (authState.status === 'loading') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SessionLoading />
      </>
    );
  }

  if (authState.status === 'unauthenticated') {
    return <Redirect href="/auth" />;
  }

  const applyPlan = async (planCode: string) => {
    setChangingPlanCode(planCode);
    setErrorMessage(null);

    try {
      setSubscription(await changePlan(planCode));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setChangingPlanCode(null);
    }
  };

  const usage = subscription?.vision_usage ?? null;
  const usagePercent =
    usage === null || usage.limit <= 0
      ? 0
      : Math.max(0, Math.min(100, (usage.used / usage.limit) * 100));

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 루트 Stack의 'plan' 엔트리 헤더를 숨긴다. 뒤로가기는 BackButton (탭 밖 스택 공통 규칙). */}
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>요금제</Text>
            <Text style={styles.subtitle}>사진 인식 건수와 그룹·반려동물 한도가 달라져요.</Text>
          </View>

          {errorMessage ? (
            <ErrorBanner message={errorMessage} onRetry={() => void loadPlan()} />
          ) : null}

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>요금제를 불러오는 중입니다.</Text>
            </View>
          ) : subscription === null ? null : (
            <View style={styles.currentCard}>
              <View style={styles.currentHeader}>
                <View style={styles.currentIconWrap}>
                  <MaterialIcons color="#3182f6" name="workspace-premium" size={22} />
                </View>
                <View style={styles.currentBody}>
                  <Text style={styles.currentLabel}>현재 요금제</Text>
                  <Text style={styles.currentValue}>
                    {`${subscription.plan.label} · ${formatPlanPrice(subscription.plan.price_krw)}`}
                  </Text>
                </View>
              </View>

              {usage === null ? null : (
                <View style={styles.usageBox}>
                  <View style={styles.usageTopLine}>
                    <Text style={styles.usageLabel}>오늘 사진 인식</Text>
                    <Text style={styles.usageValue}>{`${usage.used} / ${usage.limit}건`}</Text>
                  </View>
                  <View style={styles.usageTrack}>
                    <View style={[styles.usageFill, { width: `${usagePercent}%` }]} />
                  </View>
                  <Text style={styles.usageCaption}>{formatUsageCaption(usage.remaining, usage.resets_at)}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>요금제 비교</Text>
            {plans.map((plan) => (
              <PlanCompareCard
                isChanging={changingPlanCode === plan.code}
                isCurrent={subscription?.plan.code === plan.code}
                isDisabled={changingPlanCode !== null || isLoading}
                key={plan.code}
                onSelect={() => void applyPlan(plan.code)}
                plan={plan}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCompareCard({
  isChanging,
  isCurrent,
  isDisabled,
  onSelect,
  plan,
}: {
  isChanging: boolean;
  isCurrent: boolean;
  isDisabled: boolean;
  onSelect: () => void;
  plan: Plan;
}) {
  return (
    <View style={[styles.planCard, isCurrent && styles.planCardCurrent]}>
      <View style={styles.planHeader}>
        <Text style={styles.planName}>{plan.label}</Text>
        <Text style={styles.planPrice}>{formatPlanPrice(plan.price_krw)}</Text>
      </View>

      <View style={styles.planSpecs}>
        <PlanSpec label="사진 인식" value={`하루 ${plan.daily_vision_quota}건`} />
        <PlanSpec label="그룹 인원" value={`본인 외 ${plan.max_group_members}명`} />
        <PlanSpec label="그룹 개수" value={`${plan.max_owned_groups}개`} />
        <PlanSpec label="반려동물" value={`${plan.max_pets}마리`} />
      </View>

      {isCurrent ? (
        <View style={styles.currentPill}>
          <MaterialIcons color="#20c997" name="check-circle" size={16} />
          <Text style={styles.currentPillText}>사용 중</Text>
        </View>
      ) : (
        <View style={styles.planFooter}>
          <Pressable
            disabled={isDisabled}
            onPress={onSelect}
            style={({ pressed }) => [
              styles.selectButton,
              isDisabled && styles.selectButtonDisabled,
              pressed && !isDisabled && styles.pressed,
            ]}>
            {isChanging ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.selectButtonText}>이 요금제로 변경</Text>
            )}
          </Pressable>
          {/* 결제가 실제로 붙어 있지 않다는 사실을 숨기지 않는다 (서버도 검증 없이 바꾼다). */}
          {plan.price_krw > 0 ? (
            <Text style={styles.paymentNote}>결제 연동 준비 중 — 지금은 즉시 적용됩니다.</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function PlanSpec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.planSpecRow}>
      <Text style={styles.planSpecLabel}>{label}</Text>
      <Text style={styles.planSpecValue}>{value}</Text>
    </View>
  );
}

function formatPlanPrice(priceKrw: number): string {
  return priceKrw === 0 ? '무료' : `월 ${priceKrw.toLocaleString()}원`;
}

// "오늘 2건 남음 · 내일 오전 0시에 초기화". resets_at은 서버가 준 다음 리셋 시각(ISO)이다.
function formatUsageCaption(remaining: number, resetsAt: string): string {
  const resetLabel = formatResetAt(resetsAt);

  if (resetLabel === null) {
    return `오늘 ${remaining}건 남음`;
  }

  return `오늘 ${remaining}건 남음 · ${resetLabel}에 초기화`;
}

function formatResetAt(resetsAt: string): string | null {
  const reset = new Date(resetsAt);

  if (Number.isNaN(reset.getTime())) {
    return null;
  }

  const hour = reset.getHours();
  const meridiem = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isTomorrow =
    reset.getFullYear() === tomorrow.getFullYear() &&
    reset.getMonth() === tomorrow.getMonth() &&
    reset.getDate() === tomorrow.getDate();
  const dayLabel = isTomorrow ? '내일' : `${reset.getMonth() + 1}월 ${reset.getDate()}일`;

  return `${dayLabel} ${meridiem} ${hour12}시`;
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  currentBody: {
    flex: 1,
    gap: 2,
  },
  currentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 16,
    padding: 18,
  },
  currentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  currentIconWrap: {
    alignItems: 'center',
    backgroundColor: '#edf6ff',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  currentLabel: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  currentPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f2f4f6',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currentPillText: {
    color: '#4e5968',
    fontSize: 13,
    fontWeight: '800',
  },
  currentValue: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
  header: {
    gap: 4,
  },
  paymentNote: {
    color: '#8b95a1',
    fontSize: 12,
    lineHeight: 17,
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  planCardCurrent: {
    backgroundColor: '#f5f9ff',
    borderColor: '#3182f6',
  },
  planFooter: {
    gap: 8,
  },
  planHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planName: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
  planPrice: {
    color: '#3182f6',
    fontSize: 16,
    fontWeight: '900',
  },
  planSpecLabel: {
    color: '#6b7684',
    fontSize: 14,
  },
  planSpecRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planSpecValue: {
    color: '#333d4b',
    fontSize: 14,
    fontWeight: '800',
  },
  planSpecs: {
    gap: 8,
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
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: '#191f28',
    fontSize: 19,
    fontWeight: '900',
  },
  selectButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
  },
  selectButtonDisabled: {
    backgroundColor: '#b4c7e7',
  },
  selectButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
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
  usageBox: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    gap: 8,
    padding: 14,
  },
  usageCaption: {
    color: '#6b7684',
    fontSize: 13,
  },
  usageFill: {
    backgroundColor: '#3182f6',
    borderRadius: 999,
    height: '100%',
  },
  usageLabel: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '800',
  },
  usageTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  usageTrack: {
    backgroundColor: '#e5e8eb',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  usageValue: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
  },
});
