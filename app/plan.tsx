import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { SessionLoading } from '@/components/session-loading';
import { useAuthSession } from '@/services/auth-session';
import { cancelBilling, startCheckout } from '@/services/billing-api';
import {
  FALLBACK_PLANS,
  fetchMySubscription,
  fetchPlans,
  MySubscription,
  Plan,
} from '@/services/subscription-api';
import { billingReturnUrl, isBillingSupported, requestBillingAuth } from '@/services/toss-sdk';

// 유료 전환은 **오직 결제 흐름**이다. changePlan(PUT /api/me/subscription)은 유료 플랜을 400으로
// 막고(24장), 무료 전환은 남은 유료 기간을 포기시킨다 — 그래서 이 화면은 PUT을 쓰지 않는다.
// 유료 구독자가 그만두는 길은 '자동결제 해지'(기간은 지키고 갱신만 끈다)뿐이다.

export default function PlanScreen() {
  const authState = useAuthSession();
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutPlanCode, setCheckoutPlanCode] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isCancelConfirmVisible, setIsCancelConfirmVisible] = useState(false);
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

  // 사진 인식 사용량은 기록 탭을 다녀오면 늘어난다. 결제 성공 화면에서 돌아왔을 때 새 구독 상태를
  // 집는 것도 이 재조회다 — 포커스마다 다시 읽는다 (목록 화면 패턴).
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

  // 결제창을 띄운다. 성공하면 브라우저가 successUrl로 통째로 이동하므로 이 함수 뒤에
  // '성공 처리'를 붙이지 않는다 — 청구는 /billing/success가 confirm으로 마무리한다.
  const subscribe = async (planCode: string) => {
    setCheckoutPlanCode(planCode);
    setErrorMessage(null);

    try {
      const checkout = await startCheckout(planCode);

      await requestBillingAuth({
        clientKey: checkout.client_key,
        customerKey: checkout.customer_key,
        successUrl: billingReturnUrl(`/billing/success?plan=${encodeURIComponent(planCode)}`),
        failUrl: billingReturnUrl('/billing/fail'),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setCheckoutPlanCode(null);
    }
  };

  const cancelSubscription = async () => {
    setIsCanceling(true);
    setErrorMessage(null);

    try {
      setSubscription(await cancelBilling());
      setIsCancelConfirmVisible(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsCanceling(false);
    }
  };

  const usage = subscription?.vision_usage ?? null;
  const usagePercent =
    usage === null || usage.limit <= 0
      ? 0
      : Math.max(0, Math.min(100, (usage.used / usage.limit) * 100));
  const isPaidSubscriber = subscription !== null && subscription.plan.price_krw > 0;
  // 이미 해지 예약된 구독은 다시 해지할 것이 없다. past_due(갱신 실패)는 해지할 수 있게 둔다 —
  // 재시도를 멈추고 싶은 사용자를 막지 않는다.
  const canCancel =
    isPaidSubscriber &&
    subscription !== null &&
    !subscription.cancel_at_period_end &&
    subscription.status !== 'canceled';
  const status = subscription === null ? null : subscriptionStatus(subscription);
  const periodEndText = formatDay(subscription?.current_period_end ?? null);
  const isBusy = checkoutPlanCode !== null || isCanceling || isLoading;

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

              {status === null ? null : (
                <View style={styles.statusRow}>
                  <MaterialIcons
                    color={status.tone === 'alert' ? '#e5484d' : '#6b7684'}
                    name={status.icon}
                    size={16}
                  />
                  <Text style={[styles.statusText, status.tone === 'alert' && styles.statusTextAlert]}>
                    {status.text}
                  </Text>
                </View>
              )}

              {usage === null ? null : (
                <View style={styles.usageBox}>
                  <View style={styles.usageTopLine}>
                    <Text style={styles.usageLabel}>오늘 사진 인식</Text>
                    <Text style={styles.usageValue}>{`${usage.used} / ${usage.limit}건`}</Text>
                  </View>
                  <View style={styles.usageTrack}>
                    <View style={[styles.usageFill, { width: `${usagePercent}%` }]} />
                  </View>
                  <Text style={styles.usageCaption}>
                    {formatUsageCaption(usage.remaining, usage.resets_at)}
                  </Text>
                </View>
              )}

              {/* 해지 확인을 Alert로 묻지 않는다 — react-native-web의 Alert.alert는 **아무것도 하지
                  않는 no-op**이라 결제 주 무대인 웹에서 확인 없이 해지되거나 버튼이 죽는다.
                  화면 안 2단계 확인은 두 플랫폼에서 똑같이 동작한다. */}
              {canCancel ? (
                isCancelConfirmVisible ? (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmTitle}>자동결제를 해지할까요?</Text>
                    <Text style={styles.confirmText}>
                      {periodEndText === null
                        ? '남은 유료 기간에는 계속 이용할 수 있어요. 그 이후에는 무료 요금제로 전환돼요.'
                        : `${periodEndText}까지는 계속 이용할 수 있어요. 그 이후에는 무료 요금제로 전환돼요.`}
                    </Text>
                    <View style={styles.confirmActions}>
                      <Pressable
                        disabled={isCanceling}
                        onPress={() => setIsCancelConfirmVisible(false)}
                        style={({ pressed }) => [styles.keepButton, pressed && styles.pressed]}>
                        <Text style={styles.keepButtonText}>유지하기</Text>
                      </Pressable>
                      <Pressable
                        disabled={isCanceling}
                        onPress={() => void cancelSubscription()}
                        style={({ pressed }) => [
                          styles.confirmCancelButton,
                          isCanceling && styles.confirmCancelButtonDisabled,
                          pressed && !isCanceling && styles.pressed,
                        ]}>
                        {isCanceling ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={styles.confirmCancelButtonText}>해지하기</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    disabled={isBusy}
                    onPress={() => setIsCancelConfirmVisible(true)}
                    style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                    <Text style={styles.cancelButtonText}>자동결제 해지</Text>
                  </Pressable>
                )
              ) : null}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>요금제 비교</Text>
            {plans.map((plan) => (
              <PlanCompareCard
                isCurrent={subscription?.plan.code === plan.code}
                isDisabled={isBusy}
                isPaidSubscriber={isPaidSubscriber}
                isSubscribing={checkoutPlanCode === plan.code}
                key={plan.code}
                onSubscribe={() => void subscribe(plan.code)}
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
  isCurrent,
  isDisabled,
  isPaidSubscriber,
  isSubscribing,
  onSubscribe,
  plan,
}: {
  isCurrent: boolean;
  isDisabled: boolean;
  isPaidSubscriber: boolean;
  isSubscribing: boolean;
  onSubscribe: () => void;
  plan: Plan;
}) {
  const isPaidPlan = plan.price_krw > 0;

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
      ) : isPaidPlan ? (
        <View style={styles.planFooter}>
          {/* 네이티브에는 결제 버튼을 그리지 않는다 — 토스 결제창은 브라우저 전용이고,
              앱 마켓 정책상 디지털 상품은 인앱결제를 붙여야 한다(예정). */}
          {isBillingSupported() ? (
            <>
              <Pressable
                disabled={isDisabled}
                onPress={onSubscribe}
                style={({ pressed }) => [
                  styles.selectButton,
                  isDisabled && styles.selectButtonDisabled,
                  pressed && !isDisabled && styles.pressed,
                ]}>
                {isSubscribing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.selectButtonText}>구독하기</Text>
                )}
              </Pressable>
              <Text style={styles.paymentNote}>
                카드를 등록하면 매월 자동으로 결제돼요. 언제든 해지할 수 있어요.
              </Text>
            </>
          ) : (
            <View style={styles.noticeBox}>
              <MaterialIcons color="#6b7684" name="desktop-windows" size={16} />
              <Text style={styles.noticeText}>
                결제는 웹에서 진행해주세요. 앱 내 결제는 준비 중이에요.
              </Text>
            </View>
          )}
        </View>
      ) : isPaidSubscriber ? (
        // 무료 카드에 '변경' 버튼을 두지 않는다. PUT lite는 즉시 적용되며 **남은 유료 기간을
        // 포기시킨다** — 이미 낸 돈을 버리는 버튼을 무심코 누르게 두지 않는다. 해지가 정답이다.
        <Text style={styles.paymentNote}>
          자동결제를 해지하면 남은 기간이 끝난 뒤 이 요금제로 전환돼요.
        </Text>
      ) : null}
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

// 구독 상태 한 줄. 무료 회원은 표시할 상태가 없다(서버가 status=active + 나머지 null을 준다).
// status는 서버 참조값이라 아는 값만 분기하고 나머지는 기간 표시로 흘린다.
function subscriptionStatus(subscription: MySubscription): {
  icon: keyof typeof MaterialIcons.glyphMap;
  text: string;
  tone: 'normal' | 'alert';
} | null {
  if (subscription.plan.price_krw <= 0) {
    return null;
  }

  const periodEnd = formatDay(subscription.current_period_end);

  if (subscription.cancel_at_period_end || subscription.status === 'canceled') {
    return {
      icon: 'event-busy',
      text:
        periodEnd === null
          ? '자동결제 해지됨 — 남은 기간까지 이용할 수 있어요.'
          : `자동결제 해지됨 — ${periodEnd}까지 이용할 수 있어요.`,
      tone: 'alert',
    };
  }

  if (subscription.status === 'past_due') {
    return {
      icon: 'error-outline',
      text:
        periodEnd === null
          ? '결제에 실패해 다시 시도하고 있어요. 카드 상태를 확인해주세요.'
          : `결제에 실패해 다시 시도하고 있어요 — ${periodEnd}까지 이용할 수 있어요.`,
      tone: 'alert',
    };
  }

  const nextBilling = formatDay(subscription.next_billing_at);

  if (nextBilling !== null) {
    return { icon: 'autorenew', text: `다음 결제 ${nextBilling}`, tone: 'normal' };
  }

  if (periodEnd !== null) {
    return { icon: 'event-available', text: `${periodEnd}까지 이용`, tone: 'normal' };
  }

  return null;
}

function formatPlanPrice(priceKrw: number): string {
  return priceKrw === 0 ? '무료' : `월 ${priceKrw.toLocaleString()}원`;
}

// ISO → 'M월 D일'. 서버가 null을 주거나(무료 회원) 형식이 어긋나면 null.
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
  cancelButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  cancelButtonText: {
    color: '#8b95a1',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmBox: {
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    gap: 10,
    padding: 14,
  },
  confirmCancelButton: {
    alignItems: 'center',
    backgroundColor: '#e5484d',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  confirmCancelButtonDisabled: {
    backgroundColor: '#d1d6db',
  },
  confirmCancelButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  confirmText: {
    color: '#4e5968',
    fontSize: 13,
    lineHeight: 19,
  },
  confirmTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
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
  keepButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  keepButtonText: {
    color: '#4e5968',
    fontSize: 14,
    fontWeight: '800',
  },
  noticeBox: {
    alignItems: 'center',
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  noticeText: {
    color: '#4e5968',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  statusText: {
    color: '#6b7684',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  statusTextAlert: {
    color: '#e5484d',
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
