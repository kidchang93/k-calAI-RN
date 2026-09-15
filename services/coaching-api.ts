import { apiUrl } from '@/services/api-base';
import { apiFetch, isRecord, readOk } from '@/services/http';
import { ConsentRequiredError } from '@/services/onboarding-api';

// 주간 조언 (kcalAI-model/docs/ACTIVITY_GUIDANCE.md 3-5).
//
// 문구는 **서버가 만든다** — 규칙 기반이라 같은 상황이면 같은 답이고, 앱은 받아서 그리기만 한다.
// 조언이 질병을 반영하므로(강도 제시를 피하고 상담을 안내) sensitive_health 동의가 필수다 → 미동의 403.

export type CoachingTone = 'good' | 'tip' | 'caution';

export type CoachingItem = {
  // 규칙 식별자. 문구를 바꾸지 않고 분기·로깅에 쓴다.
  code: string;
  tone: CoachingTone;
  message: string;
  // 근거 수치. 조언만 있고 근거가 없으면 사용자가 판단할 수 없다.
  evidence: string | null;
};

export type Coaching = {
  week_start: string;
  week_end: string;
  // 반영된 질병 표시명.
  conditions: string[];
  items: CoachingItem[];
  notice: string;
};

const COACHING_API_URL = apiUrl('/api');

export async function getWeeklyCoaching(): Promise<Coaching> {
  const response = await apiFetch(`${COACHING_API_URL}/me/coaching`);

  return ensureCoaching(await readOk(response, '조언 조회 실패', { 403: ConsentRequiredError }));
}

function ensureCoaching(value: unknown): Coaching {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    typeof value.week_start !== 'string' ||
    typeof value.week_end !== 'string' ||
    typeof value.notice !== 'string' ||
    !Array.isArray(value.conditions)
  ) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return {
    week_start: value.week_start,
    week_end: value.week_end,
    conditions: value.conditions.filter((entry): entry is string => typeof entry === 'string'),
    items: value.items.map(ensureItem),
    notice: value.notice,
  };
}

function ensureItem(value: unknown): CoachingItem {
  const tone = isRecord(value) ? value.tone : undefined;

  if (
    !isRecord(value) ||
    typeof value.code !== 'string' ||
    typeof value.message !== 'string' ||
    (tone !== 'good' && tone !== 'tip' && tone !== 'caution')
  ) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return {
    code: value.code,
    tone,
    message: value.message,
    evidence: typeof value.evidence === 'string' ? value.evidence : null,
  };
}
