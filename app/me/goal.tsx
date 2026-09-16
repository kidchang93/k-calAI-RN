import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

          {/* **질환·병기 수정 경로**(2026-09-16, KCAL-41). 내 정보 메뉴의 '질병 정보' 행을 뺐는데
              그것이 `/me/conditions` 로 가는 **유일한** 길이었다 — 온보딩의 같은 화면은 프로필이
              없을 때만 열리므로(탭 진입 가드) 가입을 마친 사람은 다시 들어갈 수 없다.
              여기 두는 이유: 등록한 질환이 이 화면이 말하는 기준을 고르는 값이다. 신장병이면
              투석 여부가 칼륨 과일 분류와 칼륨·인 참고치 노출을 가른다
              (서버 `docs/CKD_NUTRITION.md` §3-6). */}
          <Pressable
            onPress={() => router.push('/me/conditions')}
            style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
            <MaterialIcons color="#2a7d76" name="medical-services" size={20} />
            <View style={styles.linkBody}>
              <Text style={styles.linkTitle}>등록한 질환</Text>
              <Text style={styles.linkHint}>
                질환에 따라 보여드리는 영양 기준이 달라져요. 신장 질환은 투석 여부도 함께 봐요.
              </Text>
            </View>
            <MaterialIcons color="#a9a6a1" name="chevron-right" size={20} />
          </Pressable>
        </GoalForm>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  linkBody: {
    flex: 1,
    gap: 2,
  },
  linkHint: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 18,
  },
  linkRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  linkTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
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
