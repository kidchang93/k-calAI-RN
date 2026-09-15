import { Redirect, Stack } from 'expo-router';

import { SessionLoading } from '@/components/session-loading';
import { useAuthSession } from '@/services/auth-session';

// 탭 밖 스택 _layout.tsx 의 인증 가드. 세션 복원 중에는 판단을 미루고 Stack 자체를 그리지 않는다 —
// 자식이 복원 전에 마운트되면 Bearer 없이 요청이 나간다(billing/success 의 confirm 이 401).
// Stack.Screen 은 루트 Stack 에서 이 엔트리의 헤더를 숨긴다(루트 레이아웃은 건드리지 않는다).
export function AuthGuardStack({ initialRouteName }: { initialRouteName?: string }) {
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
      <Stack initialRouteName={initialRouteName} screenOptions={{ headerShown: false }} />
    </>
  );
}
