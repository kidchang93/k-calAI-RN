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

  if (typeof parsed !== 'object' || parsed === null) {
    return new PlanLimitError(text || fallback, { resource: '', plan: '', limit: 0 });
  }

  const data = parsed as Record<string, unknown>;

  return new PlanLimitError(typeof data.detail === 'string' ? data.detail : fallback, {
    resource: typeof data.resource === 'string' ? data.resource : '',
    plan: typeof data.plan === 'string' ? data.plan : '',
    limit: typeof data.limit === 'number' ? data.limit : 0,
  });
}
