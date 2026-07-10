import { Platform } from 'react-native';

import { apiFetch, readErrorMessage } from '@/services/http';

// kcalAI-model/docs/DATA_MODEL.md 9장 계약 (v2 2차 구현분 — 그룹).
// 서버 필드는 snake_case를 그대로 유지한다 (docs/CODE_STYLE.md).
//
// 상태코드 규약 (7장 공통):
//   401 — 미로그인. apiFetch가 세션을 비우고 <Redirect> 가드가 로그인으로 보낸다.
//   403 — 로그인했지만 그룹 멤버가 아님.
//   404 — 그룹 없음 / 초대코드 불일치.
// invite_code는 서버 생성 8자(대문자·숫자)이며 클라이언트가 지정할 수 없다.

export type GroupKind = 'family' | 'couple' | 'friends' | 'challenge';
export type GroupRole = 'owner' | 'member';

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
  // 다른 멤버의 휴대폰 번호 원본은 서버가 노출하지 않는다 (마스킹된 값만 내려온다).
  phone_number_masked: string;
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

const DEFAULT_GROUP_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/groups' : 'http://127.0.0.1:8000/api/groups';

export const GROUP_API_URL = process.env.EXPO_PUBLIC_GROUP_API_URL ?? DEFAULT_GROUP_API_URL;

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export async function createGroup(input: GroupCreateRequest): Promise<GroupSummary> {
  const response = await apiFetch(GROUP_API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  return ensure(parseGroupSummary(await parseOk(response, '그룹 생성 실패')));
}

export async function getGroups(): Promise<GroupSummary[]> {
  const response = await apiFetch(GROUP_API_URL);

  return ensureList(await parseOk(response, '그룹 목록 조회 실패'), parseGroupSummary);
}

// 대소문자는 서버가 대문자로 정규화한다. 코드 불일치 404, 이미 멤버 400.
export async function joinGroup(inviteCode: string): Promise<GroupSummary> {
  const response = await apiFetch(`${GROUP_API_URL}/join`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ invite_code: inviteCode }),
  });

  return ensure(parseGroupSummary(await parseOk(response, '그룹 참여 실패')));
}

export async function getGroupDetail(groupId: number): Promise<GroupDetail> {
  const response = await apiFetch(`${GROUP_API_URL}/${groupId}`);

  return ensure(parseGroupDetail(await parseOk(response, '그룹 조회 실패')));
}

// 그룹 멤버이면서 펫 소유자만 가능하다. 멤버 아님 403, 펫 없음/남의 펫 404, 이미 참여 400.
export async function attachPetToGroup(groupId: number, petId: number): Promise<void> {
  const response = await apiFetch(`${GROUP_API_URL}/${groupId}/pets`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ pet_id: petId }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `반려동물 공유 실패: ${response.status}`);
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

function toGroupKind(value: unknown): GroupKind | null {
  return value === 'family' || value === 'couple' || value === 'friends' || value === 'challenge'
    ? value
    : null;
}

function toGroupRole(value: unknown): GroupRole | null {
  return value === 'owner' || value === 'member' ? value : null;
}

function parseGroupSummary(value: unknown): GroupSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = toGroupKind(value.kind);
  const role = toGroupRole(value.role);

  if (
    typeof value.id !== 'number' ||
    typeof value.owner_id !== 'number' ||
    typeof value.name !== 'string' ||
    kind === null ||
    typeof value.invite_code !== 'string' ||
    role === null ||
    typeof value.member_count !== 'number' ||
    typeof value.created_at !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    owner_id: value.owner_id,
    name: value.name,
    kind,
    invite_code: value.invite_code,
    role,
    member_count: value.member_count,
    created_at: value.created_at,
  };
}

function parseGroupMemberItem(value: unknown): GroupMemberItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const role = toGroupRole(value.role);

  if (
    typeof value.user_id !== 'number' ||
    typeof value.phone_number_masked !== 'string' ||
    role === null ||
    typeof value.joined_at !== 'string'
  ) {
    return null;
  }

  return {
    user_id: value.user_id,
    phone_number_masked: value.phone_number_masked,
    role,
    joined_at: value.joined_at,
  };
}

function parseGroupPetItem(value: unknown): GroupPetItem | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.pet_id !== 'number' ||
    typeof value.name !== 'string' ||
    typeof value.species !== 'string' ||
    typeof value.joined_at !== 'string'
  ) {
    return null;
  }

  return {
    pet_id: value.pet_id,
    name: value.name,
    species: value.species,
    joined_at: value.joined_at,
  };
}

function parseGroupDetail(value: unknown): GroupDetail | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = toGroupKind(value.kind);

  if (
    typeof value.id !== 'number' ||
    typeof value.owner_id !== 'number' ||
    typeof value.name !== 'string' ||
    kind === null ||
    typeof value.invite_code !== 'string' ||
    typeof value.created_at !== 'string' ||
    !Array.isArray(value.members) ||
    !Array.isArray(value.pets)
  ) {
    return null;
  }

  const members: GroupMemberItem[] = [];

  for (const item of value.members) {
    const parsed = parseGroupMemberItem(item);

    if (parsed === null) {
      return null;
    }

    members.push(parsed);
  }

  const pets: GroupPetItem[] = [];

  for (const item of value.pets) {
    const parsed = parseGroupPetItem(item);

    if (parsed === null) {
      return null;
    }

    pets.push(parsed);
  }

  return {
    id: value.id,
    owner_id: value.owner_id,
    name: value.name,
    kind,
    invite_code: value.invite_code,
    created_at: value.created_at,
    members,
    pets,
  };
}
