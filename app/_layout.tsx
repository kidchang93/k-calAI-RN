import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { DISPLAY_FONT } from '@/constants/typography';
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

  const [isFontReady, fontError] = useFonts({
    [DISPLAY_FONT]: require('@/assets/fonts/Jua-Regular.ttf'),
  });

  // 글꼴은 번들 에셋이라 금방 끝난다. 실패하면 기다리지 않고 시스템 글꼴로 그린다.
  if (!isFontReady && fontError === null) {
    return null;
  }

  return (
    <ThemeProvider value={NAV_THEME}>
      {/* 브라우저 탭 제목. **`app/+html.tsx`의 <title>만으로는 안 된다** — expo-router 가
          react-helmet 으로 문서 head 를 관리해서, 아무도 title 을 주지 않으면 빈 태그로
          덮어쓴다(2026-08-18 운영에서 빈 제목 확인). Stack 의 `screenOptions.title` 도
          헤더용이라 문서 제목으로 가지 않는다.
          ⚠️ **웹에서만 그린다**(2026-10-05). 네이티브에서 무시되는 줄 알았는데, iOS 의 Head 는
          Handoff(NSUserActivity)를 켜려고 expo-router 의 `origin` 설정을 찾고 없으면 **운영 빌드에서
          alert 를 계속 띄운다**(TestFlight 빌드 4 에서 확인). Handoff 는 쓰지 않으므로 설정을 늘리지
          않고 웹으로만 좁힌다. */}
      {Platform.OS === 'web' ? (
        <Head>
          <title>케어테이블</title>
        </Head>
      ) : null}
      <Stack initialRouteName="auth">
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
