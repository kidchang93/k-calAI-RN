import { clearAuthSession, getAuthSession } from '@/services/auth-session';

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
