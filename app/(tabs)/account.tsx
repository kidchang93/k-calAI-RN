import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { ACTIVITY_OPTIONS } from '@/components/profile-form';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { logout } from '@/services/auth-api';
import { clearAuthSession } from '@/services/auth-session';
import { confirmDialog, notifyDialog } from '@/services/dialog';
import {
  ActivityLevel,
  deleteAccount,
  getGoal,
  getProfile,
  GoalResponse,
  GoalType,
  ProfileResponse,
} from '@/services/health-api';

// 라벨의 정본은 입력 폼이다 — 고르는 화면과 보이는 화면이 다른 말을 쓰면 안 된다.
const ACTIVITY_LABELS = Object.fromEntries(
  ACTIVITY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ActivityLevel, string>;

const GOAL_LABELS: Record<GoalType, string> = {
  loss: '체중 감량',
  maintain: '유지',
  gain: '증량',
};

// 2026-09-16(KCAL-41·43·45) 정리. **지우지 않고 숨긴다** — 화면·라우트·서버 API는 그대로 두고
// 이 목록에서만 뺀다(원칙: KCAL-14).
// - 요금제·결제 내역(`/plan`·`/payments`): 1차 출시는 무료라 팔 것이 없다. 유료 전환 때 되살린다.
// - 질병 정보(`/me/conditions`): 온보딩의 '어떤 게 궁금하세요?'가 같은 값을 받게 되면 그쪽이
//   정본이 된다(KCAL-31). 그 화면이 나오기 전까지는 질병을 고칠 곳이 사라지므로 ⚠️ 함께 배포한다.
const MENU_ROWS: { href: Href; icon: keyof typeof MaterialIcons.glyphMap; label: string }[] = [
  { href: '/me/allergies', icon: 'no-food', label: '알러지' },
  // 온보딩이 "내 정보에서 언제든 철회할 수 있어요"라고 약속한 진입점이다
  // (app/onboarding/consent.tsx). 이 행이 없으면 그 고지가 거짓이 된다.
  { href: '/me/consents', icon: 'fact-check', label: '동의 관리' },
  { href: '/updates', icon: 'campaign', label: '업데이트 이력' },
];

export default function AccountScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [goal, setGoal] = useState<GoalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [profileResult, goalResult] = await Promise.all([getProfile(), getGoal()]);

      setProfile(profileResult);
      setGoal(goalResult);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 프로필·목표 수정 화면에서 돌아왔을 때 갱신되도록 포커스마다 다시 읽는다 (홈 화면 패턴).
  useFocusEffect(
    useCallback(() => {
      void loadAccount();
    }, [loadAccount])
  );

  const confirmLogout = async () => {
    const confirmed = await confirmDialog({
      title: '로그아웃',
      message: '이 기기에서 로그아웃할까요?',
      confirmLabel: '로그아웃',
      destructive: true,
    });

    if (confirmed) {
      await handleLogout();
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      // 서버 세션 폐기. 실패(오프라인 등)해도 아래에서 로컬 세션은 지운다.
      await logout();
    } catch {
      // 오프라인 로그아웃 허용 — 서버 폐기 실패를 사용자에게 오류로 노출하지 않는다.
    } finally {
      clearAuthSession();
      setIsLoggingOut(false);
    }
  };

  // 회원 탈퇴는 물리 삭제(DATA_MODEL.md 18장)라 2단계로 확인한다.
  const confirmDeleteAccount = async () => {
    const proceed = await confirmDialog({
      title: '회원 탈퇴',
      message: '정말 탈퇴하시겠어요?',
      confirmLabel: '계속',
      destructive: true,
    });

    if (!proceed) {
      return;
    }

    const confirmed = await confirmDialog({
      title: '마지막 확인',
      message: '모든 끼니·체중·검사 수치 기록과 소유한 그룹이 영구 삭제됩니다. 되돌릴 수 없습니다.',
      confirmLabel: '영구 삭제',
      destructive: true,
    });

    if (confirmed) {
      await handleDeleteAccount();
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);

    try {
      await deleteAccount();
      // 성공 시에만 세션을 지운다 — <Redirect> 가드가 로그인 화면으로 보낸다.
      clearAuthSession();
    } catch (error) {
      // 실패 시 세션은 유지한다 (로그아웃과 달리 서버 파기가 확인돼야 한다).
      notifyDialog(
        '회원 탈퇴 실패',
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>내 정보</Text>
        <Text style={styles.subtitle}>내 식습관을 관리해요</Text>
      </View>

      {errorMessage ? (
        <ErrorBanner message={errorMessage} onRetry={() => void loadAccount()} />
      ) : null}

      {isLoading ? (
        <LoadingState label="내 정보를 불러오는 중입니다." />
      ) : (
        <View style={styles.section}>
          <Pressable
            onPress={() => router.push('/me/profile')}
            style={({ pressed }) => [styles.summaryCard, pressed && styles.pressed]}>
            <View style={styles.summaryIconWrap}>
              <MaterialIcons color="#2a7d76" name="person-outline" size={22} />
            </View>
            <View style={styles.summaryBody}>
              <Text style={styles.summaryLabel}>프로필</Text>
              <Text style={styles.summaryValue}>
                {profile === null ? '아직 입력하지 않았어요' : buildProfileSummary(profile)}
              </Text>
            </View>
            <MaterialIcons color="#a9a6a1" name="chevron-right" size={20} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/me/goal')}
            style={({ pressed }) => [styles.summaryCard, pressed && styles.pressed]}>
            <View style={styles.summaryIconWrap}>
              <MaterialIcons color="#2a7d76" name="flag" size={22} />
            </View>
            <View style={styles.summaryBody}>
              <Text style={styles.summaryLabel}>내 식탁의 기준</Text>
              <Text style={styles.summaryValue}>
                {goal === null
                  ? '목표를 설정해주세요'
                  : `${GOAL_LABELS[goal.goal_type]} · 하루 ${goal.target_kcal.toLocaleString()} kcal`}
              </Text>
            </View>
            <MaterialIcons color="#a9a6a1" name="chevron-right" size={20} />
          </Pressable>
        </View>
      )}

      {/* 체성분·권장 활동량과 주간 조언은 2026-08-19 에 **진료 탭으로 옮겼다.**
          내 정보는 계정·설정을 보는 곳인데 판단 자료가 섞여 있었다 (docs/DESIGN.md). */}

      <View style={styles.section}>
        {MENU_ROWS.map((menuRow) => (
          <Pressable
            key={menuRow.label}
            onPress={() => router.push(menuRow.href)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <MaterialIcons color="#5c5b57" name={menuRow.icon} size={20} />
            <Text style={styles.rowLabel}>{menuRow.label}</Text>
            <MaterialIcons color="#a9a6a1" name="chevron-right" size={20} />
          </Pressable>
        ))}

        <Pressable
          disabled={isLoggingOut || isDeletingAccount}
          onPress={confirmLogout}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <MaterialIcons color="#b8524e" name="logout" size={20} />
          {isLoggingOut ? (
            <ActivityIndicator color="#b8524e" size="small" />
          ) : (
            <Text style={styles.dangerLabel}>로그아웃</Text>
          )}
        </Pressable>

        <Pressable
          disabled={isLoggingOut || isDeletingAccount}
          onPress={confirmDeleteAccount}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <MaterialIcons color="#b8524e" name="person-remove" size={20} />
          {isDeletingAccount ? (
            <ActivityIndicator color="#b8524e" size="small" />
          ) : (
            <Text style={styles.dangerLabel}>회원 탈퇴</Text>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

function buildProfileSummary(profile: ProfileResponse): string {
  const sexLabel = profile.sex === 'male' ? '남성' : '여성';

  return `${sexLabel} · ${profile.birth_year}년생 · ${profile.height_cm}cm · ${profile.weight_kg}kg · ${ACTIVITY_LABELS[profile.activity_level]}`;
}

const styles = StyleSheet.create({
  dangerLabel: {
    color: '#b8524e',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    gap: 4,
  },
  pressed: {
    opacity: 0.74,
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  rowLabel: {
    color: '#22211f',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    gap: 10,
  },
  subtitle: {
    color: '#5c5b57',
    fontSize: 14,
  },
  summaryBody: {
    flex: 1,
    gap: 2,
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  summaryIconWrap: {
    alignItems: 'center',
    backgroundColor: '#bee2dd',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  summaryLabel: {
    color: '#5c5b57',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryValue: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  title: {
    color: '#22211f',
    fontSize: 30,
    fontWeight: '900',
  },
});
