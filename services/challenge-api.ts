import { apiUrl } from '@/services/api-base';
import { apiFetch, ensure, ensureOk, isRecord, JSON_HEADERS, readOk } from '@/services/http';

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

const CHALLENGE_API_URL = apiUrl('/api/groups');

export async function getChallenges(groupId: number): Promise<ChallengeSummary[]> {
  const response = await apiFetch(`${CHALLENGE_API_URL}/${groupId}/challenges`);
  const parsed = await readOk(response, '챌린지 조회 실패');

  return ensure(
    isRecord(parsed) &&
      Array.isArray(parsed.challenges) &&
      parsed.challenges.every(isChallengeSummary)
      ? parsed.challenges
      : null
  );
}

export async function getChallengeDetail(
  groupId: number,
  challengeId: number
): Promise<ChallengeDetail> {
  const response = await apiFetch(`${CHALLENGE_API_URL}/${groupId}/challenges/${challengeId}`);
  const parsed = await readOk(response, '챌린지 조회 실패');

  return ensure(isChallengeDetail(parsed) ? parsed : null);
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

  const parsed = await readOk(response, '챌린지 생성 실패');

  return ensure(isChallengeSummary(parsed) ? parsed : null);
}

export async function deleteChallenge(groupId: number, challengeId: number): Promise<void> {
  const response = await apiFetch(`${CHALLENGE_API_URL}/${groupId}/challenges/${challengeId}`, {
    method: 'DELETE',
  });

  // 204 No Content. 403(권한 없음)·404(없음)는 메시지를 그대로 올린다.
  await ensureOk(response, '챌린지 삭제 실패');
}

// ── 내부 헬퍼 ──────────────────────────────────────────────────────────────

function isChallengeSummary(value: unknown): value is ChallengeSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.group_id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.target_minutes === 'number' &&
    typeof value.start_date === 'string' &&
    typeof value.end_date === 'string' &&
    typeof value.is_active === 'boolean'
  );
}

function isChallengeDetail(value: unknown): value is ChallengeDetail {
  // isChallengeSummary가 value를 ChallengeSummary로 좁혀 버리므로 나머지 필드는 별도 참조로 본다.
  const record: Record<string, unknown> = isRecord(value) ? value : {};

  return (
    isChallengeSummary(value) &&
    typeof record.participant_count === 'number' &&
    typeof record.member_count === 'number' &&
    typeof record.i_am_sharing === 'boolean' &&
    Array.isArray(record.entries) &&
    record.entries.every(isChallengeEntry)
  );
}

function isChallengeEntry(value: unknown): value is ChallengeEntry {
  return (
    isRecord(value) &&
    typeof value.user_id === 'number' &&
    typeof value.nickname === 'string' &&
    typeof value.minutes === 'number' &&
    typeof value.achieved === 'boolean' &&
    typeof value.rank === 'number' &&
    typeof value.is_me === 'boolean'
  );
}
