import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ChipGroup } from '@/components/chip-group';
import { ErrorBanner } from '@/components/error-banner';
import { Segmented } from '@/components/segmented';
import {
  createExercise,
  deleteExercise,
  Exercise,
  ExerciseSummary,
  ExerciseTypeOption,
  getExercises,
  getExerciseSummary,
  getExerciseTypes,
  Intensity,
  putExerciseGoal,
} from '@/services/exercise-api';
import { formatDateParam, recentDateRange } from '@/services/health-api';

// 강도는 서버(보건복지부 지침)의 축과 같다. 저강도는 권장량 집계에 들어가지 않는다.
const INTENSITY_OPTIONS: { value: Intensity; label: string }[] = [
  { value: 'light', label: '저강도' },
  { value: 'moderate', label: '중강도' },
  { value: 'vigorous', label: '고강도' },
];

const DURATION_PRESETS = [10, 20, 30, 60];

export default function ExercisesScreen() {
  const today = formatDateParam(new Date());

  const [types, setTypes] = useState<ExerciseTypeOption[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [summary, setSummary] = useState<ExerciseSummary | null>(null);

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [durationText, setDurationText] = useState('30');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [memo, setMemo] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 목표 편집. 목표는 기록과 분리돼 있어 여기서 바꿔도 지난 기록은 그대로다.
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalMinutesText, setGoalMinutesText] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { start_date, end_date } = recentDateRange(7);
      const [typeList, todayList, weekSummary] = await Promise.all([
        getExerciseTypes(),
        getExercises(today),
        getExerciseSummary(start_date, end_date),
      ]);

      setTypes(typeList);
      setExercises(todayList);
      setSummary(weekSummary);
      // 처음 진입 시 첫 종류를 골라 둔다 — 빈 선택으로 저장 버튼이 잠겨 보이지 않게.
      setSelectedType((current) => current ?? typeList[0]?.code ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 운동 종류를 고르면 그 종류의 기본 강도로 맞춘다 (걷기=중강도, 달리기=고강도).
  const selectType = (code: string) => {
    setSelectedType(code);
    const option = types.find((entry) => entry.code === code);

    if (option) {
      setIntensity(option.default_intensity);
    }
  };

  const duration = Number(durationText.trim());
  const canSave =
    selectedType !== null && Number.isFinite(duration) && duration >= 1 && duration <= 1440;

  const save = async () => {
    if (!canSave || selectedType === null) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await createExercise({
        exercise_type: selectedType,
        duration_minutes: Math.round(duration),
        intensity,
        memo: memo.trim() === '' ? null : memo.trim(),
      });

      setMemo('');
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveGoal = async () => {
    const minutes = Number(goalMinutesText.trim());

    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 2000) {
      setErrorMessage('주간 목표는 0~2000분 사이로 입력해주세요.');
      return;
    }

    setErrorMessage(null);

    try {
      // 근력 일수는 지금 화면에서 바꾸지 않는다 — 현재 값을 그대로 다시 보낸다.
      await putExerciseGoal(Math.round(minutes), summary?.target_strength_days ?? 2);
      setIsEditingGoal(false);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  const remove = async (id: number) => {
    setErrorMessage(null);

    try {
      await deleteExercise(id);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>운동 기록</Text>
            <Text style={styles.subtitle}>오늘 한 운동을 남기면 이번 주 활동량에 반영돼요.</Text>
          </View>

          {errorMessage ? (
            <ErrorBanner message={errorMessage} onRetry={() => void loadData()} />
          ) : null}

          {summary !== null ? (
            <WeeklySummaryCard
              goalMinutesText={goalMinutesText}
              isEditingGoal={isEditingGoal}
              onCancelGoal={() => setIsEditingGoal(false)}
              onChangeGoalMinutes={setGoalMinutesText}
              onEditGoal={() => {
                setGoalMinutesText(String(summary.target_minutes));
                setIsEditingGoal(true);
              }}
              onSaveGoal={() => void saveGoal()}
              summary={summary}
            />
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>운동 추가</Text>

            {isLoading && types.length === 0 ? (
              <ActivityIndicator color="#3182f6" />
            ) : (
              <>
                <ChipGroup
                  onToggle={selectType}
                  options={types.map((type) => ({ value: type.code, label: type.label }))}
                  selectedValues={selectedType !== null ? [selectedType] : []}
                />

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>시간(분)</Text>
                  <View style={styles.durationRow}>
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={setDurationText}
                      style={styles.durationInput}
                      value={durationText}
                    />
                    <View style={styles.presetRow}>
                      {DURATION_PRESETS.map((preset) => (
                        <Pressable
                          key={preset}
                          onPress={() => setDurationText(String(preset))}
                          style={({ pressed }) => [styles.preset, pressed && styles.pressed]}>
                          <Text style={styles.presetText}>{`${preset}분`}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>강도</Text>
                  <Segmented onChange={setIntensity} options={INTENSITY_OPTIONS} value={intensity} />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>메모 (선택)</Text>
                  <TextInput
                    maxLength={200}
                    onChangeText={setMemo}
                    placeholder="어떤 운동이었나요?"
                    placeholderTextColor="#b0b8c1"
                    style={styles.memoInput}
                    value={memo}
                  />
                </View>

                {/* 칼로리는 서버가 MET×체중×시간으로 산출한다 — 앱이 계산하지 않는다. */}
                <Text style={styles.hint}>
                  소모 칼로리는 등록한 몸무게를 기준으로 자동 계산돼요.
                </Text>

                <Pressable
                  disabled={!canSave || isSaving}
                  onPress={() => void save()}
                  style={({ pressed }) => [
                    styles.saveButton,
                    (!canSave || isSaving) && styles.saveButtonDisabled,
                    pressed && canSave && styles.pressed,
                  ]}>
                  {isSaving ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>기록 추가</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.listSection}>
            <Text style={styles.cardTitle}>오늘 기록</Text>

            {exercises.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons color="#b0b8c1" name="fitness-center" size={28} />
                <Text style={styles.emptyText}>아직 오늘 기록한 운동이 없어요.</Text>
              </View>
            ) : (
              exercises.map((exercise) => (
                <View key={exercise.id} style={styles.exerciseRow}>
                  <View style={styles.exerciseBody}>
                    <Text style={styles.exerciseName}>{exercise.exercise_type_label}</Text>
                    <Text style={styles.exerciseMeta}>
                      {`${exercise.duration_minutes}분 · ${intensityLabel(exercise.intensity)}${
                        exercise.kcal !== null ? ` · ${exercise.kcal.toLocaleString()} kcal` : ''
                      }`}
                    </Text>
                    {exercise.memo !== null ? (
                      <Text style={styles.exerciseMemo}>{exercise.memo}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => void remove(exercise.id)}
                    style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                    <MaterialIcons color="#e5484d" name="delete-outline" size={20} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function WeeklySummaryCard({
  summary,
  isEditingGoal,
  goalMinutesText,
  onEditGoal,
  onChangeGoalMinutes,
  onSaveGoal,
  onCancelGoal,
}: {
  summary: ExerciseSummary;
  isEditingGoal: boolean;
  goalMinutesText: string;
  onEditGoal: () => void;
  onChangeGoalMinutes: (value: string) => void;
  onSaveGoal: () => void;
  onCancelGoal: () => void;
}) {
  const ratio = Math.min(
    1,
    summary.target_minutes === 0
      ? 0
      : summary.equivalent_moderate_minutes / summary.target_minutes
  );

  return (
    <View style={styles.card}>
      <View style={styles.summaryTop}>
        <Text style={styles.cardTitle}>이번 주 활동량</Text>
        <View style={styles.badgeRow}>
          {summary.streak_weeks > 0 ? (
            <View style={styles.streakChip}>
              <MaterialIcons color="#d4571a" name="local-fire-department" size={14} />
              <Text style={styles.streakText}>{`${summary.streak_weeks}주 연속`}</Text>
            </View>
          ) : null}
          {summary.achieved ? (
            <View style={styles.achievedChip}>
              <Text style={styles.achievedText}>목표 달성</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.summaryValue}>
        {`${summary.equivalent_moderate_minutes}`}
        <Text style={styles.summaryTarget}>{` / ${summary.target_minutes}분`}</Text>
      </Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
      </View>

      <Text style={styles.summaryDetail}>
        {summary.achieved
          ? '이번 주 목표를 채웠어요. 이 상태를 유지해보세요.'
          : `목표까지 ${summary.remaining_minutes}분 남았어요.`}
      </Text>
      <Text style={styles.summaryBreakdown}>
        {`중강도 ${summary.moderate_minutes}분 · 고강도 ${summary.vigorous_minutes}분 · 근력 ${summary.strength_days}일`}
        {summary.total_kcal > 0 ? ` · ${summary.total_kcal.toLocaleString()} kcal` : ''}
      </Text>

      {isEditingGoal ? (
        <View style={styles.goalEditRow}>
          <TextInput
            keyboardType="number-pad"
            onChangeText={onChangeGoalMinutes}
            style={styles.goalInput}
            value={goalMinutesText}
          />
          <Text style={styles.goalUnit}>분 / 주</Text>
          <Pressable
            onPress={onSaveGoal}
            style={({ pressed }) => [styles.goalSave, pressed && styles.pressed]}>
            <Text style={styles.goalSaveText}>저장</Text>
          </Pressable>
          <Pressable
            onPress={onCancelGoal}
            style={({ pressed }) => [styles.goalCancel, pressed && styles.pressed]}>
            <Text style={styles.goalCancelText}>취소</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={onEditGoal}
          style={({ pressed }) => [styles.goalRow, pressed && styles.pressed]}>
          <Text style={styles.goalRowText}>
            {summary.goal_is_default
              ? `목표 미설정 — 권장량 ${summary.recommended_min_minutes}분을 기준으로 보고 있어요`
              : `내 목표 ${summary.target_minutes}분 (권장 ${summary.recommended_min_minutes}분)`}
          </Text>
          <MaterialIcons color="#3182f6" name="edit" size={16} />
        </Pressable>
      )}

      {/* 고강도 환산 규칙은 지침 근거라 화면에 밝힌다. */}
      <Text style={styles.hint}>고강도 1분은 중강도 2분으로 환산해 합산해요.</Text>
      {/* 고지 문구는 서버 문자열을 그대로 쓴다 — 앱 하드코딩 금지. */}
      <Text style={styles.notice}>{summary.notice}</Text>
    </View>
  );
}

function intensityLabel(intensity: Intensity): string {
  return INTENSITY_OPTIONS.find((option) => option.value === intensity)?.label ?? intensity;
}

const styles = StyleSheet.create({
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  goalCancel: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  goalCancelText: {
    color: '#8b95a1',
    fontSize: 13,
    fontWeight: '700',
  },
  goalEditRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  goalInput: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
    width: 76,
  },
  goalRow: {
    alignItems: 'center',
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  goalRowText: {
    color: '#4e5968',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  goalSave: {
    backgroundColor: '#3182f6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  goalSaveText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  goalUnit: {
    color: '#6b7684',
    fontSize: 13,
  },
  streakChip: {
    alignItems: 'center',
    backgroundColor: '#fff1e9',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  streakText: {
    color: '#d4571a',
    fontSize: 12,
    fontWeight: '800',
  },
  achievedChip: {
    backgroundColor: '#e9f8f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  achievedText: {
    color: '#0f8a5f',
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 16,
  },
  cardTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '800',
  },
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  durationInput: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    color: '#191f28',
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: 'center',
    width: 84,
  },
  durationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    padding: 24,
  },
  emptyText: {
    color: '#8b95a1',
    fontSize: 14,
  },
  exerciseBody: {
    flex: 1,
    gap: 2,
  },
  exerciseMemo: {
    color: '#8b95a1',
    fontSize: 12,
  },
  exerciseMeta: {
    color: '#6b7684',
    fontSize: 13,
  },
  exerciseName: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
  },
  exerciseRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  header: {
    gap: 4,
  },
  hint: {
    color: '#8b95a1',
    fontSize: 12,
  },
  listSection: {
    gap: 10,
  },
  memoInput: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    color: '#191f28',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  notice: {
    color: '#8b95a1',
    fontSize: 12,
    lineHeight: 18,
  },
  preset: {
    backgroundColor: '#f2f4f6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetText: {
    color: '#4e5968',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.74,
  },
  progressFill: {
    backgroundColor: '#3182f6',
    borderRadius: 999,
    height: '100%',
  },
  progressTrack: {
    backgroundColor: '#f2f4f6',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  removeButton: {
    padding: 4,
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    paddingVertical: 14,
  },
  saveButtonDisabled: {
    backgroundColor: '#b0c9f0',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
  },
  subtitle: {
    color: '#6b7684',
    fontSize: 14,
  },
  summaryBreakdown: {
    color: '#6b7684',
    fontSize: 13,
  },
  summaryDetail: {
    color: '#4e5968',
    fontSize: 14,
    fontWeight: '700',
  },
  summaryTarget: {
    color: '#8b95a1',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  summaryValue: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
});
