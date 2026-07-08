import { useEffect, useState } from 'react';

import type { AuthTokenResponse } from '@/services/auth-api';

let currentSession: AuthTokenResponse | null = null;
const listeners = new Set<() => void>();

export function getAuthSession() {
  return currentSession;
}

export function setAuthSession(session: AuthTokenResponse) {
  currentSession = session;
  notify();
}

export function clearAuthSession() {
  currentSession = null;
  notify();
}

export function useAuthSession() {
  const [session, setSession] = useState(getAuthSession);

  useEffect(() => {
    const listener = () => setSession(getAuthSession());
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return session;
}

function notify() {
  listeners.forEach((listener) => listener());
}
