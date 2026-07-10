import { Redirect, Stack } from 'expo-router';

import { SessionLoading } from '@/components/session-loading';
import { useAuthSession } from '@/services/auth-session';

// 식단 추천은 인증된 사용자만 진입한다 (그룹·펫 레이아웃과 같은 선언형 가드 규칙).
export default function RecommendationsLayout() {
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
      {/* 루트 Stack의 'recommendations' 엔트리 헤더를 숨긴다. 루트 레이아웃은 수정하지 않는다. */}
      <Stack.Screen options={{ headerShown: false }} />
      <Stack initialRouteName="index" screenOptions={{ headerShown: false }} />
    </>
  );
}
