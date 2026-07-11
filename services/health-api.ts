import { Platform } from 'react-native';

import { apiFetch, readErrorMessage } from '@/services/http';

// 서버 필드는 snake_case를 그대로 유지한다 (docs/CODE_STYLE.md).
// 아래 타입은 kcalAI-model/docs/DATA_MODEL.md 3~5장의 테이블/산출식 계약을 따른다.
// Numeric 컬럼은 서버 직렬화 설정에 따라 number 또는 문자열("70.5")로 올 수 있어,
// 검증 단계에서 유한수로 강제 변환한 뒤 반환한다 (반환 타입은 항상 number).

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'loss' | 'maintain' | 'gain';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealItemSource = 'ai' | 'manual';

export type ProfileRequest = {
  sex: Sex;
  birth_year: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
};

export type ProfileResponse = {
  id: number;
  user_id: number;
  sex: Sex;
  birth_year: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
};

export type GoalRequest = {
  goal_type: GoalType;
  // 미지정 시 서버가 Mifflin-St Jeor로 산출한다. 지정 시 사용자 수동 덮어쓰기.
  target_kcal?: number;
  target_weight_kg?: number | null;
};

export type GoalResponse = {
  id: number;
  user_id: number;
  goal_type: GoalType;
  target_kcal: number;
  target_weight_kg: number | null;
  started_at: string;
  ended_at: string | null;
};

// 끼니 4종은 서버가 항상 전부 채워 보낸다 (배열이 아니라 객체 맵). 기록 없으면 0.
export type MealBreakdown = {
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
};

export type DaySummary = {
  date: string;
  // 목표 미설정이면 null (0이 아니다). 홈 화면이 "목표를 설정해주세요" CTA를 띄우는 근거.
  target_kcal: number | null;
  consumed_kcal: number;
  remaining_kcal: number | null;
  meals: MealBreakdown;
};

export type NutritionEstimate = {
  food_label: string;
  kcal_per_serving: number;
  serving_desc: string;
  carbs_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
  source: string;
};

export type MealItemInput = {
  food_label: string;
  serving_ratio: number;
  kcal: number;
  source: MealItemSource;
  confidence?: number | null;
};

export type CreateMealRequest = {
  meal_type: MealType;
  // 미지정 시 서버가 현재 시각(UTC)으로 저장한다.
  logged_at?: string;
  items: MealItemInput[];
};

export type MealItem = {
  id: number;
  food_label: string;
  serving_ratio: number;
  kcal: number;
  source: MealItemSource;
  confidence: number | null;
};

export type MealLog = {
  id: number;
  meal_type: MealType;
  logged_at: string;
  total_kcal: number;
  photo_s3_key: string | null;
  items: MealItem[];
};

// estimate의 404(유사도 검색까지 미매칭)를 일반 오류와 구분하는 명시적 오류 타입 (DATA_MODEL.md 13장).
// 화면은 catch에서 instanceof로 판별해 에러 배너 대신 kcal 수동 입력으로 유도한다.
export class NutritionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NutritionNotFoundError';
  }
}

// 주/월 추이 집계 (DATA_MODEL.md 15장). days는 범위 내 모든 날짜를 오름차순으로 채운다.
// 기록 없는 날도 0으로 존재한다. target_kcal은 목표 미설정 시 null (0이 아니다 — summary와 동일 규칙).
export type TrendDay = {
  date: string;
  consumed_kcal: number;
  meal_count: number;
};

export type TrendsResponse = {
  start_date: string;
  end_date: string;
  target_kcal: number | null;
  days: TrendDay[];
};

export type CreateWeightRequest = {
  weight_kg: number;
  // 미지정 시 서버가 현재 시각(UTC)으로 저장한다.
  measured_at?: string;
};

export type WeightLog = {
  id: number;
  weight_kg: number;
  measured_at: string;
};

const DEFAULT_HEALTH_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000/api' : 'http://127.0.0.1:8000/api';

export const HEALTH_API_URL = process.env.EXPO_PUBLIC_HEALTH_API_URL ?? DEFAULT_HEALTH_API_URL;

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

// 로컬 달력 날짜(YYYY-MM-DD). summary·meals 조회의 date 파라미터에 쓴다.
export function formatDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// 오늘을 끝으로 하는 최근 N일(오늘 포함) 범위. 추이 탭의 주(7)/월(30) 조회에 쓴다.
export function recentDateRange(days: number): { start_date: string; end_date: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  return { start_date: formatDateParam(start), end_date: formatDateParam(end) };
}

export async function getProfile(): Promise<ProfileResponse | null> {
  const response = await apiFetch(`${HEALTH_API_URL}/me/profile`);

  if (response.status === 404) {
    return null;
  }

  return ensure(parseProfileResponse(await parseOk(response, '프로필 조회 실패')));
}

export async function putProfile(input: ProfileRequest): Promise<ProfileResponse> {
  const response = await apiFetch(`${HEALTH_API_URL}/me/profile`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  return ensure(parseProfileResponse(await parseOk(response, '프로필 저장 실패')));
}

export async function getGoal(): Promise<GoalResponse | null> {
  const response = await apiFetch(`${HEALTH_API_URL}/me/goal`);

  if (response.status === 404) {
    return null;
  }

  return ensure(parseGoalResponse(await parseOk(response, '목표 조회 실패')));
}

export async function putGoal(input: GoalRequest): Promise<GoalResponse> {
  const response = await apiFetch(`${HEALTH_API_URL}/me/goal`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  return ensure(parseGoalResponse(await parseOk(response, '목표 저장 실패')));
}

export async function getSummary(date: string): Promise<DaySummary> {
  const response = await apiFetch(`${HEALTH_API_URL}/me/summary?date=${encodeURIComponent(date)}`);

  return ensure(parseDaySummary(await parseOk(response, '오늘 요약 조회 실패')));
}

// 서버는 식약처 DB 유사도 검색(pg_trgm)으로 조회한다 (DATA_MODEL.md 13장).
// - 미매칭이면 404 → NutritionNotFoundError (detail은 수동 입력을 안내하는 한국어 문장).
// - 매칭 성공 시 응답 food_label은 매칭된 DB 행의 이름이라 요청 라벨과 다를 수 있다
//   (예: "오리구이" 요청 → "오리고기구이" 응답). 화면이 매칭 결과를 사용자에게 보여준다.
export async function estimateNutrition(foodLabel: string): Promise<NutritionEstimate> {
  const response = await apiFetch(`${HEALTH_API_URL}/nutrition/estimate`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ food_label: foodLabel }),
  });

  if (response.status === 404) {
    const message = await readErrorMessage(response);
    throw new NutritionNotFoundError(
      message || '일치하는 음식을 찾지 못했습니다. 칼로리를 직접 입력해주세요.'
    );
  }

  return ensure(parseNutritionEstimate(await parseOk(response, '영양 정보 추정 실패')));
}

export async function createMeal(input: CreateMealRequest): Promise<MealLog> {
  const response = await apiFetch(`${HEALTH_API_URL}/meals`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  return ensure(parseMealLog(await parseOk(response, '식단 저장 실패')));
}

export async function getMeals(date: string): Promise<MealLog[]> {
  const response = await apiFetch(`${HEALTH_API_URL}/meals?date=${encodeURIComponent(date)}`);

  return ensureList(await parseOk(response, '식단 조회 실패'), parseMealLog);
}

export async function deleteMeal(id: number): Promise<void> {
  const response = await apiFetch(`${HEALTH_API_URL}/meals/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `식단 삭제 실패: ${response.status}`);
  }
}

// 범위 위반(역순, 92일 초과)은 서버가 400 + 한국어 detail을 준다 (DATA_MODEL.md 15장).
export async function getTrends(startDate: string, endDate: string): Promise<TrendsResponse> {
  const response = await apiFetch(
    `${HEALTH_API_URL}/me/trends?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`
  );

  return ensure(parseTrendsResponse(await parseOk(response, '추이 조회 실패')));
}

export async function createWeight(input: CreateWeightRequest): Promise<WeightLog> {
  const response = await apiFetch(`${HEALTH_API_URL}/weights`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  return ensure(parseWeightLog(await parseOk(response, '체중 저장 실패')));
}

export async function getWeights(): Promise<WeightLog[]> {
  const response = await apiFetch(`${HEALTH_API_URL}/weights`);

  return ensureList(await parseOk(response, '체중 추이 조회 실패'), parseWeightLog);
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

async function parseOk(response: Response, fallback: string): Promise<unknown> {
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `${fallback}: ${response.status}`);
  }

  return (await response.json()) as unknown;
}

// 검증에 실패한 응답은 화면 크래시 대신 한국어 오류로 던진다.
function ensure<T>(parsed: T | null): T {
  if (parsed === null) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return parsed;
}

function ensureList<T>(value: unknown, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return value.map((item) => ensure(parse(item)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// number 또는 숫자 문자열을 유한수로 좁힌다. 그 외에는 null.
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

// nullable Numeric: null/undefined는 null로, 숫자류는 number로. 그 외는 검증 실패(undefined 반환).
function toNullableNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  return toNumber(value) ?? undefined;
}

function toSex(value: unknown): Sex | null {
  return value === 'male' || value === 'female' ? value : null;
}

function toActivityLevel(value: unknown): ActivityLevel | null {
  return value === 'sedentary' ||
    value === 'light' ||
    value === 'moderate' ||
    value === 'active' ||
    value === 'very_active'
    ? value
    : null;
}

function toGoalType(value: unknown): GoalType | null {
  return value === 'loss' || value === 'maintain' || value === 'gain' ? value : null;
}

function toMealType(value: unknown): MealType | null {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack'
    ? value
    : null;
}

function toMealItemSource(value: unknown): MealItemSource | null {
  return value === 'ai' || value === 'manual' ? value : null;
}

function parseProfileResponse(value: unknown): ProfileResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const sex = toSex(value.sex);
  const activity_level = toActivityLevel(value.activity_level);
  const height_cm = toNumber(value.height_cm);
  const weight_kg = toNumber(value.weight_kg);

  if (
    typeof value.id !== 'number' ||
    typeof value.user_id !== 'number' ||
    sex === null ||
    typeof value.birth_year !== 'number' ||
    height_cm === null ||
    weight_kg === null ||
    activity_level === null
  ) {
    return null;
  }

  return {
    id: value.id,
    user_id: value.user_id,
    sex,
    birth_year: value.birth_year,
    height_cm,
    weight_kg,
    activity_level,
  };
}

function parseGoalResponse(value: unknown): GoalResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const goal_type = toGoalType(value.goal_type);
  const target_weight_kg = toNullableNumber(value.target_weight_kg);

  if (
    typeof value.id !== 'number' ||
    typeof value.user_id !== 'number' ||
    goal_type === null ||
    typeof value.target_kcal !== 'number' ||
    target_weight_kg === undefined ||
    typeof value.started_at !== 'string' ||
    (value.ended_at !== null && typeof value.ended_at !== 'string')
  ) {
    return null;
  }

  return {
    id: value.id,
    user_id: value.user_id,
    goal_type,
    target_kcal: value.target_kcal,
    target_weight_kg,
    started_at: value.started_at,
    ended_at: value.ended_at ?? null,
  };
}

function parseMealBreakdown(value: unknown): MealBreakdown | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.breakfast !== 'number' ||
    typeof value.lunch !== 'number' ||
    typeof value.dinner !== 'number' ||
    typeof value.snack !== 'number'
  ) {
    return null;
  }

  return {
    breakfast: value.breakfast,
    lunch: value.lunch,
    dinner: value.dinner,
    snack: value.snack,
  };
}

function parseDaySummary(value: unknown): DaySummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const meals = parseMealBreakdown(value.meals);

  if (
    typeof value.date !== 'string' ||
    (value.target_kcal !== null && typeof value.target_kcal !== 'number') ||
    typeof value.consumed_kcal !== 'number' ||
    (value.remaining_kcal !== null && typeof value.remaining_kcal !== 'number') ||
    meals === null
  ) {
    return null;
  }

  return {
    date: value.date,
    target_kcal: value.target_kcal,
    consumed_kcal: value.consumed_kcal,
    remaining_kcal: value.remaining_kcal,
    meals,
  };
}

function parseNutritionEstimate(value: unknown): NutritionEstimate | null {
  if (!isRecord(value)) {
    return null;
  }

  const carbs_g = toNullableNumber(value.carbs_g);
  const protein_g = toNullableNumber(value.protein_g);
  const fat_g = toNullableNumber(value.fat_g);

  if (
    typeof value.food_label !== 'string' ||
    typeof value.kcal_per_serving !== 'number' ||
    typeof value.serving_desc !== 'string' ||
    carbs_g === undefined ||
    protein_g === undefined ||
    fat_g === undefined ||
    typeof value.source !== 'string'
  ) {
    return null;
  }

  return {
    food_label: value.food_label,
    kcal_per_serving: value.kcal_per_serving,
    serving_desc: value.serving_desc,
    carbs_g,
    protein_g,
    fat_g,
    source: value.source,
  };
}

function parseMealItem(value: unknown): MealItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const serving_ratio = toNumber(value.serving_ratio);
  const source = toMealItemSource(value.source);
  const confidence = toNullableNumber(value.confidence);

  if (
    typeof value.id !== 'number' ||
    typeof value.food_label !== 'string' ||
    serving_ratio === null ||
    typeof value.kcal !== 'number' ||
    source === null ||
    confidence === undefined
  ) {
    return null;
  }

  return {
    id: value.id,
    food_label: value.food_label,
    serving_ratio,
    kcal: value.kcal,
    source,
    confidence,
  };
}

function parseMealLog(value: unknown): MealLog | null {
  if (!isRecord(value)) {
    return null;
  }

  const meal_type = toMealType(value.meal_type);

  if (
    typeof value.id !== 'number' ||
    meal_type === null ||
    typeof value.logged_at !== 'string' ||
    typeof value.total_kcal !== 'number' ||
    (value.photo_s3_key !== null && typeof value.photo_s3_key !== 'string') ||
    !Array.isArray(value.items)
  ) {
    return null;
  }

  const items: MealItem[] = [];

  for (const item of value.items) {
    const parsed = parseMealItem(item);

    if (parsed === null) {
      return null;
    }

    items.push(parsed);
  }

  return {
    id: value.id,
    meal_type,
    logged_at: value.logged_at,
    total_kcal: value.total_kcal,
    photo_s3_key: value.photo_s3_key ?? null,
    items,
  };
}

function parseTrendDay(value: unknown): TrendDay | null {
  if (!isRecord(value)) {
    return null;
  }

  const consumed_kcal = toNumber(value.consumed_kcal);

  if (
    typeof value.date !== 'string' ||
    consumed_kcal === null ||
    typeof value.meal_count !== 'number'
  ) {
    return null;
  }

  return {
    date: value.date,
    consumed_kcal,
    meal_count: value.meal_count,
  };
}

function parseTrendsResponse(value: unknown): TrendsResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const target_kcal = toNullableNumber(value.target_kcal);

  if (
    typeof value.start_date !== 'string' ||
    typeof value.end_date !== 'string' ||
    target_kcal === undefined ||
    !Array.isArray(value.days)
  ) {
    return null;
  }

  const days: TrendDay[] = [];

  for (const item of value.days) {
    const parsed = parseTrendDay(item);

    if (parsed === null) {
      return null;
    }

    days.push(parsed);
  }

  return {
    start_date: value.start_date,
    end_date: value.end_date,
    target_kcal,
    days,
  };
}

function parseWeightLog(value: unknown): WeightLog | null {
  if (!isRecord(value)) {
    return null;
  }

  const weight_kg = toNumber(value.weight_kg);

  if (
    typeof value.id !== 'number' ||
    weight_kg === null ||
    typeof value.measured_at !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    weight_kg,
    measured_at: value.measured_at,
  };
}
