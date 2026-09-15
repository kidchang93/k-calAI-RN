import { clearAuthSession, getAuthSession } from '@/services/auth-session';

// 402 = 요금제 한도 초과. 서버(main.py)의 전역 핸들러가 어느 라우트에서 나든 같은 본문을 준다:
//   { detail, code: 'plan_limit_exceeded', resource, plan, limit }
// resource는 'vision_daily' | 'owned_groups' | 'group_members' | 'pets' 중 하나지만, 요금제·자원은
// 서버 참조 테이블(plans)이 정본이라 유니온으로 굳히지 않는다 — 새 한도가 늘 때 앱을 함께
// 배포해야 하는 결합을 만들지 않기 위해서다 (서버 subscription_schema.py의 같은 판단).
export class PlanLimitError extends Error {
  readonly resource: string;
  readonly plan: string;
  readonly limit: number;

  constructor(message: string, detail: { resource: string; plan: string; limit: number }) {
    super(message);
    this.name = 'PlanLimitError';
    this.resource = detail.resource;
    this.plan = detail.plan;
    this.limit = detail.limit;
  }
}

// 세션이 있으면 Authorization 헤더를 붙여 요청한다.
// 인증 API(request-code, verify)는 세션이 없으므로 이 래퍼로도 헤더가 붙지 않지만,
// 발급 흐름 자체는 auth-api.ts가 순수 fetch로 처리한다.
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const session = getAuthSession();
  const headers = new Headers(init?.headers);

  if (session) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const response = await fetch(input, { ...init, headers });

  // 토큰 만료·폐기 시 세션을 비운다. 세션이 null이 되면 <Redirect> 가드가 로그인으로 보낸다.
  if (response.status === 401) {
    clearAuthSession();
  }

  // 402는 여기서 한 번만 예외로 바꾼다. 각 API 클라이언트가 개별 처리하면 업그레이드 유도가
  // 화면마다 어긋난다 — 호출부는 catch에서 instanceof PlanLimitError로만 분기하면 된다.
  if (response.status === 402) {
    throw await toPlanLimitError(response);
  }

  return response;
}

export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

const FORMAT_ERROR = '서버 응답 형식이 올바르지 않습니다.';

type StatusErrors = Partial<Record<number, new (message: string) => Error>>;

// 실패 응답이면 던진다(본문은 읽지 않는다 — DELETE 등 성공 본문이 없는 호출용). 서버 detail은
// 사용자용 한국어라 그대로 쓰고, 비었을 때만 `${fallback}: ${status}`다. statusErrors에는 호출부가
// instanceof로 가르는 상태코드별 오류 클래스를 넘긴다 — 예: `{ 403: ConsentRequiredError }`.
export async function ensureOk(
  response: Response,
  fallback: string,
  statusErrors: StatusErrors = {}
): Promise<void> {
  if (!response.ok) {
    const message = (await readErrorMessage(response)) || `${fallback}: ${response.status}`;
    const ErrorClass = statusErrors[response.status] ?? Error;

    throw new ErrorClass(message);
  }
}

// ensureOk + 본문 JSON. 204면 null.
export async function readOk(
  response: Response,
  fallback: string,
  statusErrors: StatusErrors = {}
): Promise<unknown> {
  await ensureOk(response, fallback, statusErrors);

  return response.status === 204 ? null : ((await response.json()) as unknown);
}

// 검증에 실패한 응답은 화면 크래시 대신 한국어 오류로 던진다.
export function ensure<T>(parsed: T | null): T {
  if (parsed === null) {
    throw new Error(FORMAT_ERROR);
  }

  return parsed;
}

export function ensureList<T>(value: unknown, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) {
    throw new Error(FORMAT_ERROR);
  }

  return value.map((item) => ensure(parse(item)));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// number 또는 숫자 문자열을 유한수로 좁힌다. 그 외에는 null.
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

// 서버가 아는 enum 값이면 그대로, 그 외·누락은 null.
export function oneOf<T>(values: readonly T[], value: unknown): T | null {
  return (values as readonly unknown[]).includes(value) ? (value as T) : null;
}

export async function readErrorMessage(response: Response) {
  const text = await response.text().catch(() => '');

  if (!text) {
    return '';
  }

  try {
    const data = JSON.parse(text) as { detail?: unknown };

    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item) => {
          if (typeof item === 'object' && item !== null && 'msg' in item) {
            return String(item.msg);
          }

          return String(item);
        })
        .join('\n');
    }

    if (data.detail) {
      return String(data.detail);
    }
  } catch {
    return text;
  }

  return text;
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

// 402 본문을 PlanLimitError로 좁힌다. 본문이 계약과 어긋나도(구버전 서버·프록시 오류 페이지)
// 사용자를 막다른 길에 두지 않도록 같은 예외로 던진다 — 화면은 요금제 안내를 띄우면 된다.
async function toPlanLimitError(response: Response): Promise<PlanLimitError> {
  const text = await response.text().catch(() => '');
  const fallback = '요금제 한도를 초과했습니다. 요금제를 확인해주세요.';

  let parsed: unknown = null;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    parsed = null;
  }

  if (!isRecord(parsed)) {
    return new PlanLimitError(text || fallback, { resource: '', plan: '', limit: 0 });
  }

  return new PlanLimitError(typeof parsed.detail === 'string' ? parsed.detail : fallback, {
    resource: typeof parsed.resource === 'string' ? parsed.resource : '',
    plan: typeof parsed.plan === 'string' ? parsed.plan : '',
    limit: typeof parsed.limit === 'number' ? parsed.limit : 0,
  });
}
