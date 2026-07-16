import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

// 요금제·구독 계약 (서버 api/subscription_api.py).
//   GET  /api/plans            무인증 — 가입 화면이 로그인 전에 가격표를 그린다.
//   GET  /api/me/subscription  Bearer — 내 요금제 + 오늘 사진 인식 사용량 + 자동결제 상태.
//   PUT  /api/me/subscription  Bearer — **무료(lite)로의 다운그레이드만** 허용된다.
// 서버 필드는 snake_case를 그대로 유지한다 (docs/CODE_STYLE.md).
//
// 2026-07-16 자동결제 연동(DATA_MODEL.md 24장)으로 PUT의 의미가 좁아졌다: 유료 플랜을 보내면
// **400 "결제를 통해 업그레이드해주세요"**다. 유료 전환은 오직 결제 흐름(services/billing-api.ts)이다.
// 응답의 plan은 **실효 플랜**이라 만료된 유료 구독은 lite로 내려온 것처럼 보인다.

export type Plan = {
  code: string;
  label: string;
  price_krw: number;
  daily_vision_quota: number;
  // 본인 제외, 그룹에 추가할 수 있는 인원.
  max_group_members: number;
  max_pets: number;
  max_owned_groups: number;
};

export type VisionUsage = {
  used: number;
  limit: number;
  remaining: number;
  // 다음 리셋 시각(KST 자정을 UTC로 표현한 ISO 문자열).
  resets_at: string;
};

export type MySubscription = {
  // 실효 플랜 — 기간이 만료된 유료 구독은 서버가 lite로 해석해 내려준다 (24장).
  plan: Plan;
  vision_usage: VisionUsage;
  started_at: string;
  // 'active' | 'canceled'(자동갱신 해지, 기간까지는 유료) | 'past_due'(갱신 실패, 재시도 중).
  // 요금제 code와 같은 이유로 유니온으로 굳히지 않는다 — 서버가 상태를 늘려도 앱이 깨지지 않아야
  // 한다. 화면은 아는 값만 분기하고 나머지는 기본 표시로 흘린다.
  status: string;
  // 유료 기간 종료 시각(ISO). 해지해도 이 시각까지는 유료다. 무료 회원은 null.
  current_period_end: string | null;
  // 다음 자동결제 시각(ISO). 해지·무료 회원은 null.
  next_billing_at: string | null;
  cancel_at_period_end: boolean;
};

export const SUBSCRIPTION_API_URL = apiUrl('/api', process.env.EXPO_PUBLIC_SUBSCRIPTION_API_URL);

// 네트워크 실패 시 가입 화면이 요금제 없이 막히면 안 된다 — 서버 시드(리비전 0016, Lite 3→5)와
// 같은 값의 번들 폴백. 정본은 언제나 서버의 참조 테이블(plans)이다 (선택지 데이터 규칙, DESIGN.md).
export const FALLBACK_PLANS: Plan[] = [
  {
    code: 'lite',
    label: 'Lite',
    price_krw: 0,
    daily_vision_quota: 5,
    max_group_members: 1,
    max_pets: 1,
    max_owned_groups: 1,
  },
  {
    code: 'pro',
    label: 'Pro',
    price_krw: 5000,
    daily_vision_quota: 30,
    max_group_members: 5,
    max_pets: 5,
    max_owned_groups: 3,
  },
  {
    code: 'premium',
    label: 'Premium',
    price_krw: 10000,
    daily_vision_quota: 100,
    max_group_members: 10,
    max_pets: 10,
    max_owned_groups: 5,
  },
];

// 가입 화면이 세션 발급 전에 부르는 유일한 조회다 — auth-api와 같은 이유로 순수 fetch를 쓴다.
export async function fetchPlans(): Promise<Plan[]> {
  const response = await fetch(`${SUBSCRIPTION_API_URL}/plans`);

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `요금제 조회 실패: ${response.status}`);
  }

  const data = (await response.json()) as unknown;

  if (!isRecord(data) || !Array.isArray(data.plans)) {
    throw new Error('서버 응답에 plans 배열이 없습니다.');
  }

  return data.plans.map((item) => ensure(parsePlan(item)));
}

export async function fetchMySubscription(): Promise<MySubscription> {
  const response = await apiFetch(`${SUBSCRIPTION_API_URL}/me/subscription`);

  return ensure(parseMySubscription(await parseOk(response, '요금제 조회 실패')));
}

// **무료(lite) 전환 전용이다.** 유료 플랜을 보내면 서버가 400을 준다 — 이 경로에는 결제 검증이
// 없어 열어 두면 누구나 Premium이 될 수 있기 때문이다 (24장). 업그레이드는 billing-api.ts를 쓴다.
//
// 무료 전환은 즉시 적용되고 **남은 유료 기간을 포기한다.** 그래서 요금제 화면은 유료 구독자에게
// 이 함수가 아니라 cancelBilling()을 붙인다 — 기간을 지키면서 자동갱신만 끄는 쪽이 정답이다.
export async function changePlan(planCode: string): Promise<MySubscription> {
  const response = await apiFetch(`${SUBSCRIPTION_API_URL}/me/subscription`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan_code: planCode }),
  });

  return ensure(parseMySubscription(await parseOk(response, '요금제 변경 실패')));
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

async function parseOk(response: Response, fallback: string): Promise<unknown> {
  if (!response.ok) {
    const message = await readErrorMessage(response);
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

function parsePlan(value: unknown): Plan | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.code !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.price_krw !== 'number' ||
    typeof value.daily_vision_quota !== 'number' ||
    typeof value.max_group_members !== 'number' ||
    typeof value.max_pets !== 'number' ||
    typeof value.max_owned_groups !== 'number'
  ) {
    return null;
  }

  return {
    code: value.code,
    label: value.label,
    price_krw: value.price_krw,
    daily_vision_quota: value.daily_vision_quota,
    max_group_members: value.max_group_members,
    max_pets: value.max_pets,
    max_owned_groups: value.max_owned_groups,
  };
}

function parseVisionUsage(value: unknown): VisionUsage | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.used !== 'number' ||
    typeof value.limit !== 'number' ||
    typeof value.remaining !== 'number' ||
    typeof value.resets_at !== 'string'
  ) {
    return null;
  }

  return {
    used: value.used,
    limit: value.limit,
    remaining: value.remaining,
    resets_at: value.resets_at,
  };
}

// billing-api.ts의 confirm·cancel도 같은 MySubscriptionResponse를 받는다 — 파싱을 복제하지 않도록
// export 한다 (내부 헬퍼 중 유일한 예외).
export function parseMySubscription(value: unknown): MySubscription | null {
  if (!isRecord(value)) {
    return null;
  }

  const plan = parsePlan(value.plan);
  const vision_usage = parseVisionUsage(value.vision_usage);

  if (plan === null || vision_usage === null || typeof value.started_at !== 'string') {
    return null;
  }

  // 자동결제 4필드는 2026-07-16에 **추가**된 것이라 구버전 서버 응답에는 아예 없을 수 있다.
  // 없거나 형식이 어긋나면 무료 회원과 같은 기본값으로 흘린다 — 이 필드들 때문에 요금제 화면
  // 전체가 '응답 형식 오류'로 막히면 안 된다. 기존 3필드는 그대로 필수 검증을 유지한다.
  return {
    plan,
    vision_usage,
    started_at: value.started_at,
    status: typeof value.status === 'string' ? value.status : 'active',
    current_period_end: toIsoOrNull(value.current_period_end),
    next_billing_at: toIsoOrNull(value.next_billing_at),
    cancel_at_period_end: value.cancel_at_period_end === true,
  };
}

// 누락·null·타입 불일치를 전부 null로 좁힌다 (nullable ISO 필드 전용).
function toIsoOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
