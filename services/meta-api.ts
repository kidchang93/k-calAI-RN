import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

// kcalAI-model/docs/DATA_MODEL.md 10장 계약.
// GET /api/meta/options — 온보딩 질병·알러지 선택지. Bearer 필수,
// sensitive_health 동의는 요구하지 않는다 (동의 화면 다음이 질병 선택이다).

export type MetaOption = {
  code: string;
  label: string;
};

export type MetaOptions = {
  conditions: MetaOption[];
  allergens: MetaOption[];
};

// 네트워크 실패 시 번들 폴백. 서버 시드(DATA_MODEL.md 10장)와 동일한 code/label.
// 온보딩이 네트워크 오류로 막히면 안 된다 (docs/DESIGN.md 선택지 데이터 규칙).
export const FALLBACK_CONDITION_OPTIONS: MetaOption[] = [
  { code: 'diabetes', label: '당뇨' },
  { code: 'pregnancy', label: '임신 중' },
  { code: 'ckd', label: '신장 질환' },
  { code: 'cancer', label: '암 치료 중' },
  { code: 'hypertension', label: '고혈압' },
];

export const FALLBACK_ALLERGEN_OPTIONS: MetaOption[] = [
  { code: 'peanut', label: '땅콩' },
  { code: 'milk', label: '우유' },
  { code: 'shellfish', label: '갑각류' },
  { code: 'egg', label: '계란' },
  { code: 'wheat', label: '밀' },
  { code: 'soy', label: '대두' },
  { code: 'peach', label: '복숭아' },
];

export const META_API_URL = apiUrl('/api/meta', process.env.EXPO_PUBLIC_META_API_URL);

export async function getMetaOptions(): Promise<MetaOptions> {
  const response = await apiFetch(`${META_API_URL}/options`);

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `선택지 목록 조회 실패: ${response.status}`);
  }

  const parsed = parseMetaOptions((await response.json()) as unknown);

  if (parsed === null) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return parsed;
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseMetaOption(value: unknown): MetaOption | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.code !== 'string' || typeof value.label !== 'string') {
    return null;
  }

  return { code: value.code, label: value.label };
}

function parseMetaOptionList(value: unknown): MetaOption[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const options: MetaOption[] = [];

  for (const item of value) {
    const parsed = parseMetaOption(item);

    if (parsed === null) {
      return null;
    }

    options.push(parsed);
  }

  return options;
}

function parseMetaOptions(value: unknown): MetaOptions | null {
  if (!isRecord(value)) {
    return null;
  }

  const conditions = parseMetaOptionList(value.conditions);
  const allergens = parseMetaOptionList(value.allergens);

  if (conditions === null || allergens === null) {
    return null;
  }

  return { conditions, allergens };
}
