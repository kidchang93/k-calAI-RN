import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { GoalForm, toGoalRequest } from '@/components/goal-form';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import {
  getGoal,
  getProfile,
  GoalResponse,
  GoalType,
  ProfileResponse,
  putGoal,
} from '@/services/health-api';

export default function GoalEditScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [currentGoal, setCurrentGoal] = useState<GoalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [goalType, setGoalType] = useState<GoalType>('loss');
  const [customKcalText, setCustomKcalText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [profileResult, goalResult] = await Promise.all([getProfile(), getGoal()]);

      if (profileResult === null) {
        setErrorMessage('신체 정보가 없습니다. 프로필을 먼저 입력해주세요.');
      } else {
        setProfile(profileResult);
      }

      setCurrentGoal(goalResult);

      if (goalResult !== null) {
        setGoalType(goalResult.goal_type);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await putGoal(toGoalRequest(goalType, customKcalText));

      // 홈·내 정보 탭은 useFocusEffect로 복귀 시 다시 읽는다.
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen keyboard="avoid">
      <BackButton />

      {isLoading ? (
        <LoadingState label="목표를 불러오는 중입니다." />
      ) : (
        <GoalForm
          currentGoal={currentGoal}
          customKcalText={customKcalText}
          goalType={goalType}
          isSaving={isSaving}
          onCustomKcalTextChange={setCustomKcalText}
          onGoalTypeChange={setGoalType}
          onSave={() => void save()}
          profile={profile}
          saveLabel="목표 저장">
          {errorMessage ? (
            <ErrorBanner
              message={errorMessage}
              onRetry={() => void (profile === null ? load() : save())}
            />
          ) : null}

          {profile === null ? (
            <Pressable
              onPress={() => router.push('/me/profile')}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>프로필 입력하러 가기</Text>
            </Pressable>
          ) : null}
        </GoalForm>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.74,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#bee2dd',
    borderRadius: 8,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#2a7d76',
    fontSize: 16,
    fontWeight: '800',
  },
});
