import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

export type AuthMode = 'signup' | 'login';

export type PhoneCodeResponse = {
  message: string;
  expires_at: string;
  dev_code?: string | null;
};

export type AuthUser = {
  id: number;
  phone_number: string;
  is_phone_verified: boolean;
  created_at: string;
};

export type AuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: AuthUser;
};

export const AUTH_API_URL = apiUrl('/api/auth', process.env.EXPO_PUBLIC_AUTH_API_URL);

// 인증 API에는 Authorization 헤더를 붙이지 않는다 (세션 발급 전 단계).
// 따라서 apiFetch가 아니라 순수 fetch를 쓴다.
export async function requestPhoneCode(mode: AuthMode, phoneNumber: string): Promise<PhoneCodeResponse> {
  const response = await fetch(`${AUTH_API_URL}/${mode}/request-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone_number: phoneNumber }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `인증번호 요청 실패: ${response.status}`);
  }

  const data = (await response.json()) as unknown;

  if (!isPhoneCodeResponse(data)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return data;
}

export async function verifyPhoneCode(
  mode: AuthMode,
  phoneNumber: string,
  code: string,
): Promise<AuthTokenResponse> {
  const response = await fetch(`${AUTH_API_URL}/${mode}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone_number: phoneNumber,
      code,
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `인증 실패: ${response.status}`);
  }

  const data = (await response.json()) as unknown;

  if (!isAuthTokenResponse(data)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return data;
}

// 로그아웃은 발급된 세션을 폐기하는 요청이라 예외적으로 apiFetch로 Bearer를 첨부한다.
// 서버 폐기 실패(오프라인 등)와 무관하게 로컬 세션 삭제는 호출부(clearAuthSession)가 책임진다.
export async function logout(): Promise<void> {
  const response = await apiFetch(`${AUTH_API_URL}/logout`, { method: 'POST' });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `로그아웃 실패: ${response.status}`);
  }
}

function isPhoneCodeResponse(value: unknown): value is PhoneCodeResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.message === 'string' && typeof candidate.expires_at === 'string';
}

function isAuthTokenResponse(value: unknown): value is AuthTokenResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.access_token !== 'string' ||
    typeof candidate.token_type !== 'string' ||
    typeof candidate.expires_at !== 'string' ||
    typeof candidate.user !== 'object' ||
    candidate.user === null
  ) {
    return false;
  }

  const user = candidate.user as Record<string, unknown>;

  return (
    typeof user.id === 'number' &&
    typeof user.phone_number === 'string' &&
    typeof user.is_phone_verified === 'boolean' &&
    typeof user.created_at === 'string'
  );
}
