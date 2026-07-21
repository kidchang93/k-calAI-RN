import { apiUrl } from '@/services/api-base';
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

// BMI 분류 코드 (대한비만학회 2022 — 한국 기준이라 WHO 기준과 다르다).
export type BmiCategory =
  | 'underweight'
  | 'normal'
  | 'pre_obese'
  | 'obese_1'
  | 'obese_2'
  | 'obese_3';

// 주당 권장 신체활동량 (보건복지부 2023). 개인 처방이 아니라 연령대별 일반 권고다.
export type ActivityGuide = {
  moderate_min_minutes: number;
  moderate_max_minutes: number;
  vigorous_min_minutes: number;
  // 65세 이상은 고강도 상한이 낮다 (150 → 100분).
  vigorous_max_minutes: number;
  strength_days: number;
  // 평형성 운동은 65세 이상에만 있는 축 — 성인은 null.
  balance_days: number | null;
  is_senior: boolean;
  tips: string[];
  source: string;
  notice: string;
};

export type ProfileResponse = {
  id: number;
  user_id: number;
  sex: Sex;
  birth_year: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  // 서버가 응답 시 계산해 내려준다 — **앱에서 다시 계산하지 않는다**.
  // 목표 칼로리 산식이 서버·앱 양쪽에 있어 갈릴 위험을 이미 안고 있어서, BMI는 서버를 단일 진실로 둔다
  // (kcalAI-model/docs/ACTIVITY_GUIDANCE.md 3-1). 구버전 서버면 전부 null.
  bmi: number | null;
  bmi_category: BmiCategory | null;
  bmi_category_label: string | null;
  bmi_notice: string | null;
  activity_guide: ActivityGuide | null;
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
  // 1인분이 몇 g인지 — g↔인분 환산 계수. 원물 등 1회 제공량 미상이면 null (g 입력 불가).
  serving_size_g: number | null;
  // 1인분 실측 나트륨·칼륨·인. 미측정·AI 추정 행은 null (kcalAI-model CKD_NUTRITION.md 3-5).
  // 신장병 사용자가 먹은 음식의 수치를 확인한다. 표시할 땐 선택한 양(serving_ratio)을 곱한다.
  sodium_mg: number | null;
  potassium_mg: number | null;
  phosphorus_mg: number | null;
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

// estimate의 404(데이터셋·캐시·AI 추정까지 모두 실패)를 일반 오류와 구분하는 명시적 오류 타입
// (DATA_MODEL.md 13·19장). 화면은 catch에서 instanceof로 판별해 에러 배너 대신 kcal 수동 입력으로
// 유도한다. 404는 결정적이라 재시도해도 같은 결과다 — 재시도 버튼을 띄우지 않는다.
export class NutritionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NutritionNotFoundError';
  }
}

// estimate의 503(추정 백엔드 일시 장애 — Gemini 타임아웃·과부하) (DATA_MODEL.md 19장).
// 404와 달리 **일시적**이라 재시도하면 성공할 수 있다. 화면은 재시도 버튼을 유지한 채
// 수동 입력도 열어 둔다 — 사용자를 막다른 길에 두지 않는다.
export class NutritionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NutritionUnavailableError';
  }
}

// 주/월 섭취 집계 — 리포트 탭이 쓴다 (DATA_MODEL.md 15장). days는 범위 내 모든 날짜를 오름차순으로 채운다.
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

// 기록 직전 알러지·질병 경고 판정 (DATA_MODEL.md 16장). source는 판별 유니온 —
// 모르는 값은 recommendation-api.ts의 excluded 처리와 같은 방식으로 응답 전체를 형식 오류로 취급한다.
export type FoodWarningSource = 'condition' | 'allergy';

// 신장병·고혈압 등 영양 제한 질병 경고면 어느 영양소가 높은지. 키워드 경고·구버전 서버는 null.
export type FoodWarningNutrient = 'sodium' | 'potassium' | 'phosphorus';

// 수치의 상대 위치. 서버가 지침 분류와 실측 mg 중 엄격한 쪽으로 판정한다
// (kcalAI-model/docs/CKD_NUTRITION.md 3-4). 나트륨은 등급을 매기지 않아 항상 null 이다.
export type FoodWarningTier = 'low' | 'mid' | 'high';

export type FoodWarning = {
  source: FoodWarningSource;
  code: string;
  label: string;
  // 실측 수치만으로 발동한 경고는 걸린 키워드가 없어 빈 문자열이다 (CKD_NUTRITION.md 3-5).
  matched_keyword: string;
  matched_label: string;
  nutrient: FoodWarningNutrient | null;
  // 그 축의 1인분 실측값·등급. 미측정 음식이면 null 이고 경고는 이름 기반이다.
  nutrient_mg: number | null;
  tier: FoodWarningTier | null;
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

export const HEALTH_API_URL = apiUrl('/api', process.env.EXPO_PUBLIC_HEALTH_API_URL);

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

// 로컬 달력 날짜(YYYY-MM-DD). summary·meals 조회의 date 파라미터에 쓴다.
export function formatDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// 캘린더 셀 D(YYYY-MM-DD)에 추가한 끼니가 그 셀에서 다시 보이려면, 저장하는 logged_at의
// UTC 날짜가 D와 같아야 한다 — 서버는 끼니 하루를 UTC 자정으로 나누고(GET /api/meals?date=D도
// UTC 날짜 D로 필터), 추이 캘린더도 UTC 날짜로 버킷팅한다. 정오(UTC)로 앵커하면 어느 타임존에서
// 저장해도 UTC 날짜가 항상 D로 고정된다 (자정 근처 경계 밀림 방지).
export function dayAnchorLoggedAt(date: string): string {
  return `${date}T12:00:00.000Z`;
}

// 오늘을 끝으로 하는 최근 N일(오늘 포함) 범위. 리포트 탭의 주(7)/월(30) 조회에 쓴다.
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

// 서버는 식약처 DB를 먼저 조회하고(유사도 검색 포함), 없으면 AI가 1회 추정해 DB에 적재한다
// (DATA_MODEL.md 13·19장). 조회 경로에 LLM은 없다 — 같은 음식은 항상 같은 값이 돌아온다.
// - 매칭 성공 시 응답 food_label은 매칭된 DB 행의 이름이라 요청 라벨과 다를 수 있다
//   (예: "오리구이" 요청 → "오리고기구이" 응답). 화면이 매칭 결과를 사용자에게 보여준다.
// - `source === 'llm'`이면 실측이 아닌 **AI 추정값**이다 → 화면이 배지로 알리고 수정을 열어 준다.
// - 404 = 추정까지 실패(음식이 아니거나 값이 비정상) → 수동 입력. 503 = 추정 백엔드 일시 장애 → 재시도.
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

  if (response.status === 503) {
    const message = await readErrorMessage(response);
    throw new NutritionUnavailableError(
      message || '지금은 영양 정보를 계산할 수 없습니다. 잠시 후 다시 시도해주세요.'
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

// 전체 교체(PUT) — 요청 구조는 createMeal과 동일하다 (DATA_MODEL.md 4장, 2026-07-11 확정).
// logged_at을 생략하면 서버가 기존 기록 시각을 유지한다 (전체 교체의 유일한 예외).
// total_kcal은 서버가 items 합계로 재계산한다. 남의 끼니·삭제된 끼니는 404 (존재 은닉).
export async function updateMeal(mealId: number, input: CreateMealRequest): Promise<MealLog> {
  const response = await apiFetch(`${HEALTH_API_URL}/meals/${mealId}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  return ensure(parseMealLog(await parseOk(response, '식단 수정 실패')));
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

  return ensure(parseTrendsResponse(await parseOk(response, '리포트 조회 실패')));
}

// 기록 확정 직전 경고 판정 (DATA_MODEL.md 16장). Bearer + sensitive_health 동의 필수(401/403).
// 경고는 부가 기능이라 화면이 실패(401/403/네트워크)를 조용히 스킵한다 — 여기서는 규약대로 던지기만 한다.
// 라벨은 1~10개. 서버가 중복을 제거하고, 해당 없으면 빈 배열을 준다.
export async function checkFoodWarnings(foodLabels: string[]): Promise<FoodWarning[]> {
  const response = await apiFetch(`${HEALTH_API_URL}/nutrition/warnings`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ food_labels: foodLabels }),
  });

  const data = await parseOk(response, '경고 판정 실패');

  if (!isRecord(data) || !Array.isArray(data.warnings)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return ensureList(data.warnings, parseFoodWarning);
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

  return ensureList(await parseOk(response, '체중 기록 조회 실패'), parseWeightLog);
}

// 회원 탈퇴 (DATA_MODEL.md 18장). soft delete가 아니라 물리 삭제 — 끼니·체중·펫·소유 그룹이
// 전부 파기되고 모든 토큰이 즉시 무효가 된다. 성공 시 호출부가 clearAuthSession()을 책임진다.
// 실패 시에는 세션을 유지한다 (여기서는 던지기만 한다).
export async function deleteAccount(): Promise<void> {
  const response = await apiFetch(`${HEALTH_API_URL}/me`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `회원 탈퇴 실패: ${response.status}`);
  }
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

const BMI_CATEGORIES: BmiCategory[] = [
  'underweight',
  'normal',
  'pre_obese',
  'obese_1',
  'obese_2',
  'obese_3',
];

function toBmiCategory(value: unknown): BmiCategory | null {
  return typeof value === 'string' && (BMI_CATEGORIES as string[]).includes(value)
    ? (value as BmiCategory)
    : null;
}

// 하나라도 어긋나면 통째로 null — 반쪽짜리 권고를 그리느니 카드를 숨기는 편이 낫다.
function parseActivityGuide(value: unknown): ActivityGuide | null {
  if (!isRecord(value)) {
    return null;
  }

  const numbers = [
    value.moderate_min_minutes,
    value.moderate_max_minutes,
    value.vigorous_min_minutes,
    value.vigorous_max_minutes,
    value.strength_days,
  ];

  if (
    numbers.some((entry) => typeof entry !== 'number') ||
    typeof value.is_senior !== 'boolean' ||
    typeof value.source !== 'string' ||
    typeof value.notice !== 'string' ||
    !Array.isArray(value.tips)
  ) {
    return null;
  }

  return {
    moderate_min_minutes: value.moderate_min_minutes as number,
    moderate_max_minutes: value.moderate_max_minutes as number,
    vigorous_min_minutes: value.vigorous_min_minutes as number,
    vigorous_max_minutes: value.vigorous_max_minutes as number,
    strength_days: value.strength_days as number,
    balance_days: toNullableNumber(value.balance_days) ?? null,
    is_senior: value.is_senior,
    tips: value.tips.filter((tip): tip is string => typeof tip === 'string'),
    source: value.source,
    notice: value.notice,
  };
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
    // 파생 지표는 구버전 서버엔 없다 — 누락·형식 불일치면 null 로 눕히고 화면이 카드를 숨긴다.
    bmi: toNullableNumber(value.bmi) ?? null,
    bmi_category: toBmiCategory(value.bmi_category),
    bmi_category_label: typeof value.bmi_category_label === 'string' ? value.bmi_category_label : null,
    bmi_notice: typeof value.bmi_notice === 'string' ? value.bmi_notice : null,
    activity_guide: parseActivityGuide(value.activity_guide),
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
  const serving_size_g = toNullableNumber(value.serving_size_g);
  // 실측 3종은 누락(구버전 서버)이면 null 로 떨어진다 — toNullableNumber 가 그렇게 다룬다.
  const sodium_mg = toNullableNumber(value.sodium_mg);
  const potassium_mg = toNullableNumber(value.potassium_mg);
  const phosphorus_mg = toNullableNumber(value.phosphorus_mg);

  if (
    typeof value.food_label !== 'string' ||
    typeof value.kcal_per_serving !== 'number' ||
    typeof value.serving_desc !== 'string' ||
    carbs_g === undefined ||
    protein_g === undefined ||
    fat_g === undefined ||
    serving_size_g === undefined ||
    sodium_mg === undefined ||
    potassium_mg === undefined ||
    phosphorus_mg === undefined ||
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
    serving_size_g,
    sodium_mg,
    potassium_mg,
    phosphorus_mg,
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

function toFoodWarningSource(value: unknown): FoodWarningSource | null {
  return value === 'condition' || value === 'allergy' ? value : null;
}

function parseFoodWarning(value: unknown): FoodWarning | null {
  if (!isRecord(value)) {
    return null;
  }

  const source = toFoodWarningSource(value.source);

  if (
    source === null ||
    typeof value.code !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.matched_keyword !== 'string' ||
    typeof value.matched_label !== 'string'
  ) {
    return null;
  }

  return {
    source,
    code: value.code,
    label: value.label,
    matched_keyword: value.matched_keyword,
    matched_label: value.matched_label,
    nutrient: toFoodWarningNutrient(value.nutrient),
    // 구버전 서버엔 없다 — 관대하게 null 로 두고 앱은 수치 없이 문구만 그린다.
    nutrient_mg: toNullableNumber(value.nutrient_mg) ?? null,
    tier: toFoodWarningTier(value.tier),
  };
}

function toFoodWarningTier(value: unknown): FoodWarningTier | null {
  return value === 'low' || value === 'mid' || value === 'high' ? value : null;
}

// 서버가 sodium|potassium|phosphorus 를 주면 그대로, 그 외/누락(구버전)은 null.
function toFoodWarningNutrient(value: unknown): FoodWarningNutrient | null {
  return value === 'sodium' || value === 'potassium' || value === 'phosphorus' ? value : null;
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
