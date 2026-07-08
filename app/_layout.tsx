import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: 'auth',
};

// 인증 가드를 여기서 router.replace() 로 처리하지 않습니다.
// 루트 레이아웃의 effect 는 네비게이터가 마운트되기 전에 실행될 수 있어
// "Attempted to navigate before mounting the Root Layout component" 를 던집니다.
// 대신 각 라우트가 <Redirect> 로 선언형 가드를 겁니다.
//   - 미인증 상태로 (tabs) 진입  → app/(tabs)/_layout.tsx
//   - 인증 상태로 auth 진입      → app/auth.tsx
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="auth">
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
