import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

// 질환별 식이 가이드 (서버 `docs/CARE_LOOP.md` §5).
//
// **콘텐츠는 전부 서버가 만든다.** 앱은 문장을 갖지 않는다 — 지침이 개정되면 앱 심사 없이
// 고쳐야 하고, 판정 규칙(`ckd_food_rules`)과 같은 저장소에서 함께 고쳐야 설명과 경고가
// 어긋나지 않기 때문이다.
//
// `sensitive_health` 동의가 **필요 없다**. 학회 지침을 옮긴 공개 정보이고 사용자의 질병·검사값을
// 읽지 않는다 — 온보딩에서 질환을 고른 직후에 바로 열려야 하는 화면이라 그 설계가 중요하다.

export type GuideSection = {
  title: string;
  paragraphs: string[];
};

export type GuideAxis = {
  // 영양 축 코드 (sodium·potassium·phosphorus·protein·added_sugar·carbs).
  axis: string;
  label: string;
  summary: string;
  sections: GuideSection[];
  // 출처. **화면에서 숨기지 않는다** — 근거를 밝히는 것이 이 화면의 존재 이유이고,
  // Apple 1.4.1이 의료 앱에 요구하는 "근거·방법론 공개"이기도 하다.
  sources: string[];
  // 병존 질환에서 방향이 엇갈리는 축(칼륨)의 경고. 없으면 null.
  caution: string | null;
};

export type ConditionGuide = {
  condition: string;
  label: string;
  intro: string;
  axes: GuideAxis[];
  notice: string;
};

export type GuideSummary = {
  condition: string;
  label: string;
  intro: string;
  axis_count: number;
  // 내가 등록한 질환인가. 서버가 내 질환을 **앞에 정렬해** 준다 — 홈은 앞에서부터 그리면 된다.
  is_mine: boolean;
};

export const GUIDE_API_URL = apiUrl('/api', process.env.EXPO_PUBLIC_HEALTH_API_URL);

// 가이드가 없는 질환(임신·암 — 근거 문서를 만든 적이 없다). 진입점을 숨기는 데 쓴다.
export class GuideNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuideNotFoundError';
  }
}

export async function listGuides(): Promise<GuideSummary[]> {
  const response = await apiFetch(`${GUIDE_API_URL}/guides`);
  const payload = await parseOrThrow(response, '가이드 목록 조회 실패');

  if (!isRecord(payload) || !Array.isArray(payload.conditions)) {
    return [];
  }

  return payload.conditions.filter(isGuideSummary);
}

export async function getGuide(condition: string): Promise<ConditionGuide> {
  const response = await apiFetch(`${GUIDE_API_URL}/guides/${encodeURIComponent(condition)}`);

  if (response.status === 404) {
    const message = await readErrorMessage(response);
    throw new GuideNotFoundError(message || '아직 준비된 식이 가이드가 없습니다.');
  }

  const payload = await parseOrThrow(response, '가이드 조회 실패');

  if (!isConditionGuide(payload)) {
    throw new Error('가이드 응답 형식이 올바르지 않습니다.');
  }

  return payload;
}

async function parseOrThrow(response: Response, fallback: string): Promise<unknown> {
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `${fallback}: ${response.status}`);
  }

  return response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isGuideSummary(value: unknown): value is GuideSummary {
  return (
    isRecord(value) &&
    typeof value.condition === 'string' &&
    typeof value.label === 'string' &&
    typeof value.intro === 'string' &&
    typeof value.axis_count === 'number' &&
    typeof value.is_mine === 'boolean'
  );
}

function isConditionGuide(value: unknown): value is ConditionGuide {
  return (
    isRecord(value) &&
    typeof value.condition === 'string' &&
    typeof value.label === 'string' &&
    typeof value.intro === 'string' &&
    typeof value.notice === 'string' &&
    Array.isArray(value.axes) &&
    value.axes.every(isGuideAxis)
  );
}

function isGuideAxis(value: unknown): value is GuideAxis {
  return (
    isRecord(value) &&
    typeof value.axis === 'string' &&
    typeof value.label === 'string' &&
    typeof value.summary === 'string' &&
    isStringArray(value.sources) &&
    (value.caution === null || typeof value.caution === 'string') &&
    Array.isArray(value.sections) &&
    value.sections.every(
      (section) =>
        isRecord(section) &&
        typeof section.title === 'string' &&
        isStringArray(section.paragraphs)
    )
  );
}
