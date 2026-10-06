import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { PRIVACY_POLICY, TERMS } from '@/constants/legal';
import { apiUrl } from '@/services/api-base';
import { parseAuthTokenResponse } from '@/services/auth-session';
import { apiFetch, ensure, ensureOk, isRecord, JSON_HEADERS, readOk } from '@/services/http';

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
  name = 'KakaoCancelledError';
  message = '카카오 로그인을 취소했습니다.';
}

// POST /api/auth/kakao/login 이 404 — 아직 가입하지 않은 카카오 계정이다.
// 화면은 이 예외를 받으면 동의·요금제(가입) 단계로 넘긴다.
export class KakaoNotRegisteredError extends Error {
  name = 'KakaoNotRegisteredError';
}

// login·signup의 400 — 연동 코드가 만료·소비됐거나(TTL 10분) 이미 가입된 계정이다.
// 어느 쪽이든 그 코드로는 더 진행할 수 없으니 화면은 카카오 로그인부터 다시 시작시킨다.
export class KakaoLinkExpiredError extends Error {
  name = 'KakaoLinkExpiredError';
}

// Sign in with Apple (iOS 전용 — 심사 4.8: 카카오만 있으면 리젝). Apple 이 준 identity_token 을
// 서버가 검증한다. 가입 때만 authorization_code 도 보낸다(탈퇴 시 서버가 Apple 토큰을 철회할 때 쓴다).
// authorization_code 는 5분, identity_token 은 10분짜리다.
export type AppleCredential = {
  identity_token: string;
  authorization_code: string;
  // 이름은 Apple 이 **최초 인증 때만** 준다. 거부했거나 두 번째부터는 null 이다.
  nickname: string | null;
};

// Apple 시트를 닫았다(ERR_REQUEST_CANCELED). KakaoCancelledError 와 같이 오류가 아니다.
export class AppleCancelledError extends Error {
  name = 'AppleCancelledError';
  message = 'Apple 로그인을 취소했습니다.';
}

// POST /api/auth/apple/login 이 404 — 아직 가입하지 않은 Apple 계정이다. 화면은 동의 단계로 넘긴다.
export class AppleNotRegisteredError extends Error {
  name = 'AppleNotRegisteredError';
}

// identity_token·authorization_code 가 만료·무효다. 화면은 Apple 시트를 다시 띄워 새 값을 받는다.
export class AppleLoginExpiredError extends Error {
  name = 'AppleLoginExpiredError';
}

const AUTH_API_URL = apiUrl('/api/auth');

// apple/signup 의 400 은 동의·버전 문제와 토큰 만료가 같은 상태코드라 서버 문구로 가른다.
// 문구가 바뀌면 만료도 일반 오류로 떨어진다(재시도 없이 메시지만 보인다) — 서버와 함께 고친다.
const APPLE_EXPIRED_DETAIL = 'Apple 로그인 정보가 만료되었습니다. 다시 시도해주세요.';
const APPLE_FALLBACK_MESSAGE = 'Apple 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.';
const HANGUL_ONLY = /^[가-힣]+$/;

// 서버가 딥링크로 돌려보내는 error 코드 → 사용자 문구 (서버 api/auth_api.py의 _redirect_to_app).
const KAKAO_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: '로그인 요청이 만료되었습니다. 카카오 로그인을 다시 시도해주세요.',
  expired: '카카오 인증 정보가 만료되었습니다. 카카오 로그인을 다시 시도해주세요.',
  kakao_unavailable: '카카오 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.',
};

const KAKAO_FALLBACK_MESSAGE = '카카오 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.';

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

  const data = await readOk(response, '카카오 로그인 실패', {
    404: KakaoNotRegisteredError,
    400: KakaoLinkExpiredError,
  });

  return ensure(parseAuthTokenResponse(data));
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
      // **이 앱이 화면에 그린 문서**의 버전을 보낸다. 서버가 현재 버전과 대조해 다르면 400 이다
      // (약관이 개정됐는데 이 앱이 옛 문서를 띄우고 있다는 뜻 → 업데이트 안내가 내려온다).
      //
      // 상수를 호출부에서 받지 않고 여기서 legal.ts 를 직접 읽는 이유: 사용자가 보는 문서와
      // 보내는 버전이 같은 원본에서 나와야 갈리지 않는다. 화면이 값을 조립하면 실수 여지가 생긴다.
      terms_version: TERMS.version,
      privacy_version: PRIVACY_POLICY.version,
      plan_code: terms.plan_code ?? null,
    }),
  });

  const data = await readOk(response, '회원가입 실패', { 400: KakaoLinkExpiredError });

  return ensure(parseAuthTokenResponse(data));
}

// iOS 에서만 true 다. 웹은 별도 설정(Services ID)이 필요해 범위 밖이고, 안드로이드는 심사 대상이 아니다.
export async function isAppleLoginAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
}

// Apple 시트를 띄운다. 이메일은 요청하지 않는다 — 서버도 받지 않는다(최소 수집).
export async function startAppleLogin(): Promise<AppleCredential> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;

  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
      throw new AppleCancelledError();
    }

    throw new Error(APPLE_FALLBACK_MESSAGE);
  }

  // signInAsync 는 두 값이 없으면 던지지만 타입은 nullable 이다.
  if (credential.identityToken === null || credential.authorizationCode === null) {
    throw new Error(APPLE_FALLBACK_MESSAGE);
  }

  return {
    identity_token: credential.identityToken,
    authorization_code: credential.authorizationCode,
    nickname: toNickname(credential.fullName),
  };
}

export async function loginWithApple(identityToken: string): Promise<AuthTokenResponse> {
  const response = await fetch(`${AUTH_API_URL}/apple/login`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ identity_token: identityToken }),
  });

  const data = await readOk(response, 'Apple 로그인 실패', {
    404: AppleNotRegisteredError,
    400: AppleLoginExpiredError,
  });

  return ensure(parseAuthTokenResponse(data));
}

// 카카오 가입과 같은 약관 버전을 보낸다(signupWithKakao 주석 참고). plan_code 는 보내지 않는다 → lite.
export async function signupWithApple(
  credential: AppleCredential,
  terms: Omit<SignupTerms, 'plan_code'>,
): Promise<AuthTokenResponse> {
  const response = await fetch(`${AUTH_API_URL}/apple/signup`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      identity_token: credential.identity_token,
      authorization_code: credential.authorization_code,
      nickname: credential.nickname,
      agreed_terms: terms.agreed_terms,
      agreed_privacy: terms.agreed_privacy,
      terms_version: TERMS.version,
      privacy_version: PRIVACY_POLICY.version,
    }),
  });

  let data: unknown;

  try {
    data = await readOk(response, '회원가입 실패');
  } catch (error) {
    if (response.status === 400 && error instanceof Error && error.message === APPLE_EXPIRED_DETAIL) {
      throw new AppleLoginExpiredError(error.message);
    }

    throw error;
  }

  return ensure(parseAuthTokenResponse(data));
}

// 이메일 가입·로그인·비밀번호 재설정 (2026-10-06, 카카오·Apple 옆 세 번째 수단). 세션 발급 전이라
// 카카오·Apple 처럼 순수 fetch 다. 실패 본문은 전부 한국어 detail 이라(429 재요청 제한·503 메일 발송
// 불가 포함) readOk 가 던지는 문구를 화면이 그대로 보여준다. 코드 요청은 가입 여부와 무관하게 같은
// 문구가 온다 — 서버가 가입 여부를 숨긴다.
export type EmailSignupInput = {
  email: string;
  code: string;
  password: string;
  nickname: string;
};

export async function requestEmailSignupCode(email: string): Promise<string> {
  return toMessage(await postAuth('/email/signup/code', { email }, '인증 메일 발송 실패'));
}

// 코드가 맞는지만 본다(소비하지 않는다). 같은 코드를 signupWithEmail 에 다시 보낸다.
export async function verifyEmailSignupCode(email: string, code: string): Promise<string> {
  return toMessage(await postAuth('/email/signup/verify', { email, code }, '인증 코드 확인 실패'));
}

// 닉네임 중복확인. 서버가 **확인된 가입 코드**를 함께 요구한다 — 아무나 닉네임 주인의 가입 여부를 묻지
// 못하게 하려고다. '이미 쓰는 닉네임'은 코드 시도 횟수를 하나 쓴다(코드당 5번).
export async function checkEmailNickname(email: string, code: string, nickname: string): Promise<string> {
  return toMessage(
    await postAuth('/email/signup/nickname', { email, code, nickname }, '닉네임 확인 실패'),
  );
}

// 약관 버전은 signupWithKakao 와 같은 이유로 여기서 legal.ts 를 읽는다. plan_code 는 보내지 않는다 → lite.
export async function signupWithEmail(
  input: EmailSignupInput,
  terms: Omit<SignupTerms, 'plan_code'>,
): Promise<AuthTokenResponse> {
  const data = await postAuth(
    '/email/signup',
    {
      email: input.email,
      code: input.code,
      password: input.password,
      nickname: input.nickname,
      agreed_terms: terms.agreed_terms,
      agreed_privacy: terms.agreed_privacy,
      terms_version: TERMS.version,
      privacy_version: PRIVACY_POLICY.version,
    },
    '회원가입 실패',
  );

  return ensure(parseAuthTokenResponse(data));
}

// 없는 이메일·틀린 비밀번호·잠김이 모두 같은 400 문구다(서버가 가입 여부를 숨긴다).
export async function loginWithEmail(email: string, password: string): Promise<AuthTokenResponse> {
  return ensure(parseAuthTokenResponse(await postAuth('/email/login', { email, password }, '로그인 실패')));
}

export async function requestPasswordResetCode(email: string): Promise<string> {
  return toMessage(await postAuth('/email/password-reset/code', { email }, '인증 메일 발송 실패'));
}

// 성공하면 서버가 그 계정의 모든 세션을 끊는다 — 새 비밀번호로 다시 로그인해야 한다.
export async function resetPassword(email: string, code: string, newPassword: string): Promise<string> {
  return toMessage(
    await postAuth(
      '/email/password-reset',
      { email, code, new_password: newPassword },
      '비밀번호 변경 실패',
    ),
  );
}

// 로그아웃은 발급된 세션을 폐기하는 요청이라 예외적으로 apiFetch로 Bearer를 첨부한다.
// 서버 폐기 실패(오프라인 등)와 무관하게 로컬 세션 삭제는 호출부(clearAuthSession)가 책임진다.
export async function logout(): Promise<void> {
  const response = await apiFetch(`${AUTH_API_URL}/logout`, { method: 'POST' });

  await ensureOk(response, '로그아웃 실패');
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

// 이메일 인증 API 공통 — 무인증 POST + readOk. 비밀번호가 바디에 실리므로 로그를 남기지 않는다.
async function postAuth(
  path: string,
  body: Record<string, string | boolean>,
  fallback: string,
): Promise<unknown> {
  const response = await fetch(`${AUTH_API_URL}${path}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });

  return readOk(response, fallback);
}

// { message } 응답 → 화면에 그대로 보여줄 문구.
function toMessage(data: unknown): string {
  return ensure(isRecord(data) && typeof data.message === 'string' ? data.message : null);
}

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

// 성+이름(한국어 순서). 둘 다 한글이면 붙여 쓰고('홍길동'), 아니면 한 칸 띄운다. 비면 null.
function toNickname(fullName: AppleAuthentication.AppleAuthenticationFullName | null): string | null {
  const parts = [fullName?.familyName, fullName?.givenName]
    .map((part) => (part ?? '').replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return null;
  }

  return parts.join(parts.every((part) => HANGUL_ONLY.test(part)) ? '' : ' ');
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
