import { Redirect, Stack } from 'expo-router';

import { SessionLoading } from '@/components/session-loading';
import { useAuthSession } from '@/services/auth-session';

// 식이 가이드도 인증된 사용자만 진입한다 (리포트 레이아웃과 같은 선언형 가드).
// 내용 자체는 공개 정보지만 앱의 다른 화면과 같은 규약을 지킨다.
export default function GuidesLayout() {
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
