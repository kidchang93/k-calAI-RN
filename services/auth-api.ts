import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

// 카카오 로그인 (2026-07-14 휴대폰 OTP 전면 교체).
//
// 네이티브 카카오 SDK를 쓰지 않는다. 카카오는 Redirect URI에 커스텀 스킴(kcalairn://)을 등록할 수
// 없고 신규 REST 키는 client_secret이 필수라, 토큰 교환은 서버가 한다. 앱은 브라우저만 연다:
//   앱 → GET /api/auth/kakao/start → (카카오 동의) → 서버 콜백 → 딥링크로 복귀
//     성공: kcalairn://auth?code=<1회용 연동코드>&is_new=true|false
//     실패: kcalairn://auth?error=cancelled|invalid_state|expired|kakao_unavailable
// 연동 코드는 1회용이고 TTL 10분이다 (서버 auth_service.LINK_CODE_TTL_MINUTES).

export type AuthUser = {
  id: number;
  // 카카오 닉네임. 프로필 동의를 거부하면 서버가 null을 준다.
  nickname: string | null;
  created_at: string;
};

export type AuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: AuthUser;
};

export type KakaoStartResult = {
  link_code: string;
  is_new: boolean;
};

// 가입 바디 (서버 KakaoSignupRequest). 동의 2종은 필수 — 누락 시 422, false면 400이다.
// plan_code를 생략(null)하면 서버가 무료 플랜(lite)을 부여한다.
export type SignupTerms = {
  agreed_terms: boolean;
  agreed_privacy: boolean;
  plan_code?: string | null;
};

// 사용자가 카카오 동의 화면·인앱 브라우저를 닫은 경우. 오류가 아니라 정상 흐름이라
// 화면은 에러 배너 없이 조용히 원상복귀한다.
export class KakaoCancelledError extends Error {
  constructor() {
    super('카카오 로그인을 취소했습니다.');
    this.name = 'KakaoCancelledError';
  }
}

// POST /api/auth/kakao/login 이 404 — 아직 가입하지 않은 카카오 계정이다.
// 화면은 이 예외를 받으면 동의·요금제(가입) 단계로 넘긴다.
export class KakaoNotRegisteredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KakaoNotRegisteredError';
  }
}

// login·signup의 400 — 연동 코드가 만료·소비됐거나(TTL 10분) 이미 가입된 계정이다.
// 어느 쪽이든 그 코드로는 더 진행할 수 없으니 화면은 카카오 로그인부터 다시 시작시킨다.
export class KakaoLinkExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KakaoLinkExpiredError';
  }
}

export const AUTH_API_URL = apiUrl('/api/auth', process.env.EXPO_PUBLIC_AUTH_API_URL);

// 서버가 딥링크로 돌려보내는 error 코드 → 사용자 문구 (서버 api/auth_api.py의 _redirect_to_app).
const KAKAO_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: '로그인 요청이 만료되었습니다. 카카오 로그인을 다시 시도해주세요.',
  expired: '카카오 인증 정보가 만료되었습니다. 카카오 로그인을 다시 시도해주세요.',
  kakao_unavailable: '카카오 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.',
};

const KAKAO_FALLBACK_MESSAGE = '카카오 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/**
 * 서버 콜백이 웹으로 되돌려준 결과(`/auth?code=…&is_new=…`)를 쿼리에서 읽는다.
 * 네이티브에서는 항상 `null`이다 (거기선 딥링크가 `openAuthSessionAsync`로 곧장 돌아온다).
 *
 * **1회용 코드가 주소창에 남지 않도록 즉시 지운다** — 새로고침 시 이미 소비된 코드로 재시도하면
 * 400이 난다.
 *
 * 실패(`error=…`)면 `startKakaoLogin`과 같은 예외를 던진다.
 */
export function consumeKakaoWebRedirect(): KakaoStartResult | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const search = window.location.search;
  const params = new URLSearchParams(search);

  if (!params.has('code') && !params.has('error')) {
    return null;
  }

  window.history.replaceState({}, '', window.location.pathname);

  return parseKakaoRedirect(`${window.location.origin}${window.location.pathname}${search}`);
}

/**
 * 카카오 로그인 브라우저를 열고 서버가 돌려준 1회용 연동 코드를 파싱한다.
 * 취소는 `KakaoCancelledError`, 그 외 실패는 한국어 메시지의 `Error`를 던진다.
 *
 * `switchAccount`를 주면 카카오 세션이 남아 있어도 **로그인 화면을 다시 띄운다**(`prompt=login`).
 * 그러지 않으면 브라우저에 남은 카카오 세션 때문에 늘 같은 계정으로만 들어가진다 —
 * 우리 앱에서 로그아웃해도 그렇다 (카카오 계정 자체를 로그아웃시키지는 않기 때문이다.
 * 그건 카카오톡 웹 등 다른 서비스까지 튕겨서 과하다).
 */
export async function startKakaoLogin(
  options: { switchAccount?: boolean } = {},
): Promise<KakaoStartResult> {
  const platform = Platform.OS === 'web' ? 'web' : 'native';
  const startUrl =
    `${AUTH_API_URL}/kakao/start?platform=${platform}` +
    (options.switchAccount ? '&switch_account=true' : '');

  if (Platform.OS === 'web') {
    // 웹은 팝업이 아니라 **전체 페이지 이동**으로 간다.
    //
    // expo-web-browser 의 웹 팝업은 자신이 만든 `state` 를 콜백 URL 에서 되찾아야 세션을
    // 완료하는데(localStorage 대조), 우리 콜백의 `state` 는 카카오 CSRF 용이고 앱에는
    // code·is_new 만 돌려준다. 그래서 그 핸드셰이크가 성립하지 않아 **팝업이 닫히지 않고
    // 로그인 화면만 다시 뜨는 무한 루프**가 된다 (2026-07-14 실측).
    //
    // 돌아온 뒤에는 `consumeKakaoWebRedirect()` 가 쿼리에서 결과를 읽는다. 팝업 차단기에도
    // 걸리지 않는다.
    window.location.assign(startUrl);

    // 페이지가 떠나므로 이 Promise 는 resolve 되지 않는다 (호출부의 로딩 상태가 유지된다).
    return new Promise<KakaoStartResult>(() => {});
  }

  const result = await WebBrowser.openAuthSessionAsync(startUrl, kakaoRedirectUrl());

  // 'cancel'(사용자가 닫음) · 'dismiss' · 'locked' — 브라우저가 결과 URL 없이 닫힌 경우다.
  if (result.type !== 'success') {
    throw new KakaoCancelledError();
  }

  return parseKakaoRedirect(result.url);
}

export async function loginWithKakao(linkCode: string): Promise<AuthTokenResponse> {
  const response = await fetch(`${AUTH_API_URL}/kakao/login`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ link_code: linkCode }),
  });

  if (response.status === 404) {
    const message = await readErrorMessage(response);
    throw new KakaoNotRegisteredError(message || '가입되지 않은 카카오 계정입니다.');
  }

  if (response.status === 400) {
    const message = await readErrorMessage(response);
    throw new KakaoLinkExpiredError(message || '로그인 정보가 만료되었습니다.');
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `카카오 로그인 실패: ${response.status}`);
  }

  return ensureAuthTokenResponse(await response.json());
}

export async function signupWithKakao(
  linkCode: string,
  terms: SignupTerms,
): Promise<AuthTokenResponse> {
  const response = await fetch(`${AUTH_API_URL}/kakao/signup`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      link_code: linkCode,
      agreed_terms: terms.agreed_terms,
      agreed_privacy: terms.agreed_privacy,
      plan_code: terms.plan_code ?? null,
    }),
  });

  if (response.status === 400) {
    const message = await readErrorMessage(response);
    throw new KakaoLinkExpiredError(message || '로그인 정보가 만료되었습니다.');
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `회원가입 실패: ${response.status}`);
  }

  return ensureAuthTokenResponse(await response.json());
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

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

// 서버가 돌아올 목적지. 네이티브는 딥링크(app.json의 scheme = kcalairn), 웹은 같은 오리진의
// /auth 경로다 — 서버(APP_DEEPLINK_SCHEME · WEB_CALLBACK_PATH)와 문자열이 맞아야 한다.
function kakaoRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return typeof window === 'undefined' ? '/auth' : `${window.location.origin}/auth`;
  }

  return 'kcalairn://auth';
}

function parseKakaoRedirect(url: string): KakaoStartResult {
  const { queryParams } = Linking.parse(url);
  const error = readParam(queryParams, 'error');

  if (error !== null) {
    if (error === 'cancelled') {
      throw new KakaoCancelledError();
    }

    throw new Error(KAKAO_ERROR_MESSAGES[error] ?? KAKAO_FALLBACK_MESSAGE);
  }

  const code = readParam(queryParams, 'code');

  if (code === null) {
    throw new Error('카카오 로그인 응답이 올바르지 않습니다. 다시 시도해주세요.');
  }

  return { link_code: code, is_new: readParam(queryParams, 'is_new') === 'true' };
}

function readParam(
  queryParams: Record<string, string | string[] | undefined> | null | undefined,
  key: string,
): string | null {
  const value = queryParams?.[key];

  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return null;
}

function ensureAuthTokenResponse(value: unknown): AuthTokenResponse {
  const parsed = parseAuthTokenResponse(value);

  if (parsed === null) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return parsed;
}

function parseAuthTokenResponse(value: unknown): AuthTokenResponse | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.access_token !== 'string' ||
    typeof candidate.token_type !== 'string' ||
    typeof candidate.expires_at !== 'string' ||
    typeof candidate.user !== 'object' ||
    candidate.user === null
  ) {
    return null;
  }

  const user = candidate.user as Record<string, unknown>;

  if (typeof user.id !== 'number' || typeof user.created_at !== 'string') {
    return null;
  }

  return {
    access_token: candidate.access_token,
    token_type: candidate.token_type,
    expires_at: candidate.expires_at,
    user: {
      id: user.id,
      nickname: typeof user.nickname === 'string' ? user.nickname : null,
      created_at: user.created_at,
    },
  };
}
