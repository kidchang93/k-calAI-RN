import { apiUrl } from '@/services/api-base';
import { apiFetch, ensure, ensureOk, isRecord, JSON_HEADERS, oneOf, readOk } from '@/services/http';

// 운동 기록 계약 (kcalAI-model/docs/ACTIVITY_GUIDANCE.md 3-2).
//
// **이 API 는 플랫폼 중립이다.** 앱과 웹이 같은 레벨의 서비스이므로 기록·조회·집계는 어디서든 같다.
// 나중에 붙일 기기 연동(HealthKit·Health Connect)은 `source` 가 하나 느는 입력 경로일 뿐이고,
// 웹 사용자는 수동 입력으로 같은 기능을 계속 쓴다.

const INTENSITIES = ['light', 'moderate', 'vigorous'] as const;

export type Intensity = (typeof INTENSITIES)[number];
export type ExerciseSource = 'manual' | 'healthkit' | 'health_connect';

export type ExerciseTypeOption = {
  code: string;
  label: string;
  default_intensity: Intensity;
};

export type Exercise = {
  id: number;
  exercise_type: string;
  // 표시명은 서버가 준다 — 앱이 코드→라벨 표를 따로 갖지 않는다.
  exercise_type_label: string;
  duration_minutes: number;
  intensity: Intensity;
  // 서버가 MET×체중×시간으로 산출한다. 프로필(체중)이 없으면 null.
  kcal: number | null;
  source: ExerciseSource;
  memo: string | null;
  performed_at: string;
};

export type ExerciseInput = {
  exercise_type: string;
  duration_minutes: number;
  intensity?: Intensity;
  // 생략하면 서버가 산출한다.
  kcal?: number | null;
  performed_at?: string;
  memo?: string | null;
};

export type ExerciseSummary = {
  start_date: string;
  end_date: string;
  light_minutes: number;
  moderate_minutes: number;
  vigorous_minutes: number;
  // 고강도 1분 = 중강도 2분으로 환산한 합계 (보건복지부 지침).
  equivalent_moderate_minutes: number;
  strength_days: number;
  total_kcal: number;
  exercise_count: number;
  // 달성 판정의 기준은 **사용자 목표**다. 목표를 설정하지 않았으면 지침 권장량이 기본값이고
  // goal_is_default 가 true 다.
  target_minutes: number;
  target_strength_days: number;
  goal_is_default: boolean;
  // 지침 권장 하한. 목표를 낮게 잡았어도 지침이 뭔지 볼 수 있게 함께 온다.
  recommended_min_minutes: number;
  remaining_minutes: number;
  achieved: boolean;
  // 목표를 연속으로 달성한 주 수. 진행 중인 주는 이미 달성했을 때만 센다.
  streak_weeks: number;
  // 고지 문구는 서버가 내려준다 — 앱 하드코딩 금지.
  notice: string;
};

export type ExerciseGoal = {
  weekly_minutes: number;
  weekly_strength_days: number;
  // 사용자가 정한 값이 아니라 지침 권장량 기본값이면 true.
  is_default: boolean;
};

const EXERCISE_API_URL = apiUrl('/api');

export async function getExerciseTypes(): Promise<ExerciseTypeOption[]> {
  const response = await apiFetch(`${EXERCISE_API_URL}/exercise-types`);
  const parsed = await readOk(response, '운동 종류 조회 실패');

  if (!Array.isArray(parsed)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return parsed.map(ensureExerciseTypeOption);
}

export async function getExercises(date: string): Promise<Exercise[]> {
  const response = await apiFetch(`${EXERCISE_API_URL}/exercises?date=${encodeURIComponent(date)}`);
  const parsed = await readOk(response, '운동 기록 조회 실패');

  if (!isRecord(parsed) || !Array.isArray(parsed.exercises)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return parsed.exercises.map(ensureExercise);
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const response = await apiFetch(`${EXERCISE_API_URL}/exercises`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  return ensureExercise(await readOk(response, '운동 기록 저장 실패'));
}

export async function deleteExercise(id: number): Promise<void> {
  const response = await apiFetch(`${EXERCISE_API_URL}/exercises/${id}`, { method: 'DELETE' });

  // 204 No Content — 본문이 없다.
  await ensureOk(response, '운동 기록 삭제 실패');
}

export async function putExerciseGoal(
  weeklyMinutes: number,
  weeklyStrengthDays: number
): Promise<ExerciseGoal> {
  const response = await apiFetch(`${EXERCISE_API_URL}/me/exercise-goal`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      weekly_minutes: weeklyMinutes,
      weekly_strength_days: weeklyStrengthDays,
    }),
  });

  const parsed = await readOk(response, '운동 목표 저장 실패');

  return ensure(isExerciseGoal(parsed) ? parsed : null);
}

export async function getExerciseSummary(
  startDate: string,
  endDate: string
): Promise<ExerciseSummary> {
  const query = `start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  const response = await apiFetch(`${EXERCISE_API_URL}/me/exercise-summary?${query}`);

  const parsed = await readOk(response, '운동 요약 조회 실패');

  return ensure(isExerciseSummary(parsed) ? parsed : null);
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

function ensureExerciseTypeOption(value: unknown): ExerciseTypeOption {
  const intensity = isRecord(value) ? oneOf(INTENSITIES, value.default_intensity) : null;

  if (
    !isRecord(value) ||
    typeof value.code !== 'string' ||
    typeof value.label !== 'string' ||
    intensity === null
  ) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return { code: value.code, label: value.label, default_intensity: intensity };
}

function ensureExercise(value: unknown): Exercise {
  const intensity = isRecord(value) ? oneOf(INTENSITIES, value.intensity) : null;

  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    typeof value.exercise_type !== 'string' ||
    typeof value.exercise_type_label !== 'string' ||
    typeof value.duration_minutes !== 'number' ||
    intensity === null ||
    typeof value.performed_at !== 'string'
  ) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return {
    id: value.id,
    exercise_type: value.exercise_type,
    exercise_type_label: value.exercise_type_label,
    duration_minutes: value.duration_minutes,
    intensity,
    kcal: typeof value.kcal === 'number' ? value.kcal : null,
    // 모르는 source(미래 값)는 manual 로 눕히지 않고 그대로 두면 타입이 깨지므로 manual 폴백.
    source:
      value.source === 'healthkit' || value.source === 'health_connect' ? value.source : 'manual',
    memo: typeof value.memo === 'string' ? value.memo : null,
    performed_at: value.performed_at,
  };
}

const SUMMARY_NUMBER_FIELDS = [
  'light_minutes',
  'moderate_minutes',
  'vigorous_minutes',
  'equivalent_moderate_minutes',
  'strength_days',
  'total_kcal',
  'exercise_count',
  'target_minutes',
  'target_strength_days',
  'recommended_min_minutes',
  'remaining_minutes',
  'streak_weeks',
] as const;

function isExerciseSummary(value: unknown): value is ExerciseSummary {
  return (
    isRecord(value) &&
    SUMMARY_NUMBER_FIELDS.every((key) => typeof value[key] === 'number') &&
    typeof value.achieved === 'boolean' &&
    typeof value.goal_is_default === 'boolean' &&
    typeof value.start_date === 'string' &&
    typeof value.end_date === 'string' &&
    typeof value.notice === 'string'
  );
}

function isExerciseGoal(value: unknown): value is ExerciseGoal {
  return (
    isRecord(value) &&
    typeof value.weekly_minutes === 'number' &&
    typeof value.weekly_strength_days === 'number' &&
    typeof value.is_default === 'boolean'
  );
}
