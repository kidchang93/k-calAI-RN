import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorBanner } from '@/components/error-banner';
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

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: '거의 안 움직여요',
  light: '가볍게 움직여요',
  moderate: '주 3~5회 운동해요',
  active: '거의 매일 운동해요',
  very_active: '몸 쓰는 일을 해요',
};

const GOAL_LABELS: Record<GoalType, string> = {
  loss: '체중 감량',
  maintain: '유지',
  gain: '증량',
};

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
      message: '모든 끼니·체중 기록, 반려동물, 소유한 그룹이 영구 삭제됩니다. 되돌릴 수 없습니다.',
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>내 정보</Text>
            <Text style={styles.subtitle}>프로필과 목표를 여기서 관리하세요.</Text>
          </View>

          {errorMessage ? (
            <ErrorBanner message={errorMessage} onRetry={() => void loadAccount()} />
          ) : null}

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>내 정보를 불러오는 중입니다.</Text>
            </View>
          ) : (
            <View style={styles.section}>
              <Pressable
                onPress={() => router.push('/me/profile')}
                style={({ pressed }) => [styles.summaryCard, pressed && styles.pressed]}>
                <View style={styles.summaryIconWrap}>
                  <MaterialIcons color="#3182f6" name="person-outline" size={22} />
                </View>
                <View style={styles.summaryBody}>
                  <Text style={styles.summaryLabel}>프로필</Text>
                  <Text style={styles.summaryValue}>
                    {profile === null ? '아직 입력하지 않았어요' : buildProfileSummary(profile)}
                  </Text>
                </View>
                <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
              </Pressable>

              <Pressable
                onPress={() => router.push('/me/goal')}
                style={({ pressed }) => [styles.summaryCard, pressed && styles.pressed]}>
                <View style={styles.summaryIconWrap}>
                  <MaterialIcons color="#3182f6" name="flag" size={22} />
                </View>
                <View style={styles.summaryBody}>
                  <Text style={styles.summaryLabel}>목표</Text>
                  <Text style={styles.summaryValue}>
                    {goal === null
                      ? '목표를 설정해주세요'
                      : `${GOAL_LABELS[goal.goal_type]} · 하루 ${goal.target_kcal.toLocaleString()} kcal`}
                  </Text>
                </View>
                <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
              </Pressable>
            </View>
          )}

          <View style={styles.section}>
            <Pressable
              onPress={() => router.push('/plan')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <MaterialIcons color="#4e5968" name="workspace-premium" size={20} />
              <Text style={styles.rowLabel}>요금제 · 사진 인식 사용량</Text>
              <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/me/weights')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <MaterialIcons color="#4e5968" name="monitor-weight" size={20} />
              <Text style={styles.rowLabel}>체중 기록</Text>
              <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/me/conditions')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <MaterialIcons color="#4e5968" name="medical-services" size={20} />
              <Text style={styles.rowLabel}>질병 정보</Text>
              <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/me/allergies')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <MaterialIcons color="#4e5968" name="no-food" size={20} />
              <Text style={styles.rowLabel}>알러지 정보</Text>
              <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/pets')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <MaterialIcons color="#4e5968" name="pets" size={20} />
              <Text style={styles.rowLabel}>내 반려동물</Text>
              <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
            </Pressable>

            <Pressable
              disabled={isLoggingOut || isDeletingAccount}
              onPress={confirmLogout}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <MaterialIcons color="#e5484d" name="logout" size={20} />
              {isLoggingOut ? (
                <ActivityIndicator color="#e5484d" size="small" />
              ) : (
                <Text style={styles.dangerLabel}>로그아웃</Text>
              )}
            </Pressable>

            <Pressable
              disabled={isLoggingOut || isDeletingAccount}
              onPress={confirmDeleteAccount}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <MaterialIcons color="#e5484d" name="person-remove" size={20} />
              {isDeletingAccount ? (
                <ActivityIndicator color="#e5484d" size="small" />
              ) : (
                <Text style={styles.dangerLabel}>회원 탈퇴</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function buildProfileSummary(profile: ProfileResponse): string {
  const sexLabel = profile.sex === 'male' ? '남성' : '여성';

  return `${sexLabel} · ${profile.birth_year}년생 · ${profile.height_cm}cm · ${profile.weight_kg}kg · ${ACTIVITY_LABELS[profile.activity_level]}`;
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  dangerLabel: {
    color: '#e5484d',
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
    color: '#191f28',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    gap: 10,
  },
  stateBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 32,
  },
  stateText: {
    color: '#6b7684',
    fontSize: 14,
  },
  subtitle: {
    color: '#6b7684',
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
    backgroundColor: '#edf6ff',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  summaryLabel: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryValue: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
});
