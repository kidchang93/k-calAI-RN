import { apiUrl } from '@/services/api-base';
import {
  apiFetch,
  ensure,
  ensureOk,
  isRecord,
  JSON_HEADERS,
  oneOf,
  readOk,
} from '@/services/http';

// kcalAI-model/docs/DATA_MODEL.md 9장 계약 (v2 2차 구현분 — 그룹).
// 서버 필드는 snake_case를 그대로 유지한다 (docs/CODE_STYLE.md).
//
// 상태코드 규약 (7장 공통):
//   401 — 미로그인. apiFetch가 세션을 비우고 <Redirect> 가드가 로그인으로 보낸다.
//   403 — 로그인했지만 그룹 멤버가 아님.
//   404 — 그룹 없음 / 초대코드 불일치.
// invite_code는 서버 생성 8자(대문자·숫자)이며 클라이언트가 지정할 수 없다.

const GROUP_KINDS = ['family', 'couple', 'friends', 'challenge'] as const;
const GROUP_ROLES = ['owner', 'member'] as const;

export type GroupKind = (typeof GROUP_KINDS)[number];
export type GroupRole = (typeof GROUP_ROLES)[number];

export type GroupCreateRequest = {
  name: string;
  kind: GroupKind;
};

// 생성·목록·참여가 같은 형태를 반환한다. invite_code는 멤버 전용 응답에만 담긴다.
export type GroupSummary = {
  id: number;
  owner_id: number;
  name: string;
  kind: GroupKind;
  invite_code: string;
  // 현재 사용자의 역할.
  role: GroupRole;
  member_count: number;
  created_at: string;
};

export type GroupMemberItem = {
  user_id: number;
  // 그룹에 보이는 이름 = 카카오 닉네임 (2026-07-14 이전엔 마스킹한 휴대폰 번호였다).
  // 닉네임이 없으면 서버가 '이름 미설정'을 채워 준다 — 앱에서 빈 문자열을 다루지 않는다.
  nickname: string;
  role: GroupRole;
  joined_at: string;
};

export type GroupPetItem = {
  pet_id: number;
  name: string;
  species: string;
  joined_at: string;
};

export type GroupDetail = {
  id: number;
  owner_id: number;
  name: string;
  kind: GroupKind;
  invite_code: string;
  created_at: string;
  members: GroupMemberItem[];
  pets: GroupPetItem[];
};

const GROUP_API_URL = apiUrl('/api/groups');

export async function createGroup(input: GroupCreateRequest): Promise<GroupSummary> {
  const response = await apiFetch(GROUP_API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  const data = await readOk(response, '그룹 생성 실패');

  return ensure(isGroupSummary(data) ? data : null);
}

export async function getGroups(): Promise<GroupSummary[]> {
  const response = await apiFetch(GROUP_API_URL);

  const data = await readOk(response, '그룹 목록 조회 실패');

  return ensure(Array.isArray(data) && data.every(isGroupSummary) ? data : null);
}

// 대소문자는 서버가 대문자로 정규화한다. 코드 불일치 404, 이미 멤버 400.
export async function joinGroup(inviteCode: string): Promise<GroupSummary> {
  const response = await apiFetch(`${GROUP_API_URL}/join`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ invite_code: inviteCode }),
  });

  const data = await readOk(response, '그룹 참여 실패');

  return ensure(isGroupSummary(data) ? data : null);
}

export async function getGroupDetail(groupId: number): Promise<GroupDetail> {
  const response = await apiFetch(`${GROUP_API_URL}/${groupId}`);

  return ensure(parseGroupDetail(await readOk(response, '그룹 조회 실패')));
}

// ── 그룹 라이프사이클 (DATA_MODEL.md 17장) ──────────────────────────────────
// 파괴적 라우트는 비멤버에게 404로 존재를 숨긴다. 서버 detail은 한국어라
// 화면이 error.message를 Alert로 그대로 보여준다.

// 멤버 탈퇴. 소유자는 400("그룹 삭제로 진행" 안내). 탈퇴자 소유 펫의 그룹 참여도 함께 해제된다.
export async function leaveGroup(groupId: number): Promise<void> {
  const response = await apiFetch(`${GROUP_API_URL}/${groupId}/members/me`, {
    method: 'DELETE',
  });

  await ensureOk(response, '그룹 나가기 실패');
}

// 그룹 삭제(물리 삭제). 소유자만 — 비소유 멤버 403, 비멤버 404. 펫·급여 기록은 삭제되지 않는다.
export async function deleteGroup(groupId: number): Promise<void> {
  const response = await apiFetch(`${GROUP_API_URL}/${groupId}`, {
    method: 'DELETE',
  });

  await ensureOk(response, '그룹 삭제 실패');
}

// 멤버 제거. 소유자만 — 소유자 자신 제거는 400, 대상이 멤버가 아니면 404.
export async function removeMember(groupId: number, userId: number): Promise<void> {
  const response = await apiFetch(`${GROUP_API_URL}/${groupId}/members/${userId}`, {
    method: 'DELETE',
  });

  await ensureOk(response, '멤버 제거 실패');
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

function isGroupSummary(value: unknown): value is GroupSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.owner_id === 'number' &&
    typeof value.name === 'string' &&
    oneOf(GROUP_KINDS, value.kind) !== null &&
    typeof value.invite_code === 'string' &&
    oneOf(GROUP_ROLES, value.role) !== null &&
    typeof value.member_count === 'number' &&
    typeof value.created_at === 'string'
  );
}

function isGroupMemberItem(value: unknown): value is GroupMemberItem {
  return (
    isRecord(value) &&
    typeof value.user_id === 'number' &&
    typeof value.nickname === 'string' &&
    oneOf(GROUP_ROLES, value.role) !== null &&
    typeof value.joined_at === 'string'
  );
}

function isGroupPetItem(value: unknown): value is GroupPetItem {
  return (
    isRecord(value) &&
    typeof value.pet_id === 'number' &&
    typeof value.name === 'string' &&
    typeof value.species === 'string' &&
    typeof value.joined_at === 'string'
  );
}

function parseGroupDetail(value: unknown): GroupDetail | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = oneOf(GROUP_KINDS, value.kind);

  if (
    typeof value.id !== 'number' ||
    typeof value.owner_id !== 'number' ||
    typeof value.name !== 'string' ||
    kind === null ||
    typeof value.invite_code !== 'string' ||
    typeof value.created_at !== 'string' ||
    !Array.isArray(value.members) ||
    !value.members.every(isGroupMemberItem) ||
    !Array.isArray(value.pets) ||
    !value.pets.every(isGroupPetItem)
  ) {
    return null;
  }

  return {
    id: value.id,
    owner_id: value.owner_id,
    name: value.name,
    kind,
    invite_code: value.invite_code,
    created_at: value.created_at,
    members: value.members,
    pets: value.pets,
  };
}
