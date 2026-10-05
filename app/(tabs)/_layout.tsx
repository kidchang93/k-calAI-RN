import { Redirect, Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { SessionLoading } from '@/components/session-loading';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DISPLAY_FONT } from '@/constants/typography';
import { useAuthSession } from '@/services/auth-session';
import { getProfile } from '@/services/health-api';

// 로그인 직후 식단 탭으로 진입한다.
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
  // 탭바를 기본(49)보다 키운다 — 둥근 글꼴 라벨과 아이콘을 엄지 크기로 그리려면 높이가 모자란다.
  // 높이를 직접 주면 라이브러리가 하단 안전 영역을 더해 주지 않으므로 여기서 더한다.
  const insets = useSafeAreaInsets();

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
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarInactiveTintColor: '#5c5b57',
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: [styles.tabBar, { height: 70 + insets.bottom, paddingBottom: 8 + insets.bottom }],
      }}>
      {/* 2026-10-05 화면 재구성: 탭은 **할 일이 있는 곳 셋**만 — 식단 관리 · 케어 · 진료(병원 연계).
          탭마다 색이 하나다(식단 주황 · 케어 청록 · 진료 파랑). 예전 홈은 카드 9장이 같은 무게로
          쌓여 핀테크 앱처럼 읽혔다. 기록·내 정보·`/`는 지우지 않고 탭바에서만 숨긴다(KCAL-14).
          라우트 이름은 그대로다: URL 이 바뀌면 저장해 둔 링크가 깨진다. */}
      <Tabs.Screen
        name="home"
        options={{
          title: '식단',
          tabBarActiveBackgroundColor: '#ffebdd',
          tabBarActiveTintColor: '#8f3b0e',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="fork.knife" color={color} />,
        }}
      />
      {/* '리포트' → '진료'(2026-08-19) → '돌아보기'(2026-09-16, KCAL-44) → **'케어'**(2026-10-05).
          진료 준비 묶음이 진료 탭으로 독립하면서, 남은 것(도장판·질환 영양 추이·질환 도감·몸 기록)은
          '내 몸을 돌보는 곳'이 됐다. */}
      <Tabs.Screen
        name="trends"
        options={{
          title: '케어',
          tabBarActiveBackgroundColor: '#bee2dd',
          tabBarActiveTintColor: '#1c5a55',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="heart.fill" color={color} />,
        }}
      />
      {/* 병원 연계 = **진료 준비**다. 예약·중개가 아니라 받아 온 것을 이어받는다(의료법 제27조
          제3항 — 서버 `docs/CARE_LOOP.md` §3). 그래서 아이콘도 십자가 아니라 가방이다. */}
      <Tabs.Screen
        name="visit"
        options={{
          title: '진료',
          tabBarActiveBackgroundColor: '#e3ebfb',
          tabBarActiveTintColor: '#1e4290',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="briefcase.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="record" options={{ href: null }} />
      <Tabs.Screen name="account" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopColor: '#e4e2de',
    borderTopWidth: 2,
    paddingTop: 8,
  },
  tabItem: {
    borderRadius: 16,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  tabLabel: {
    fontFamily: DISPLAY_FONT,
    fontSize: 15,
  },
});
