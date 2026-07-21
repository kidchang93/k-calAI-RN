import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';
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

export const COACHING_API_URL = apiUrl('/api', process.env.EXPO_PUBLIC_HEALTH_API_URL);

export async function getWeeklyCoaching(): Promise<Coaching> {
  const response = await apiFetch(`${COACHING_API_URL}/me/coaching`);

  if (response.status === 403) {
    const message = await readErrorMessage(response);
    throw new ConsentRequiredError(message || '민감정보 수집 동의가 필요합니다.');
  }

  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) || '조언 조회 실패');
  }

  return ensureCoaching(await response.json());
}

function ensureCoaching(value: unknown): Coaching {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as Record<string, unknown>).items)
  ) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.week_start !== 'string' ||
    typeof record.week_end !== 'string' ||
    typeof record.notice !== 'string' ||
    !Array.isArray(record.conditions)
  ) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return {
    week_start: record.week_start,
    week_end: record.week_end,
    conditions: record.conditions.filter((entry): entry is string => typeof entry === 'string'),
    items: (record.items as unknown[]).map(ensureItem),
    notice: record.notice,
  };
}

function ensureItem(value: unknown): CoachingItem {
  const record = value as Record<string, unknown>;
  const tone = record?.tone;

  if (
    typeof record !== 'object' ||
    record === null ||
    typeof record.code !== 'string' ||
    typeof record.message !== 'string' ||
    (tone !== 'good' && tone !== 'tip' && tone !== 'caution')
  ) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return {
    code: record.code,
    tone,
    message: record.message,
    evidence: typeof record.evidence === 'string' ? record.evidence : null,
  };
}
