import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';
import { MySubscription, parseMySubscription } from '@/services/subscription-api';

// 토스페이먼츠 자동결제(빌링) 계약 (서버 api/billing_api.py, DATA_MODEL.md 24장). 전부 Bearer 필수.
//   POST /api/billing/checkout  { plan_code }                            → BillingCheckout
//        400(무료·없는 플랜) · 401 · 503(결제 키 미설정)
//   POST /api/billing/confirm   { auth_key, customer_key, plan_code }    → MySubscriptionResponse
//        400 · 401 · 502(결제사 청구 실패) · 503
//   POST /api/billing/cancel    (바디 없음)                               → MySubscriptionResponse
//        400(유료 구독 아님) · 401
//
// **요청에 금액이 없다.** 청구액은 언제나 서버가 plans.price_krw에서 정한다 — 앱이 보낸 금액을
// 서버가 받으면 100원짜리 Premium이 팔린다 (24장 '절대 규칙'). checkout 응답의 amount는 표시 전용이다.

export type BillingCheckout = {
  customer_key: string;
  // 공개 클라이언트 키. 서버가 checkout 응답으로만 내려준다 (앱 번들·EXPO_PUBLIC_*에 두지 않는다).
  client_key: string;
  plan_code: string;
  // 표시용. 실제 청구액은 confirm에서 서버가 다시 정한다.
  amount: number;
  order_name: string;
};

// 502 = 결제사(토스) 쪽 청구 실패(카드 한도·유효성 등). 이때 **구독은 활성화되지 않는다**(24장).
// 503과 구분해야 화면이 "결제 실패"와 "결제 준비 안 됨"을 다른 문장으로 안내할 수 있다.
export class BillingChargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingChargeError';
  }
}

// 503 = 서버에 토스 키가 없다. 장애가 아니라 미구성이라 사용자가 할 수 있는 일이 없다 —
// 재시도 버튼 대신 '준비 중' 안내를 그린다.
export class BillingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingUnavailableError';
  }
}

export const BILLING_API_URL = apiUrl('/api/billing', process.env.EXPO_PUBLIC_BILLING_API_URL);

// 결제창에 넘길 값을 받는다. 카드 등록 전이라 서버는 아직 아무것도 청구·기록하지 않는다.
export async function startCheckout(planCode: string): Promise<BillingCheckout> {
  const response = await apiFetch(`${BILLING_API_URL}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan_code: planCode }),
  });

  return ensure(parseCheckout(await parseOk(response, '결제 준비 실패')));
}

// 결제창이 준 authKey로 카드 등록 + 최초 청구를 요청한다. authKey는 **1회용**이라 호출부가
// 중복 호출을 막아야 한다 (app/billing/success.tsx의 ref 가드).
export async function confirmBilling(input: {
  authKey: string;
  customerKey: string;
  planCode: string;
}): Promise<MySubscription> {
  const response = await apiFetch(`${BILLING_API_URL}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_key: input.authKey,
      customer_key: input.customerKey,
      plan_code: input.planCode,
    }),
  });

  return ensure(parseMySubscription(await parseOk(response, '결제 확인 실패')));
}

// 자동갱신 해지. 즉시 무료가 되는 것이 아니라 current_period_end까지는 유료를 유지한다.
export async function cancelBilling(): Promise<MySubscription> {
  const response = await apiFetch(`${BILLING_API_URL}/cancel`, { method: 'POST' });

  return ensure(parseMySubscription(await parseOk(response, '자동결제 해지 실패')));
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

async function parseOk(response: Response, fallback: string): Promise<unknown> {
  if (!response.ok) {
    const message = await readErrorMessage(response);

    // 서버 detail은 이미 사용자용 한국어 문장이다 (토스 원문·fail_code는 서버 로그에만 남는다).
    if (response.status === 503) {
      throw new BillingUnavailableError(
        message || '결제 서비스를 준비 중입니다. 잠시 후 다시 시도해주세요.'
      );
    }

    if (response.status === 502) {
      throw new BillingChargeError(
        message || '결제에 실패했습니다. 카드 상태를 확인한 뒤 다시 시도해주세요.'
      );
    }

    throw new Error(message || `${fallback}: ${response.status}`);
  }

  return (await response.json()) as unknown;
}

function ensure<T>(parsed: T | null): T {
  if (parsed === null) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCheckout(value: unknown): BillingCheckout | null {
  if (!isRecord(value)) {
    return null;
  }

  // client_key·customer_key가 없으면 결제창을 띄울 수 없다 — 빈 값으로 SDK를 부르지 않는다.
  if (
    typeof value.customer_key !== 'string' ||
    value.customer_key === '' ||
    typeof value.client_key !== 'string' ||
    value.client_key === '' ||
    typeof value.plan_code !== 'string' ||
    typeof value.amount !== 'number' ||
    typeof value.order_name !== 'string'
  ) {
    return null;
  }

  return {
    customer_key: value.customer_key,
    client_key: value.client_key,
    plan_code: value.plan_code,
    amount: value.amount,
    order_name: value.order_name,
  };
}
