import { Platform } from 'react-native';

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

const DEFAULT_AUTH_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/auth' : 'http://127.0.0.1:8000/api/auth';

export const AUTH_API_URL = process.env.EXPO_PUBLIC_AUTH_API_URL ?? DEFAULT_AUTH_API_URL;

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

  return (await response.json()) as PhoneCodeResponse;
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

  return (await response.json()) as AuthTokenResponse;
}

async function readErrorMessage(response: Response) {
  const text = await response.text().catch(() => '');

  if (!text) {
    return '';
  }

  try {
    const data = JSON.parse(text) as { detail?: unknown };

    if (data.detail) {
      return String(data.detail);
    }
  } catch {
    return text;
  }

  return text;
}
