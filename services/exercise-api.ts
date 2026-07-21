import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

// 운동 기록 계약 (kcalAI-model/docs/ACTIVITY_GUIDANCE.md 3-2).
//
// **이 API 는 플랫폼 중립이다.** 앱과 웹이 같은 레벨의 서비스이므로 기록·조회·집계는 어디서든 같다.
// 나중에 붙일 기기 연동(HealthKit·Health Connect)은 `source` 가 하나 느는 입력 경로일 뿐이고,
// 웹 사용자는 수동 입력으로 같은 기능을 계속 쓴다.

export type Intensity = 'light' | 'moderate' | 'vigorous';
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
  recommended_min_minutes: number;
  remaining_minutes: number;
  achieved: boolean;
  // 고지 문구는 서버가 내려준다 — 앱 하드코딩 금지.
  notice: string;
};

export const EXERCISE_API_URL = apiUrl('/api', process.env.EXPO_PUBLIC_EXERCISE_API_URL);

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export async function getExerciseTypes(): Promise<ExerciseTypeOption[]> {
  const response = await apiFetch(`${EXERCISE_API_URL}/exercise-types`);
  const parsed = (await parseOk(response, '운동 종류 조회 실패')) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return parsed.map(ensureExerciseTypeOption);
}

export async function getExercises(date: string): Promise<Exercise[]> {
  const response = await apiFetch(`${EXERCISE_API_URL}/exercises?date=${encodeURIComponent(date)}`);
  const parsed = (await parseOk(response, '운동 기록 조회 실패')) as unknown;

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

  return ensureExercise(await parseOk(response, '운동 기록 저장 실패'));
}

export async function updateExercise(id: number, input: ExerciseInput): Promise<Exercise> {
  const response = await apiFetch(`${EXERCISE_API_URL}/exercises/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  return ensureExercise(await parseOk(response, '운동 기록 수정 실패'));
}

export async function deleteExercise(id: number): Promise<void> {
  const response = await apiFetch(`${EXERCISE_API_URL}/exercises/${id}`, { method: 'DELETE' });

  // 204 No Content — 본문이 없다.
  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) || '운동 기록 삭제 실패');
  }
}

export async function getExerciseSummary(
  startDate: string,
  endDate: string
): Promise<ExerciseSummary> {
  const query = `start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  const response = await apiFetch(`${EXERCISE_API_URL}/me/exercise-summary?${query}`);

  return ensureSummary(await parseOk(response, '운동 요약 조회 실패'));
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

async function parseOk(response: Response, fallback: string): Promise<unknown> {
  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) || fallback);
  }

  return response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toIntensity(value: unknown): Intensity | null {
  return value === 'light' || value === 'moderate' || value === 'vigorous' ? value : null;
}

function ensureExerciseTypeOption(value: unknown): ExerciseTypeOption {
  const intensity = isRecord(value) ? toIntensity(value.default_intensity) : null;

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
  const intensity = isRecord(value) ? toIntensity(value.intensity) : null;

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

function ensureSummary(value: unknown): ExerciseSummary {
  if (!isRecord(value)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  const numbers = [
    'light_minutes',
    'moderate_minutes',
    'vigorous_minutes',
    'equivalent_moderate_minutes',
    'strength_days',
    'total_kcal',
    'exercise_count',
    'recommended_min_minutes',
    'remaining_minutes',
  ] as const;

  if (
    numbers.some((key) => typeof value[key] !== 'number') ||
    typeof value.achieved !== 'boolean' ||
    typeof value.start_date !== 'string' ||
    typeof value.end_date !== 'string' ||
    typeof value.notice !== 'string'
  ) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return {
    start_date: value.start_date,
    end_date: value.end_date,
    light_minutes: value.light_minutes as number,
    moderate_minutes: value.moderate_minutes as number,
    vigorous_minutes: value.vigorous_minutes as number,
    equivalent_moderate_minutes: value.equivalent_moderate_minutes as number,
    strength_days: value.strength_days as number,
    total_kcal: value.total_kcal as number,
    exercise_count: value.exercise_count as number,
    recommended_min_minutes: value.recommended_min_minutes as number,
    remaining_minutes: value.remaining_minutes as number,
    achieved: value.achieved,
    notice: value.notice,
  };
}
