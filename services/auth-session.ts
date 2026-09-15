import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import type { AuthTokenResponse } from '@/services/auth-api';

const STORAGE_KEY = 'auth-session';

// 네이티브는 expo-secure-store, 웹은 localStorage로 세션을 영속화한다.
// expo-secure-store는 web을 지원하지 않으므로 Platform으로 분기한다.
// (웹은 정식 지원 대상이다 — 새로고침해도 로그인이 유지되어야 한다.)
const isWeb = Platform.OS === 'web';

// 웹 localStorage. 네이티브·정적 렌더링(SSR)처럼 window가 없는 환경은 null.
// group-invite.ts·yesterday-summary.ts도 이걸 쓴다 (이 파일은 services를 import하지 않아 순환이 없다).
export function getWebStorage(): Storage | null {
  if (!isWeb || typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// 세션 토큰은 **그 자체가 로그인 자격증명**이다 — 서버는 sha256 해시만 갖고 있어(auth_sessions)
// 어느 기기가 쓰는지 구분하지 못한다. expo-secure-store 의 기본값(WHEN_UNLOCKED)은 백업을
// 복원할 때 **새 기기로 옮겨지므로**, 기기를 바꾸거나 백업을 다른 기기에 풀면 그 기기가 그대로
// 로그인 상태가 된다. `_THIS_DEVICE_ONLY` 계열만 "not migrated to a new device when restoring
// from a backup" 이다(Expo 문서). 기기 이전 시 재로그인을 요구하는 편이 맞다.
const KEYCHAIN_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function persistSession(session: AuthTokenResponse): Promise<void> {
  const raw = JSON.stringify(session);

  if (isWeb) {
    getWebStorage()?.setItem(STORAGE_KEY, raw);
    return;
  }

  try {
    await SecureStore.setItemAsync(STORAGE_KEY, raw, KEYCHAIN_OPTIONS);
  } catch {
    // 기존 로그인 사용자의 키체인 항목은 예전 속성(WHEN_UNLOCKED)으로 남아 있다. 속성이 다른
    // 항목의 갱신이 거부될 수 있어, 지우고 새로 쓴다 — 여기서 실패하면 세션이 저장되지 않아
    // **앱을 껐다 켤 때마다 로그아웃**되므로 조용히 넘기지 않는다.
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    await SecureStore.setItemAsync(STORAGE_KEY, raw, KEYCHAIN_OPTIONS);
  }
}

async function removePersistedSession(): Promise<void> {
  if (isWeb) {
    getWebStorage()?.removeItem(STORAGE_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(STORAGE_KEY);
}

async function readPersistedSession(): Promise<string | null> {
  if (isWeb) {
    return getWebStorage()?.getItem(STORAGE_KEY) ?? null;
  }

  return SecureStore.getItemAsync(STORAGE_KEY);
}

export type AuthSessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; session: AuthTokenResponse }
  | { status: 'unauthenticated' };

let currentSession: AuthTokenResponse | null = null;
let hydrated = false;
// useSyncExternalStore는 매 렌더 같은 참조를 받아야 하므로 notify 시점에만 새로 만든다.
let snapshot: AuthSessionState = { status: 'loading' };
const listeners = new Set<() => void>();

export function getAuthSession() {
  return currentSession;
}

export function setAuthSession(session: AuthTokenResponse) {
  currentSession = session;
  notify();

  void persistSession(session).catch(() => undefined);
}

export function clearAuthSession() {
  currentSession = null;
  notify();

  void removePersistedSession().catch(() => undefined);
}

// 앱 시작 시 한 번 호출한다. 저장된 세션을 복원하고 hydrated 플래그를 올린다.
// 이 함수는 네비게이션을 하지 않는다. hydrated가 바뀌면 각 라우트의 <Redirect> 가드가
// 스스로 판단한다 (루트 레이아웃에서 router.replace()를 부르지 않기 위함).
export async function restoreAuthSession() {
  if (hydrated) {
    return;
  }

  try {
    const stored = await readPersistedSession();
    const parsed = readDevSession() ?? (stored ? parseSession(stored) : null);

    if (parsed) {
      currentSession = parsed;
    }
  } catch {
    // 저장소 접근 실패 시 세션 없이 진행한다.
  }

  hydrated = true;
  notify();
}

export function useAuthSession(): AuthSessionState {
  // 세 번째 인자(서버 스냅샷)는 웹 정적 렌더링(app.json web.output = static)에서 필수다.
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthSessionState {
  return snapshot;
}

function computeSnapshot(): AuthSessionState {
  if (!hydrated) {
    return { status: 'loading' };
  }

  return currentSession
    ? { status: 'authenticated', session: currentSession }
    : { status: 'unauthenticated' };
}

// 로컬 개발은 카카오 로그인 대신 dev.sh 가 넣어 주는 개발 세션으로 시작한다 — 카카오 앱의 허용 IP
// 제한 때문에 로컬에서는 로그인이 통과하지 못한다(서버 CLAUDE.md 알려진 문제 12). 저장된 세션보다
// 우선하는 이유는 예전에 붙여넣은 만료 세션이 남아 있으면 기동하자마자 401 로 로그아웃되기 때문이다.
// 토큰은 로컬 DB·로컬 pepper 에서만 유효하고, __DEV__ 가드로 프로덕션 번들에서는 제거된다.
function readDevSession(): AuthTokenResponse | null {
  if (!__DEV__) {
    return null;
  }

  const raw = process.env.EXPO_PUBLIC_DEV_AUTH_SESSION;

  return raw ? parseSession(raw) : null;
}

function parseSession(raw: string): AuthTokenResponse | null {
  try {
    return parseAuthTokenResponse(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

// 로그인·가입 응답(auth-api.ts)과 저장·개발 세션 복원이 같은 검증을 쓴다. http.ts의 isRecord를 쓰지 않는
// 이유: http.ts가 이 파일을 import하므로 되돌려 import하면 순환이 된다.
export function parseAuthTokenResponse(value: unknown): AuthTokenResponse | null {
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

function notify() {
  snapshot = computeSnapshot();
  listeners.forEach((listener) => listener());
}
