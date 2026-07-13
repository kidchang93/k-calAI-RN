import { Redirect, Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { SessionLoading } from '@/components/session-loading';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuthSession } from '@/services/auth-session';
import { getProfile } from '@/services/health-api';

// 로그인 직후 홈(오늘) 탭으로 진입한다.
export const unstable_settings = {
  initialRouteName: 'home',
};

// 온보딩 게이트: GET /api/me/profile이 404(getProfile → null)면 온보딩 미완료다.
// 탭 레이아웃 마운트당 한 번만 확인한다 — 온보딩으로 <Redirect> 되면 이 레이아웃이 언마운트되고,
// 온보딩 완료(goal 저장) 후 /(tabs)로 돌아오면 다시 마운트되어 재확인된다.
// 온보딩 레이아웃은 프로필을 확인하지 않으므로 온보딩 ↔ 탭 사이 리다이렉트 순환이 없다.
type OnboardingCheck = 'checking' | 'needed' | 'done';

export default function TabLayout() {
  const authState = useAuthSession();
  const [onboardingCheck, setOnboardingCheck] = useState<OnboardingCheck>('checking');

  const isAuthenticated = authState.status === 'authenticated';

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isCancelled = false;

    getProfile()
      .then((profile) => {
        if (!isCancelled) {
          setOnboardingCheck(profile === null ? 'needed' : 'done');
        }
      })
      .catch(() => {
        // 확인 실패(네트워크 오류 등)로 탭 진입을 막지 않는다. 각 화면이 자체 오류를 표시한다.
        if (!isCancelled) {
          setOnboardingCheck('done');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

  // 세션 복원 중에는 판단을 미룬다. 여기서 로그인으로 튕기면 이미 로그인된 사용자가 깜빡인다.
  if (authState.status === 'loading') {
    return <SessionLoading />;
  }

  // 미인증 상태로 탭에 직접 진입하면 인증 화면으로 되돌립니다.
  if (authState.status === 'unauthenticated') {
    return <Redirect href="/auth" />;
  }

  // 프로필 확인이 끝날 때까지 탭을 그리지 않는다 (온보딩 대상자에게 홈이 깜빡이는 것을 방지).
  if (onboardingCheck === 'checking') {
    return <SessionLoading />;
  }

  if (onboardingCheck === 'needed') {
    return <Redirect href="/onboarding/consent" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3182f6',
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: '기록',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="camera.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: '리포트',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.line.uptrend.xyaxis" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: '내 정보',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
