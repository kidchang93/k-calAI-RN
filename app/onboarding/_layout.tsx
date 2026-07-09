import { Redirect, Stack } from 'expo-router';

import { SessionLoading } from '@/components/session-loading';
import { useAuthSession } from '@/services/auth-session';

// 온보딩은 인증된 사용자만 진입한다. 프로필(404) 확인은 (tabs) 레이아웃의 몫이며,
// 여기서 프로필을 다시 확인하지 않기 때문에 온보딩 ↔ 탭 사이의 리다이렉트 순환이 없다.
export default function OnboardingLayout() {
  const authState = useAuthSession();

  // 세션 복원 중에는 판단을 미룬다 (app/(tabs)/_layout.tsx와 같은 규칙).
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
      {/* 루트 Stack의 'onboarding' 엔트리 헤더를 숨긴다. 루트 레이아웃은 수정하지 않는다. */}
      <Stack.Screen options={{ headerShown: false }} />
      <Stack initialRouteName="consent" screenOptions={{ headerShown: false }} />
    </>
  );
}
