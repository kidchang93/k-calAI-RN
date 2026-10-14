import { requireOptionalNativeModule } from 'expo';
import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isEligibleForIntroOfferIOS,
  isUserCancelledError,
  requestPurchase,
  restorePurchases,
  type ProductOrSubscription,
  type ProductSubscription,
  type ProductSubscriptionAndroid,
  type Purchase,
} from 'expo-iap';
import { Linking, Platform } from 'react-native';

import {
  StoreUnavailableError,
  verifyAppStorePurchase,
  verifyPlayPurchase,
} from '@/services/billing-api';

// 플러스 — 인앱 구독. **iOS(App Store, 2026-10-06 — 서버 DATA_MODEL.md 32장)와 Android(Google Play,
// 2026-10-14 — 33장)에서 판다.** 웹은 팔지 않는다.
//
// 구매:  스토어 구매 → 조회 키를 서버에 보낸다 → **서버 200 뒤에만 finishTransaction**
//          iOS      StoreKit(sku, appAccountToken = 서버가 준 회원 UUID) → transactionId → POST /api/billing/appstore/verify
//          Android  Play 결제(sku, offerToken, obfuscatedAccountId = 같은 UUID) → purchaseToken → POST /api/billing/play/verify
//        먼저 끝내면 서버 확인이 실패했을 때 스토어가 그 거래를 다시 알려 주지 않아, 돈을 낸 사람이 플러스를 못
//        받는다. 끝내지 않은 거래는 '구매 복원'이 다시 집어 서버에 보낸다. Android 의 finish 는 acknowledge 인데
//        서버가 verify 안에서 이미 acknowledge 한다(3일 안에 안 하면 Google 이 환불) — 앱의 finish 실패는 삼킨다.
// 복원:  스토어 동기화 → 지금 유효한 플러스 구매를 전부 verify 에 다시 보낸다(409 문구는 그대로).
// 해지:  앱 안에서 하지 않는다 — 구독한 스토어의 구독 관리 화면을 연다.
//
// expo-iap 는 네이티브 모듈이라 Expo Go·웹·이 모듈이 없는 옛 빌드(expo-iap 이전 개발 빌드
// 등)에는 없다. import 는 지연 해석이라 터지지 않지만 **호출은 터진다** — 화면은 isIapSupported() 가
// true 일 때만 구매 경로를 그리고, 아래 함수들도 같은 검사를 다시 한다.
// ponytail: 앱 전역 purchaseUpdatedListener 를 두지 않는다. 자동 갱신은 서버가 스토어 알림(32-4·33-4)으로
// 맞추고, 끝내지 않은 거래는 복원이 처리한다. 앱 밖 구매(프로모션 코드 등)를 받아야 하면 그때 붙인다.

export const PLUS_PRODUCT_IDS = {
  yearly: 'com.kcalai.kcalairn.plus.yearly',
  monthly: 'com.kcalai.kcalairn.plus.monthly',
} as const;

export type PlusPeriod = keyof typeof PLUS_PRODUCT_IDS;

// 기간 표기. '연간 ₩39,000' · '연 ₩39,000이 결제되고' · '1년마다 갱신'.
export const PLUS_PERIOD_TEXT: Record<PlusPeriod, { name: string; short: string; cycle: string }> = {
  yearly: { name: '연간', short: '연', cycle: '1년' },
  monthly: { name: '월간', short: '월', cycle: '1개월' },
};

export type PlusProduct = {
  period: PlusPeriod;
  productId: string;
  // 스토어가 준 현지화 가격 문자열. 앱이 가격을 만들지 않는다 — 심사관의 스토어프런트가 다를 수 있다.
  displayPrice: string;
  price: number | null;
  currency: string;
  // 상품에 무료 체험이 있고 **이 Apple ID 가 받을 수 있을 때만** true(체험은 계정당 1회). Android 는 체험이 없어
  // (33-1) 늘 false 다.
  hasFreeTrial: boolean;
  // Android 기본 요금제의 offerToken — Play 결제는 구독을 이 토큰으로 산다. iOS 는 null.
  offerToken: string | null;
};

// 사용자가 시트를 닫았다. 카카오·Apple 로그인 취소와 같이 오류가 아니다 — 화면은 배너를 띄우지 않는다.
export class PurchaseCancelledError extends Error {
  name = 'PurchaseCancelledError';
}

const IS_ANDROID = Platform.OS === 'android';
const PLUS_SKUS: string[] = Object.values(PLUS_PRODUCT_IDS);
const ANDROID_PACKAGE = 'com.kcalai.kcalairn';

const NOT_SUPPORTED_MESSAGE = '이 환경에서는 구독할 수 없어요.';
const STORE_FAIL_MESSAGE = `${IS_ANDROID ? 'Google Play' : 'App Store'}에 연결하지 못했어요. 잠시 후 다시 시도해주세요.`;
const PURCHASE_FAIL_MESSAGE = '구매를 마치지 못했어요. 잠시 후 다시 시도해주세요.';
const RESTORE_FAIL_MESSAGE = '구매 내역을 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
const NETWORK_MESSAGE = '서버에 연결하지 못했어요.';
const RESTORE_HINT = `결제는 ${IS_ANDROID ? 'Google Play' : 'Apple'}에 남아 있어요 — 잠시 뒤 '구매 복원'을 누르면 이어서 확인해요.`;

// '구매 복원'을 눌렀는데 이 스토어 계정에 플러스 구독이 없을 때 화면이 보이는 문구.
export const RESTORE_NONE_MESSAGE = `이 ${IS_ANDROID ? 'Google 계정' : 'Apple ID'}에 복원할 플러스 구독이 없어요.`;

let connection: Promise<void> | null = null;

export function isIapSupported(): boolean {
  return (Platform.OS === 'ios' || IS_ANDROID) && requireOptionalNativeModule('ExpoIap') !== null;
}

// 이 기기의 스토어에서 산 구독인가 — 서버 provider 값과 맞춘다(appstore | play).
export function isThisStore(provider: string | null): boolean {
  return provider === (IS_ANDROID ? 'play' : 'appstore');
}

export function plusPeriodOf(productId: string | null): PlusPeriod | null {
  if (productId === PLUS_PRODUCT_IDS.yearly) {
    return 'yearly';
  }

  return productId === PLUS_PRODUCT_IDS.monthly ? 'monthly' : null;
}

// 스토어에 등록된 플러스 상품. App Store Connect·Play Console 에 없는 상품은 빠진다(빈 배열일 수 있다).
export async function fetchPlusProducts(): Promise<PlusProduct[]> {
  await connect();

  let items: ProductOrSubscription[];

  try {
    items = (await fetchProducts({ skus: PLUS_SKUS, type: 'subs' })) ?? [];
  } catch {
    throw new Error(STORE_FAIL_MESSAGE);
  }

  const subscriptions = items.filter(isSubscription);
  const groupIds = subscriptions.flatMap((item) =>
    item.platform === 'ios' && item.subscriptionGroupIdIOS ? [item.subscriptionGroupIdIOS] : []
  );
  // 자격을 못 물으면 체험이 없다고 본다 — '7일 무료'를 약속했다가 바로 결제되는 쪽이 더 나쁘다.
  const isEligible =
    groupIds.length > 0 ? await isEligibleForIntroOfferIOS(groupIds[0]).catch(() => false) : false;

  return (Object.keys(PLUS_PRODUCT_IDS) as PlusPeriod[]).flatMap((period) => {
    const product = subscriptions.find((item) => item.id === PLUS_PRODUCT_IDS[period]);

    if (product === undefined) {
      return [];
    }

    const offerToken = product.platform === 'android' ? basePlanOfferToken(product) : null;

    // offerToken 없는 Android 구독은 살 수 없다(Play 결제가 거절한다) — 고를 수 없게 뺀다.
    if (product.platform === 'android' && offerToken === null) {
      return [];
    }

    return [
      {
        period,
        productId: product.id,
        displayPrice: product.displayPrice,
        price: product.price ?? null,
        currency: product.currency,
        hasFreeTrial:
          product.platform === 'ios' &&
          isEligible &&
          product.introductoryPricePaymentModeIOS === 'free-trial',
        offerToken,
      },
    ];
  });
}

// 'verified' = 서버가 구독을 붙였다. 'pending' = 승인·결제 대기(자녀 보호 '구입 요청'·Play 의 대기 결제 등) —
// 승인되면 복원으로 잇는다.
export async function purchasePlus(
  product: PlusProduct,
  appAccountToken: string
): Promise<'verified' | 'pending'> {
  await connect();

  let result: Purchase | Purchase[] | null;

  try {
    // expo-iap 가 플랫폼에 맞는 쪽(apple | google)만 읽는다. Android 의 obfuscatedAccountId 는 iOS 의
    // appAccountToken 과 같은 값 — 서버가 이 회원의 구매인지 확인하는 열쇠다(다르면 409, 33-3).
    result = await requestPurchase({
      type: 'subs',
      request: {
        apple: { sku: product.productId, appAccountToken },
        google: {
          skus: [product.productId],
          obfuscatedAccountId: appAccountToken,
          subscriptionOffers:
            product.offerToken === null
              ? null
              : [{ sku: product.productId, offerToken: product.offerToken }],
        },
      },
    });
  } catch (error) {
    throw toStoreError(error, PURCHASE_FAIL_MESSAGE);
  }

  const purchase = (Array.isArray(result) ? result : [result]).find(
    (item) =>
      item !== null && item.productId === product.productId && item.purchaseState === 'purchased'
  );

  if (purchase === undefined || purchase === null) {
    return 'pending';
  }

  try {
    await verifyAndFinish(purchase);
  } catch (error) {
    // 서버가 스토어에 묻지 못했거나 닿지 않았다 — 결제는 끝났으니 다시 사지 말고 복원하라고 알린다.
    // 400·409 는 다시 해도 같은 답이라 서버 문구만 보인다.
    if (error instanceof StoreUnavailableError) {
      throw new Error(`${error.message} ${RESTORE_HINT}`);
    }

    if (error instanceof TypeError) {
      throw new Error(`${NETWORK_MESSAGE} ${RESTORE_HINT}`);
    }

    throw error;
  }

  return 'verified';
}

// true = 플러스 구매를 서버에 다시 붙였다. false = 이 스토어 계정에 유효한 플러스 구독이 없다.
export async function restorePlus(): Promise<boolean> {
  await connect();

  let purchases: Purchase[];

  try {
    await restorePurchases();
    purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
  } catch (error) {
    throw toStoreError(error, RESTORE_FAIL_MESSAGE);
  }

  const plusPurchases = purchases.filter((item) => PLUS_SKUS.includes(item.productId));

  // 409(다른 계정에서 산 구독)·400(Play 결제 대기)은 서버 문구 그대로 화면에 간다.
  for (const purchase of plusPurchases) {
    await verifyAndFinish(purchase);
  }

  return plusPurchases.length > 0;
}

// 해지·변경은 **구독을 판 스토어**가 한다 — 기기가 아니라 서버의 provider 로 고른다(iPhone 에서 산 구독을
// Android 에서 열면 Apple 계정 구독 페이지로 간다).
export async function openSubscriptionManagement(
  provider: string | null,
  productId: string | null
): Promise<void> {
  if (provider === 'play') {
    const sku = productId === null ? '' : `sku=${encodeURIComponent(productId)}&`;

    await Linking.openURL(
      `https://play.google.com/store/account/subscriptions?${sku}package=${ANDROID_PACKAGE}`
    );
    return;
  }

  await Linking.openURL('https://apps.apple.com/account/subscriptions');
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

// 연결은 앱이 살아 있는 동안 한 번. 실패한 프라미스를 캐시에 남기지 않는다(toss-sdk.ts 와 같은 규칙).
async function connect(): Promise<void> {
  if (!isIapSupported()) {
    throw new Error(NOT_SUPPORTED_MESSAGE);
  }

  connection ??= initConnection().then(
    (isConnected) => {
      if (!isConnected) {
        throw new Error(STORE_FAIL_MESSAGE);
      }
    },
    () => {
      throw new Error(STORE_FAIL_MESSAGE);
    }
  );

  try {
    await connection;
  } catch (error) {
    connection = null;
    throw error;
  }
}

async function verifyAndFinish(purchase: Purchase): Promise<void> {
  if (IS_ANDROID) {
    // Play 구매에는 늘 토큰이 있다. 없으면 서버에 물을 키가 없다 — 끝내지 않고 둔다(복원이 다시 집는다).
    if (!purchase.purchaseToken) {
      throw new Error(PURCHASE_FAIL_MESSAGE);
    }

    await verifyPlayPurchase(purchase.productId, purchase.purchaseToken);
  } else {
    await verifyAppStorePurchase(purchase.transactionId ?? purchase.id);
  }

  // 서버가 이미 구독을 붙였다(Android 는 acknowledge 까지). finish 실패는 거래가 큐에 남아 다음 복원 때 다시
  // 끝날 뿐이라 삼킨다.
  await finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
}

// 스토어 오류 원문은 영어다 — 취소만 가려내고 나머지는 한국어 한 문장으로 바꾼다.
function toStoreError(error: unknown, fallback: string): Error {
  return isUserCancelledError(error) ? new PurchaseCancelledError() : new Error(fallback);
}

function isSubscription(item: ProductOrSubscription): item is ProductSubscription {
  return item.type === 'subs';
}

// 기본 요금제(오퍼 없는 base plan)의 토큰을 고른다 — 오퍼(체험·할인)가 붙은 토큰으로 사면 화면이 보인 가격과
// 다르게 결제된다. 기본 요금제 오퍼는 id 가 basePlanId 와 같다(offerId 가 없다). 못 찾으면 토큰 있는 첫 오퍼.
function basePlanOfferToken(product: ProductSubscriptionAndroid): string | null {
  const offers = product.subscriptionOffers.filter((offer) => offer.offerTokenAndroid);
  const offer = offers.find((item) => item.id === item.basePlanIdAndroid) ?? offers[0];

  return offer?.offerTokenAndroid ?? null;
}
