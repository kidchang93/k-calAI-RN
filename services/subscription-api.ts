import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

// 요금제·구독 계약 (서버 api/subscription_api.py).
//   GET  /api/plans            무인증 — 가입 화면이 로그인 전에 가격표를 그린다.
//   GET  /api/me/subscription  Bearer — 내 요금제 + 오늘 사진 인식 사용량.
//   PUT  /api/me/subscription  Bearer — 요금제 변경 (결제 미연동이라 지금은 즉시 적용된다).
// 서버 필드는 snake_case를 그대로 유지한다 (docs/CODE_STYLE.md).

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
  plan: Plan;
  vision_usage: VisionUsage;
  started_at: string;
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

// 결제 연동 전이라 서버가 검증 없이 플랜을 바꾼다. 화면은 이 사실을 사용자에게 숨기지 않는다.
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

function parseMySubscription(value: unknown): MySubscription | null {
  if (!isRecord(value)) {
    return null;
  }

  const plan = parsePlan(value.plan);
  const vision_usage = parseVisionUsage(value.vision_usage);

  if (plan === null || vision_usage === null || typeof value.started_at !== 'string') {
    return null;
  }

  return { plan, vision_usage, started_at: value.started_at };
}
