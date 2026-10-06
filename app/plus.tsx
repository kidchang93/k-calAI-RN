import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { ChunkyButton } from '@/components/chunky-button';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { SessionLoading } from '@/components/session-loading';
import { DISPLAY_FONT } from '@/constants/typography';
import { useAuthSession } from '@/services/auth-session';
import {
  fetchPlusProducts,
  isIapSupported,
  PLUS_PERIOD_TEXT,
  PlusPeriod,
  PlusProduct,
  purchasePlus,
  PurchaseCancelledError,
  restorePlus,
} from '@/services/iap';
import { fetchMySubscription, MySubscription } from '@/services/subscription-api';

// 플러스 알아보기 (P-02, 2026-10-06 — 서버 DATA_MODEL.md 32-7). **iOS 에서만 판다.**
// - 웹: 팔지 않는다. 앱에서 산 이용권이 같은 계정이면 웹에서도 열린다(심사 3.1.3(b)) — 구매 링크를 두지 않는다.
// - Android: '준비 중'만. Play 결제 정책상 다른 결제 수단을 안내하면 안 된다.
// - iOS 인데 expo-iap 네이티브 모듈이 없는 빌드(OTA 로 새 JS 만 받은 옛 빌드·Expo Go): 업데이트 안내.
// 고지(가격·갱신 주기·해지 방법·약관·처리방침·구매 복원)는 심사 3.1.2 필수라 구매 버튼과 한 묶음이다.

const PLUS_PLAN_CODE = 'plus';

const BENEFITS: { icon: keyof typeof MaterialIcons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'event-note',
    title: '지난 진료부터 오늘까지',
    body: '석 달 치 식단을 리포트 한 장에 담아요. 기간은 최대 1년까지 골라요.',
  },
  {
    icon: 'bar-chart',
    title: '지난 구간과 나란히',
    body: '지난번 진료 때와 이번을 같은 표에 놓아요. 어떻게 볼지는 의료진과 함께 정해요.',
  },
  {
    icon: 'science',
    title: '검사 수치와 식단 겹쳐 보기',
    body: '옮겨 적은 검사일 옆에 그동안의 나트륨·칼륨·인 기록을 놓아요.',
  },
  {
    icon: 'photo-camera',
    title: '사진 인식 하루 30회',
    body: '간식까지 사진으로 남겨도 넉넉해요.',
  },
];

export default function PlusScreen() {
  const authState = useAuthSession();
  const router = useRouter();
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [products, setProducts] = useState<PlusProduct[]>([]);
  const [period, setPeriod] = useState<PlusPeriod>('yearly');
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const isAuthenticated = authState.status === 'authenticated';
  const canBuy = isIapSupported();

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [mine, found] = await Promise.all([
        fetchMySubscription(),
        canBuy ? fetchPlusProducts() : Promise.resolve([]),
      ]);

      setSubscription(mine);
      setProducts(found);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, canBuy]);

  useEffect(() => {
    void load();
  }, [load]);

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

  // 이미 플러스면 팔 것이 없다 — 지금 이용권(P-04)으로. 복원에 성공했을 때도 이 길로 간다.
  if (subscription?.plan.code === PLUS_PLAN_CODE) {
    return <Redirect href="/plan" />;
  }

  const selected = products.find((product) => product.period === period) ?? null;
  const isBusy = isPurchasing || isRestoring;

  const startPurchase = async () => {
    if (selected === null || subscription === null) {
      return;
    }

    // 옛 서버는 회원 토큰을 주지 않는다. 토큰 없이 사면 서버가 이 회원의 구매인지 확인할 수 없다.
    if (subscription.app_account_token === null) {
      setErrorMessage('구독 준비가 아직 끝나지 않았어요. 잠시 후 다시 시도해주세요.');
      return;
    }

    setIsPurchasing(true);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const result = await purchasePlus(selected.productId, subscription.app_account_token);

      if (result === 'pending') {
        setNoticeMessage("구매 승인을 기다리고 있어요. 승인되면 아래 '구매 복원'을 눌러주세요.");
        return;
      }

      // 성공하면 플러스 리포트(P-03). 리포트에서 들어왔으면 그 화면으로 돌아가고, 아니면 이 화면을 바꾼다.
      router.dismissTo('/report');
    } catch (error) {
      if (error instanceof PurchaseCancelledError) {
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const restore = async () => {
    setIsRestoring(true);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      if (await restorePlus()) {
        // 서버가 플러스를 붙였다 — 다시 읽으면 위 Redirect 가 지금 이용권으로 보낸다.
        await load();
      } else {
        setNoticeMessage('이 Apple ID에 복원할 플러스 구독이 없어요.');
      }
    } catch (error) {
      if (error instanceof PurchaseCancelledError) {
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Screen gap={18}>
      <Stack.Screen options={{ headerShown: false }} />
      <BackButton />

      <View style={styles.header}>
        <Text style={styles.badge}>케어테이블 플러스</Text>
        <Text accessibilityRole="header" style={styles.title}>
          진료 날, 지난 진료부터 오늘까지 한 장으로
        </Text>
      </View>

      <View style={styles.benefits}>
        {BENEFITS.map((benefit) => (
          <View key={benefit.title} style={styles.benefitRow}>
            <View style={styles.benefitIcon}>
              <MaterialIcons color="#1e4290" name={benefit.icon} size={22} />
            </View>
            <View style={styles.benefitBody}>
              <Text style={styles.benefitTitle}>{benefit.title}</Text>
              <Text style={styles.benefitText}>{benefit.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.freeBox}>
        <Text style={styles.freeBoxStrong}>무료로 계속 쓰는 것</Text>
        {' · 기록과 경고, 오늘 영양, 진료 준비, 최근 2주 리포트'}
      </Text>

      {errorMessage ? <ErrorBanner message={errorMessage} onRetry={() => void load()} /> : null}

      {noticeMessage ? <Notice icon="info-outline" text={noticeMessage} /> : null}

      {!canBuy ? (
        <Notice icon="info-outline" text={unsupportedText()} />
      ) : isLoading ? (
        <LoadingState label="구독 상품을 불러오는 중입니다." />
      ) : selected === null ? (
        errorMessage ? null : (
          <ErrorBanner
            message="구독 상품을 불러오지 못했어요. 잠시 후 다시 시도해주세요."
            onRetry={() => void load()}
          />
        )
      ) : (
        <>
          <View accessibilityLabel="구독 기간 고르기" style={styles.periods}>
            {products.map((product) => (
              <PeriodOption
                badge={product.period === 'yearly' ? discountText(products) : null}
                caption={periodCaption(product)}
                isSelected={product.period === period}
                key={product.productId}
                label={`${PLUS_PERIOD_TEXT[product.period].name} ${product.displayPrice}`}
                onPress={() => setPeriod(product.period)}
              />
            ))}
          </View>

          <ChunkyButton
            disabled={isBusy}
            label={selected.hasFreeTrial ? '7일 무료로 시작하기' : '플러스 구독하기'}
            loading={isPurchasing}
            onPress={() => void startPurchase()}
            tone="visit"
          />

          <Text style={styles.terms}>{termsText(selected)}</Text>
        </>
      )}

      <View style={styles.links}>
        <LinkText label="이용약관" onPress={() => router.push('/legal/terms')} />
        <Text style={styles.linkDot}>·</Text>
        <LinkText label="개인정보 처리방침" onPress={() => router.push('/legal/privacy')} />
        {canBuy ? (
          <>
            <Text style={styles.linkDot}>·</Text>
            <LinkText
              disabled={isBusy}
              label={isRestoring ? '복원 중…' : '구매 복원'}
              onPress={() => void restore()}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function PeriodOption({
  badge,
  caption,
  isSelected,
  label,
  onPress,
}: {
  badge: string | null;
  caption: string;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.period,
        isSelected && styles.periodSelected,
        pressed && styles.pressed,
      ]}>
      <View style={styles.periodBody}>
        <Text style={styles.periodLabel}>{label}</Text>
        <Text style={styles.periodCaption}>{caption}</Text>
      </View>
      {badge ? <Text style={styles.periodBadge}>{badge}</Text> : null}
    </Pressable>
  );
}

function Notice({ icon, text }: { icon: keyof typeof MaterialIcons.glyphMap; text: string }) {
  return (
    <View style={styles.notice}>
      <MaterialIcons color="#5c5b57" name={icon} size={18} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

function LinkText({
  disabled = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

// ⚠️ 다른 결제 수단을 가리키지 않는다(Android: Play 결제 정책, 서버 LEGAL_COMPLIANCE.md §6-4).
function unsupportedText(): string {
  if (Platform.OS === 'web') {
    return '플러스는 iPhone 앱에서 구독할 수 있어요.';
  }

  if (Platform.OS === 'android') {
    return 'Android 구독은 준비 중이에요.';
  }

  return '앱을 최신 버전으로 업데이트하면 구독할 수 있어요.';
}

// 심사 3.1.2 — 가격·갱신 주기·해지 방법. 가격은 스토어가 준 문자열 그대로다.
function termsText(product: PlusProduct): string {
  const text = PLUS_PERIOD_TEXT[product.period];
  const trial = product.hasFreeTrial ? '7일 무료 체험이 끝나면 ' : '';

  return `${trial}${text.short} ${product.displayPrice}이 Apple ID로 결제되고, 해지하지 않으면 ${text.cycle}마다 자동으로 갱신돼요. 갱신 24시간 전까지 iPhone 설정 › Apple ID › 구독에서 해지할 수 있고, 해지해도 기록은 그대로 남아요.`;
}

function periodCaption(product: PlusProduct): string {
  if (product.period === 'monthly') {
    return '한 달씩';
  }

  const perMonth = product.price === null ? null : formatPrice(product.price / 12, product.currency);

  return perMonth === null ? '1년씩' : `월 ${perMonth}꼴`;
}

// 연간이 월간 12번보다 얼마나 싼가. 두 가격을 스토어에서 받았을 때만 — 앱이 할인율을 지어내지 않는다.
function discountText(products: PlusProduct[]): string | null {
  const yearly = products.find((product) => product.period === 'yearly')?.price ?? null;
  const monthly = products.find((product) => product.period === 'monthly')?.price ?? null;

  if (yearly === null || monthly === null || monthly <= 0) {
    return null;
  }

  const percent = Math.round((1 - yearly / (monthly * 12)) * 100);

  return percent > 0 ? `${percent}% 할인` : null;
}

// '월 ₩3,250꼴'처럼 연간 가격을 12로 나눈 참고값. 통화 서식을 못 하는 런타임이면 줄을 뺀다.
function formatPrice(amount: number, currency: string): string | null {
  try {
    return new Intl.NumberFormat('ko-KR', {
      currency,
      maximumFractionDigits: currency === 'KRW' ? 0 : 2,
      style: 'currency',
    }).format(amount);
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3ebfb',
    borderRadius: 999,
    color: '#1e4290',
    fontSize: 13,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  benefitBody: {
    flex: 1,
    gap: 2,
  },
  benefitIcon: {
    alignItems: 'center',
    backgroundColor: '#e3ebfb',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  benefitRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  benefitText: {
    color: '#5c5b57',
    fontSize: 14,
    lineHeight: 20,
  },
  benefitTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  benefits: {
    gap: 12,
  },
  freeBox: {
    backgroundColor: '#eef7f5',
    borderRadius: 12,
    color: '#1c5a55',
    fontSize: 13,
    lineHeight: 20,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  freeBoxStrong: {
    fontWeight: '800',
  },
  header: {
    gap: 8,
  },
  link: {
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 6,
  },
  linkDot: {
    color: '#a9a6a1',
    fontSize: 13,
  },
  linkText: {
    color: '#1e4290',
    fontSize: 13,
    fontWeight: '800',
  },
  links: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  notice: {
    alignItems: 'center',
    backgroundColor: '#e4e2de',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  noticeText: {
    color: '#5c5b57',
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  period: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 4,
    borderColor: '#e4e2de',
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  periodBadge: {
    backgroundColor: '#2f5fc4',
    borderRadius: 999,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  periodBody: {
    flex: 1,
    gap: 2,
  },
  periodCaption: {
    color: '#5c5b57',
    fontSize: 13,
  },
  periodLabel: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  periodSelected: {
    backgroundColor: '#e3ebfb',
    borderBottomColor: '#1e4290',
    borderBottomWidth: 5,
    borderColor: '#2f5fc4',
    borderWidth: 3,
  },
  periods: {
    gap: 10,
  },
  pressed: {
    opacity: 0.74,
  },
  terms: {
    color: '#5c5b57',
    fontSize: 12,
    lineHeight: 18,
  },
  title: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 30,
    lineHeight: 38,
  },
});
