import { Redirect, Stack } from 'expo-router';

import { SessionLoading } from '@/components/session-loading';
import { useAuthSession } from '@/services/auth-session';

// 결제 결과 화면은 인증된 사용자만 진입한다 (payments 레이아웃과 같은 선언형 가드 규칙).
//
// 이 가드는 success 화면에 특히 중요하다. 결제창은 브라우저를 통째로 되돌리므로 앱이 새로
// 시작되는데, 세션 복원(localStorage) 전에 화면이 마운트되면 confirm이 Bearer 없이 나가 401이
// 된다. loading 동안 Stack 자체를 그리지 않아 자식이 마운트되지 않게 막는다.
export default function BillingLayout() {
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
      {/* 루트 Stack의 'billing' 엔트리 헤더를 숨긴다. 루트 레이아웃은 수정하지 않는다. */}
      <Stack.Screen options={{ headerShown: false }} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
