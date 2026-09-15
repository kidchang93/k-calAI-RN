import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { ErrorBanner } from '@/components/error-banner';
import { GoalForm, toGoalRequest } from '@/components/goal-form';
import { LoadingState } from '@/components/loading-state';
import { OnboardingProgress } from '@/components/onboarding-progress';
import { Screen } from '@/components/screen';
import { getProfile, GoalType, ProfileResponse, putGoal } from '@/services/health-api';

export default function GoalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ consented?: string }>();
  const isConsented = params.consented === '1';
  // 동의 시 5단계(동의·질환·알러지·신체·목표), 미동의 시 3단계(동의·신체·목표).
  const stepTotal = isConsented ? 5 : 3;

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [goalType, setGoalType] = useState<GoalType>('loss');
  const [customKcalText, setCustomKcalText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await getProfile();

      if (result === null) {
        // 신체 정보 없이 목표를 산출할 수 없다. 이전 단계(body)에서 저장이 선행돼야 한다.
        setErrorMessage('신체 정보가 없습니다. 이전 단계에서 키·몸무게를 먼저 입력해주세요.');
      } else {
        setProfile(result);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const saveAndFinish = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await putGoal(toGoalRequest(goalType, customKcalText));

      // 온보딩 완료. 탭 레이아웃이 다시 마운트되며 프로필을 재확인한다.
      router.replace('/(tabs)');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen keyboard="avoid">
      <OnboardingProgress current={stepTotal} total={stepTotal} />

      {isLoading ? (
        <LoadingState label="목표 칼로리를 계산하는 중입니다." />
      ) : (
        <GoalForm
          customKcalText={customKcalText}
          goalType={goalType}
          isSaving={isSaving}
          onCustomKcalTextChange={setCustomKcalText}
          onGoalTypeChange={setGoalType}
          onSave={() => void saveAndFinish()}
          profile={profile}
          saveLabel="시작하기">
          {errorMessage ? (
            <ErrorBanner
              message={errorMessage}
              onRetry={() => void (profile === null ? loadProfile() : saveAndFinish())}
            />
          ) : null}
        </GoalForm>
      )}
    </Screen>
  );
}
