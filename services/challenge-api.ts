import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

// 그룹 운동 챌린지 (kcalAI-model/docs/ACTIVITY_GUIDANCE.md 3-4).
//
// ⚠️ 순위는 **제3자 노출**이라 서버가 `group_activity_share` 동의를 한 멤버만 담아 준다.
// 앱은 그 판정을 하지 않는다 — 목록을 받아 그리기만 하고, 내가 동의했는지는 `i_am_sharing` 으로 안다.

export type ChallengeSummary = {
  id: number;
  group_id: number;
  title: string;
  target_minutes: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

export type ChallengeEntry = {
  user_id: number;
  nickname: string;
  // 기간 내 중강도 환산 합계 (고강도는 2배).
  minutes: number;
  achieved: boolean;
  rank: number;
  is_me: boolean;
};

export type ChallengeDetail = ChallengeSummary & {
  // 순위에 담긴 사람 수(공유 동의자)와 그룹 전체 멤버 수. 둘이 다르면 그 차이를 화면이 설명한다.
  participant_count: number;
  member_count: number;
  i_am_sharing: boolean;
  entries: ChallengeEntry[];
};

export type ChallengeInput = {
  title: string;
  target_minutes: number;
  start_date: string;
  end_date: string;
};

export const CHALLENGE_API_URL = apiUrl('/api/groups', process.env.EXPO_PUBLIC_GROUP_API_URL);

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export async function getChallenges(groupId: number): Promise<ChallengeSummary[]> {
  const response = await apiFetch(`${CHALLENGE_API_URL}/${groupId}/challenges`);
  const parsed = (await parseOk(response, '챌린지 조회 실패')) as unknown;

  if (!isRecord(parsed) || !Array.isArray(parsed.challenges)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return parsed.challenges.map(ensureSummary);
}

export async function getChallengeDetail(
  groupId: number,
  challengeId: number
): Promise<ChallengeDetail> {
  const response = await apiFetch(`${CHALLENGE_API_URL}/${groupId}/challenges/${challengeId}`);
  const parsed = (await parseOk(response, '챌린지 조회 실패')) as unknown;

  if (!isRecord(parsed)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  const summary = ensureSummary(parsed);

  if (
    typeof parsed.participant_count !== 'number' ||
    typeof parsed.member_count !== 'number' ||
    typeof parsed.i_am_sharing !== 'boolean' ||
    !Array.isArray(parsed.entries)
  ) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return {
    ...summary,
    participant_count: parsed.participant_count,
    member_count: parsed.member_count,
    i_am_sharing: parsed.i_am_sharing,
    entries: parsed.entries.map(ensureEntry),
  };
}

export async function createChallenge(
  groupId: number,
  input: ChallengeInput
): Promise<ChallengeSummary> {
  const response = await apiFetch(`${CHALLENGE_API_URL}/${groupId}/challenges`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  return ensureSummary(await parseOk(response, '챌린지 생성 실패'));
}

export async function deleteChallenge(groupId: number, challengeId: number): Promise<void> {
  const response = await apiFetch(`${CHALLENGE_API_URL}/${groupId}/challenges/${challengeId}`, {
    method: 'DELETE',
  });

  // 204 No Content. 403(권한 없음)·404(없음)는 메시지를 그대로 올린다.
  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) || '챌린지 삭제 실패');
  }
}

// ── 내부 헬퍼 ──────────────────────────────────────────────────────────────

async function parseOk(response: Response, fallback: string): Promise<unknown> {
  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) || fallback);
  }

  return response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function ensureSummary(value: unknown): ChallengeSummary {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    typeof value.group_id !== 'number' ||
    typeof value.title !== 'string' ||
    typeof value.target_minutes !== 'number' ||
    typeof value.start_date !== 'string' ||
    typeof value.end_date !== 'string' ||
    typeof value.is_active !== 'boolean'
  ) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return {
    id: value.id,
    group_id: value.group_id,
    title: value.title,
    target_minutes: value.target_minutes,
    start_date: value.start_date,
    end_date: value.end_date,
    is_active: value.is_active,
  };
}

function ensureEntry(value: unknown): ChallengeEntry {
  if (
    !isRecord(value) ||
    typeof value.user_id !== 'number' ||
    typeof value.nickname !== 'string' ||
    typeof value.minutes !== 'number' ||
    typeof value.achieved !== 'boolean' ||
    typeof value.rank !== 'number' ||
    typeof value.is_me !== 'boolean'
  ) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return {
    user_id: value.user_id,
    nickname: value.nickname,
    minutes: value.minutes,
    achieved: value.achieved,
    rank: value.rank,
    is_me: value.is_me,
  };
}
