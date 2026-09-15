import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { PrimaryButton } from '@/components/primary-button';
import type {
  ActivityLevel,
  GoalRequest,
  GoalResponse,
  GoalType,
  ProfileResponse,
} from '@/services/health-api';

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

function parseManualKcal(customKcalText: string | null) {
  const manualKcal = customKcalText === null ? null : Number(customKcalText);
  const isManualValid =
    manualKcal === null || (Number.isInteger(manualKcal) && manualKcal > 0 && manualKcal < 10000);

  return { manualKcal, isManualValid };
}

// 수동 수정이 없으면 target_kcal을 보내지 않는다. 산출의 단일 진실은 서버다.
export function toGoalRequest(goalType: GoalType, customKcalText: string | null): GoalRequest {
  const { manualKcal, isManualValid } = parseManualKcal(customKcalText);

  return {
    goal_type: goalType,
    ...(manualKcal !== null && isManualValid ? { target_kcal: manualKcal } : {}),
  };
}

// 온보딩 목표·목표 수정이 같이 쓰는 폼. 불러오기·저장·이동은 화면이 한다.
// customKcalText 가 null 이면 자동 산출값을 그대로 쓴다(서버가 다시 계산). 사용자가 만지면 문자열로 유지된다.
// children 은 입력칸과 저장 버튼 사이(오류 배너 등)에 그린다.
export function GoalForm({
  profile,
  currentGoal = null,
  goalType,
  onGoalTypeChange,
  customKcalText,
  onCustomKcalTextChange,
  saveLabel,
  isSaving,
  onSave,
  children,
}: {
  profile: ProfileResponse | null;
  currentGoal?: GoalResponse | null;
  goalType: GoalType;
  onGoalTypeChange: (goalType: GoalType) => void;
  customKcalText: string | null;
  onCustomKcalTextChange: (text: string | null) => void;
  saveLabel: string;
  isSaving: boolean;
  onSave: () => void;
  children?: ReactNode;
}) {
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

  const { manualKcal, isManualValid } = parseManualKcal(customKcalText);
  const effectiveTarget =
    manualKcal !== null && isManualValid && manualKcal > 0
      ? manualKcal
      : (computed?.target ?? null);

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>
          {effectiveTarget === null
            ? '하루 목표를 정해주세요'
            : `하루 목표는\n${effectiveTarget.toLocaleString()} kcal 입니다`}
        </Text>
        <Text style={styles.subtitle}>
          {currentGoal === null
            ? 'Mifflin-St Jeor 공식으로 계산했어요. 직접 바꿀 수 있어요.'
            : `현재 목표 ${currentGoal.target_kcal.toLocaleString()} kcal · 저장하면 새 목표로 바뀝니다.`}
        </Text>
      </View>

      <ChipGroup
        onToggle={(value) => {
          if (value === 'loss' || value === 'maintain' || value === 'gain') {
            onGoalTypeChange(value);
            // 목표 유형이 바뀌면 자동 산출값으로 되돌린다.
            onCustomKcalTextChange(null);
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
              {computed.adjustment > 0 ? `+${computed.adjustment}` : String(computed.adjustment)}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>목표 칼로리 (직접 수정)</Text>
        <View style={styles.inputRow}>
          <TextInput
            keyboardType="numeric"
            onChangeText={onCustomKcalTextChange}
            placeholder={computed === null ? '2000' : String(computed.target)}
            placeholderTextColor="#a9a6a1"
            style={styles.input}
            value={customKcalText ?? (computed === null ? '' : String(computed.target))}
          />
          <Text style={styles.unit}>kcal</Text>
        </View>
      </View>

      {children}

      <PrimaryButton
        disabled={profile === null || !isManualValid}
        label={saveLabel}
        loading={isSaving}
        onPress={onSave}
      />

      <Text style={styles.disclaimer}>
        키·몸무게·나이·활동량을 공식에 넣어 계산한 참고값이며 의학적 조언이 아닙니다. 실제 필요량과 다를 수 있습니다.
      </Text>
    </>
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
    color: '#5c5b57',
    fontSize: 14,
    fontWeight: '700',
  },
  cardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardValue: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '900',
  },
  cardValueNegative: {
    color: '#b8524e',
  },
  cardValuePositive: {
    color: '#60beb8',
  },
  disclaimer: {
    color: '#a9a6a1',
    fontSize: 13,
    textAlign: 'center',
  },
  header: {
    gap: 6,
  },
  input: {
    color: '#22211f',
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
    borderColor: '#e4e2de',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  label: {
    color: '#5c5b57',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5c5b57',
    fontSize: 14,
  },
  title: {
    color: '#22211f',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 34,
  },
  unit: {
    color: '#a9a6a1',
    fontSize: 14,
    fontWeight: '700',
  },
});
