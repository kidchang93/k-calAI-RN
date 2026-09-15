import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { restoreAuthSession } from '@/services/auth-session';

export const unstable_settings = {
  initialRouteName: 'auth',
};

// 내비게이션 테마도 앱 팔레트(docs/DESIGN.md)를 따른다 — 기본 테마의 iOS 블루가
// 화면 전환 배경·헤더 강조색으로 새어 나오면 하드코딩 팔레트와 어긋난다.
const NAV_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2a7d76',
    background: '#f7f6f4',
    card: '#ffffff',
    text: '#22211f',
    border: '#e4e2de',
  },
};

// 인증 가드를 여기서 router.replace() 로 처리하지 않습니다.
// 루트 레이아웃의 effect 는 네비게이터가 마운트되기 전에 실행될 수 있어
// "Attempted to navigate before mounting the Root Layout component" 를 던집니다.
// 대신 각 라우트가 <Redirect> 로 선언형 가드를 겁니다.
//   - 미인증 상태로 (tabs) 진입  → app/(tabs)/_layout.tsx
//   - 인증 상태로 auth 진입      → app/auth.tsx
export default function RootLayout() {
  // 저장된 세션을 복원한다. 여기서는 네비게이션을 하지 않는다.
  // 복원이 끝나면 각 라우트의 <Redirect> 가드가 스스로 이동을 판단한다.
  useEffect(() => {
    void restoreAuthSession();
  }, []);

  return (
    <ThemeProvider value={NAV_THEME}>
      {/* 브라우저 탭 제목. **`app/+html.tsx`의 <title>만으로는 안 된다** — expo-router 가
          react-helmet 으로 문서 head 를 관리해서, 아무도 title 을 주지 않으면 빈 태그로
          덮어쓴다(2026-08-18 운영에서 빈 제목 확인). Stack 의 `screenOptions.title` 도
          헤더용이라 문서 제목으로 가지 않는다. 웹 전용이고 네이티브에서는 무시된다. */}
      <Head>
        <title>케어테이블</title>
      </Head>
      <Stack initialRouteName="auth">
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
