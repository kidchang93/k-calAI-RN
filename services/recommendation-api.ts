import { Platform } from 'react-native';

import { MealType } from '@/services/health-api';
import { apiFetch, readErrorMessage } from '@/services/http';
import { ConsentRequiredError } from '@/services/onboarding-api';

// kcalAI-model/docs/DATA_MODEL.md 11장(응답 계약)·13장(순수 규칙 선정) 계약.
// 서버 필드는 snake_case를 그대로 유지한다 (docs/CODE_STYLE.md).
//
// 상태코드 규약 (7장 공통):
//   401 — 미로그인. apiFetch가 세션을 비우고 <Redirect> 가드가 로그인으로 보낸다.
//   403 — 로그인했지만 sensitive_health 동의가 없거나 철회됨 → ConsentRequiredError.
// disclaimer는 서버가 내려보낸 문구를 그대로 표시한다 — 앱에 하드코딩하지 않는다.

export type RecommendationItem = {
  name: string;
  kcal: number;
  reason: string;
};

// excluded는 판별 유니온이다. condition/allergen은 추천에 반영된 제외 조건,
// filtered는 후처리 키워드 필터로 실제 탈락한 후보다 (13장).
export type ExcludedRule = {
  type: 'allergen' | 'condition';
  code: string;
  label: string;
};

export type ExcludedFiltered = {
  type: 'filtered';
  name: string;
  matched_keyword: string;
};

export type ExcludedEntry = ExcludedRule | ExcludedFiltered;

export type DietRecommendation = {
  meal_type: MealType;
  rec_date: string;
  // 후보가 없으면 빈 배열로 내려온다 — 화면이 빈 상태를 그린다.
  items: RecommendationItem[];
  excluded: ExcludedEntry[];
  cached: boolean;
  disclaimer: string;
};

const DEFAULT_RECOMMENDATION_API_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api/recommendations'
    : 'http://127.0.0.1:8000/api/recommendations';

export const RECOMMENDATION_API_URL =
  process.env.EXPO_PUBLIC_RECOMMENDATION_API_URL ?? DEFAULT_RECOMMENDATION_API_URL;

export async function getRecommendation(
  mealType: MealType,
  date: string
): Promise<DietRecommendation> {
  const query = `meal_type=${encodeURIComponent(mealType)}&date=${encodeURIComponent(date)}`;
  const response = await apiFetch(`${RECOMMENDATION_API_URL}?${query}`);

  if (response.status === 403) {
    const message = await readErrorMessage(response);
    throw new ConsentRequiredError(message || '민감정보 수집 동의가 필요합니다.');
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `식단 추천 조회 실패: ${response.status}`);
  }

  return ensure(parseDietRecommendation((await response.json()) as unknown));
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

function ensure<T>(parsed: T | null): T {
  if (parsed === null) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toMealType(value: unknown): MealType | null {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack'
    ? value
    : null;
}

function parseRecommendationItem(value: unknown): RecommendationItem | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.name !== 'string' ||
    typeof value.kcal !== 'number' ||
    typeof value.reason !== 'string'
  ) {
    return null;
  }

  return {
    name: value.name,
    kcal: value.kcal,
    reason: value.reason,
  };
}

function parseExcludedEntry(value: unknown): ExcludedEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.type === 'allergen' || value.type === 'condition') {
    if (typeof value.code !== 'string' || typeof value.label !== 'string') {
      return null;
    }

    return {
      type: value.type,
      code: value.code,
      label: value.label,
    };
  }

  if (value.type === 'filtered') {
    if (typeof value.name !== 'string' || typeof value.matched_keyword !== 'string') {
      return null;
    }

    return {
      type: 'filtered',
      name: value.name,
      matched_keyword: value.matched_keyword,
    };
  }

  return null;
}

function parseDietRecommendation(value: unknown): DietRecommendation | null {
  if (!isRecord(value)) {
    return null;
  }

  const meal_type = toMealType(value.meal_type);

  if (
    meal_type === null ||
    typeof value.rec_date !== 'string' ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.excluded) ||
    typeof value.cached !== 'boolean' ||
    typeof value.disclaimer !== 'string'
  ) {
    return null;
  }

  const items: RecommendationItem[] = [];

  for (const item of value.items) {
    const parsed = parseRecommendationItem(item);

    if (parsed === null) {
      return null;
    }

    items.push(parsed);
  }

  const excluded: ExcludedEntry[] = [];

  for (const entry of value.excluded) {
    const parsed = parseExcludedEntry(entry);

    if (parsed === null) {
      return null;
    }

    excluded.push(parsed);
  }

  return {
    meal_type,
    rec_date: value.rec_date,
    items,
    excluded,
    cached: value.cached,
    disclaimer: value.disclaimer,
  };
}
