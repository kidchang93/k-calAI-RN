import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { ErrorBanner } from '@/components/error-banner';
import { OnboardingProgress } from '@/components/onboarding-progress';
import { ActivityLevel, getProfile, GoalType, ProfileResponse, putGoal } from '@/services/health-api';

// kcalAI-model/docs/DATA_MODEL.md 5장의 활동계수. 서버 산출과 같은 식으로 미리 보여준다.
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENTS: Record<GoalType, number> = {
  loss: -500,
  maintain: 0,
  gain: 300,
};

const GOAL_OPTIONS = [
  { value: 'loss', label: '체중 감량' },
  { value: 'maintain', label: '유지' },
  { value: 'gain', label: '증량' },
];

export default function GoalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ consented?: string }>();
  const isConsented = params.consented === '1';
  const stepTotal = isConsented ? 6 : 3;

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [goalType, setGoalType] = useState<GoalType>('loss');
  // null이면 자동 산출값을 그대로 쓴다. 사용자가 입력을 만지면 문자열로 유지된다.
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

  const computed = useMemo(() => {
    if (profile === null) {
      return null;
    }

    const age = new Date().getFullYear() - profile.birth_year;
    const bmr =
      profile.sex === 'male'
        ? 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * age + 5
        : 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * age - 161;
    const tdee = bmr * ACTIVITY_FACTORS[profile.activity_level];
    const adjustment = GOAL_ADJUSTMENTS[goalType];

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      adjustment,
      target: Math.round(tdee) + adjustment,
    };
  }, [profile, goalType]);

  const manualKcal = customKcalText === null ? null : Number(customKcalText);
  const isManualValid =
    manualKcal === null || (Number.isInteger(manualKcal) && manualKcal > 0 && manualKcal < 10000);
  const effectiveTarget =
    manualKcal !== null && isManualValid && manualKcal > 0
      ? manualKcal
      : (computed?.target ?? null);

  const saveAndFinish = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      // 수동 수정이 없으면 target_kcal을 보내지 않는다. 산출의 단일 진실은 서버다.
      await putGoal({
        goal_type: goalType,
        ...(manualKcal !== null && isManualValid ? { target_kcal: manualKcal } : {}),
      });

      // 온보딩 완료. 탭 레이아웃이 다시 마운트되며 프로필을 재확인한다.
      router.replace('/(tabs)');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.container}>
            <OnboardingProgress current={stepTotal} total={stepTotal} />

            {isLoading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color="#3182f6" />
                <Text style={styles.stateText}>목표 칼로리를 계산하는 중입니다.</Text>
              </View>
            ) : (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>
                    {effectiveTarget === null
                      ? '하루 목표를 정해주세요'
                      : `하루 목표는\n${effectiveTarget.toLocaleString()} kcal 입니다`}
                  </Text>
                  <Text style={styles.subtitle}>
                    Mifflin-St Jeor 공식으로 계산했어요. 직접 바꿀 수 있어요.
                  </Text>
                </View>

                <ChipGroup
                  onToggle={(value) => {
                    if (value === 'loss' || value === 'maintain' || value === 'gain') {
                      setGoalType(value);
                      // 목표 유형이 바뀌면 자동 산출값으로 되돌린다.
                      setCustomKcalText(null);
                    }
                  }}
                  options={GOAL_OPTIONS}
                  selectedValues={[goalType]}
                />

                {computed === null ? null : (
                  <View style={styles.card}>
                    <View style={styles.cardRow}>
                      <Text style={styles.cardLabel}>기초대사량 BMR</Text>
                      <Text style={styles.cardValue}>{computed.bmr.toLocaleString()}</Text>
                    </View>
                    <View style={styles.cardRow}>
                      <Text style={styles.cardLabel}>활동대사량 TDEE</Text>
                      <Text style={styles.cardValue}>{computed.tdee.toLocaleString()}</Text>
                    </View>
                    <View style={styles.cardRow}>
                      <Text style={styles.cardLabel}>목표 보정</Text>
                      <Text
                        style={[
                          styles.cardValue,
                          computed.adjustment < 0 ? styles.cardValueNegative : null,
                          computed.adjustment > 0 ? styles.cardValuePositive : null,
                        ]}>
                        {computed.adjustment > 0
                          ? `+${computed.adjustment}`
                          : String(computed.adjustment)}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>목표 칼로리 (직접 수정)</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      keyboardType="numeric"
                      onChangeText={setCustomKcalText}
                      placeholder={computed === null ? '2000' : String(computed.target)}
                      placeholderTextColor="#b0b8c1"
                      style={styles.input}
                      value={customKcalText ?? (computed === null ? '' : String(computed.target))}
                    />
                    <Text style={styles.unit}>kcal</Text>
                  </View>
                </View>

                {errorMessage ? (
                  <ErrorBanner
                    message={errorMessage}
                    onRetry={() => void (profile === null ? loadProfile() : saveAndFinish())}
                  />
                ) : null}

                <Pressable
                  disabled={profile === null || !isManualValid || isSaving}
                  onPress={() => void saveAndFinish()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (profile === null || !isManualValid || isSaving) &&
                      styles.primaryButtonDisabled,
                    pressed && styles.pressed,
                  ]}>
                  {isSaving ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>시작하기</Text>
                  )}
                </Pressable>

                <Text style={styles.disclaimer}>
                  AI 추정값이며 의학적 조언이 아닙니다. 실제 필요량과 다를 수 있습니다.
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 20,
  },
  cardLabel: {
    color: '#6b7684',
    fontSize: 14,
    fontWeight: '700',
  },
  cardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardValue: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  cardValueNegative: {
    color: '#e5484d',
  },
  cardValuePositive: {
    color: '#20c997',
  },
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  disclaimer: {
    color: '#8b95a1',
    fontSize: 13,
    textAlign: 'center',
  },
  header: {
    gap: 6,
  },
  input: {
    color: '#191f28',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    paddingVertical: 14,
  },
  inputGroup: {
    gap: 8,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e8eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  keyboardView: {
    flex: 1,
  },
  label: {
    color: '#4e5968',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: '#b4c7e7',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
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
  title: {
    color: '#191f28',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 34,
  },
  unit: {
    color: '#8b95a1',
    fontSize: 14,
    fontWeight: '700',
  },
});
