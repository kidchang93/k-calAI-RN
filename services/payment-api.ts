import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

// 결제 내역·영수증 계약 (서버 api/payment_api.py — 병렬 구현 중).
//   GET /api/payments        Bearer — 내 결제 내역, 최신순 { payments: PaymentItem[] }
//   GET /api/payments/{id}   Bearer — 내 결제 단건(영수증). 남의 것·없는 것은 404.
// 서버 필드는 snake_case를 그대로 유지한다 (docs/CODE_STYLE.md).
//
// status는 'ready' | 'done' | 'failed' | 'canceled'이지만, 결제 상태는 서버가 정본이라
// 요금제 code처럼 유니온으로 굳히지 않는다 — 값이 늘어도 앱을 함께 배포하지 않도록 string으로 받는다.
// amount는 Numeric 직렬화가 계약이지만 pet-api와 같은 이유로 유한수로 강제 변환해 받는다.

export type PaymentItem = {
  id: number;
  order_id: string;
  plan_code: string;
  // 표시용 요금제명 (서버가 계산해 내려준다).
  plan_label: string;
  amount: number;
  // 'ready' | 'done' | 'failed' | 'canceled' (서버 참조값, 유니온으로 굳히지 않는다).
  status: string;
  // 결제수단('카드' 등). 미승인·미연동이면 null.
  method: string | null;
  // 승인 시각(ISO). 미승인이면 null.
  approved_at: string | null;
  // 실패 사유. 실패가 아니면 null.
  fail_reason: string | null;
  created_at: string;
};

// 결제 단건 404를 일반 오류와 구분하는 명시적 오류 타입. 화면은 catch에서 instanceof로 판별해
// 에러 배너 대신 '영수증을 찾을 수 없어요' 안내를 그린다. 없는 영수증은 재시도해도 같은 결과다.
export class PaymentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentNotFoundError';
  }
}

export const PAYMENT_API_URL = apiUrl('/api/payments', process.env.EXPO_PUBLIC_PAYMENT_API_URL);

// 최신순 결제 내역. 결제가 아직 없으면 빈 배열이 온다 (화면이 빈 상태를 그린다).
export async function getPayments(): Promise<PaymentItem[]> {
  const response = await apiFetch(PAYMENT_API_URL);
  const data = await parseOk(response, '결제 내역 조회 실패');

  if (!isRecord(data) || !Array.isArray(data.payments)) {
    throw new Error('서버 응답에 payments 배열이 없습니다.');
  }

  return data.payments.map((item) => ensure(parsePayment(item)));
}

export async function getPayment(paymentId: number): Promise<PaymentItem> {
  const response = await apiFetch(`${PAYMENT_API_URL}/${paymentId}`);

  if (response.status === 404) {
    const message = await readErrorMessage(response);
    throw new PaymentNotFoundError(message || '영수증을 찾을 수 없어요.');
  }

  return ensure(parsePayment(await parseOk(response, '영수증 조회 실패')));
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

// number 또는 숫자 문자열을 유한수로 좁힌다. 그 외에는 null.
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

// nullable 문자열 필드(method·approved_at·fail_reason): null/undefined는 null로, 문자열은 그대로.
function toNullableString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' ? value : undefined;
}

function parsePayment(value: unknown): PaymentItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = toNumber(value.id);
  const amount = toNumber(value.amount);
  const method = toNullableString(value.method);
  const approved_at = toNullableString(value.approved_at);
  const fail_reason = toNullableString(value.fail_reason);

  if (
    id === null ||
    typeof value.order_id !== 'string' ||
    typeof value.plan_code !== 'string' ||
    typeof value.plan_label !== 'string' ||
    amount === null ||
    typeof value.status !== 'string' ||
    method === undefined ||
    approved_at === undefined ||
    fail_reason === undefined ||
    typeof value.created_at !== 'string'
  ) {
    return null;
  }

  return {
    id,
    order_id: value.order_id,
    plan_code: value.plan_code,
    plan_label: value.plan_label,
    amount,
    status: value.status,
    method,
    approved_at,
    fail_reason,
    created_at: value.created_at,
  };
}
