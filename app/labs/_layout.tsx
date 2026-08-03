import { Redirect, Stack } from 'expo-router';

import { SessionLoading } from '@/components/session-loading';
import { useAuthSession } from '@/services/auth-session';

// 검사 수치는 민감정보다 — 인증 가드는 리포트·가이드와 같은 선언형 패턴.
export default function LabsLayout() {
  const authState = useAuthSession();

  if (authState.status === 'loading') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SessionLoading />
      </>
    );
  }

  if (authState.status === 'unauthenticated') {
    return <Redirect href="/auth" />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
