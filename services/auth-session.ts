import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { AuthTokenResponse } from '@/services/auth-api';

const STORAGE_KEY = 'auth-session';

// 네이티브는 expo-secure-store, 웹은 localStorage로 세션을 영속화한다.
// expo-secure-store는 web을 지원하지 않으므로 Platform으로 분기한다.
// (웹은 정식 지원 대상이다 — 새로고침해도 로그인이 유지되어야 한다.)
const isWeb = Platform.OS === 'web';

function getWebStorage(): Storage | null {
  // 정적 렌더링(SSR) 등 window가 없는 환경을 방어한다.
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function persistSession(session: AuthTokenResponse): Promise<void> {
  const raw = JSON.stringify(session);

  if (isWeb) {
    getWebStorage()?.setItem(STORAGE_KEY, raw);
    return;
  }

  await SecureStore.setItemAsync(STORAGE_KEY, raw);
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
    const parsed = stored ? parseSession(stored) : null;

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
  const [state, setState] = useState<AuthSessionState>(getStateSnapshot);

  useEffect(() => {
    const listener = () => setState(getStateSnapshot());
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}

function getStateSnapshot(): AuthSessionState {
  if (!hydrated) {
    return { status: 'loading' };
  }

  return currentSession
    ? { status: 'authenticated', session: currentSession }
    : { status: 'unauthenticated' };
}

function parseSession(raw: string): AuthTokenResponse | null {
  try {
    const data = JSON.parse(raw) as unknown;

    return isAuthTokenResponse(data) ? data : null;
  } catch {
    return null;
  }
}

function isAuthTokenResponse(value: unknown): value is AuthTokenResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.access_token === 'string' &&
    typeof candidate.token_type === 'string' &&
    typeof candidate.expires_at === 'string' &&
    typeof candidate.user === 'object' &&
    candidate.user !== null
  );
}

function notify() {
  listeners.forEach((listener) => listener());
}
