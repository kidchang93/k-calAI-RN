import { Redirect, Stack } from 'expo-router';

import { SessionLoading } from '@/components/session-loading';
import { useAuthSession } from '@/services/auth-session';

// 내 정보 하위(프로필·목표·체중·질병·알러지) 화면은 인증된 사용자만 진입한다
// (펫 레이아웃과 같은 선언형 가드).
export default function MeLayout() {
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
      {/* 루트 Stack의 'me' 엔트리 헤더를 숨긴다. 루트 레이아웃은 수정하지 않는다. */}
      <Stack.Screen options={{ headerShown: false }} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
