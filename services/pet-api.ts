import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

// kcalAI-model/docs/DATA_MODEL.md 9장 계약 (v2 2차 구현분 — 반려동물).
// 서버 필드는 snake_case를 그대로 유지한다 (docs/CODE_STYLE.md).
//
// 상태코드 규약 (7장 공통):
//   401 — 미로그인. apiFetch가 세션을 비우고 <Redirect> 가드가 로그인으로 보낸다.
//   404 — 펫 없음. 남의 소유일 때도 404다 (존재 자체를 숨긴다).
// 급여 기록 권한은 소유자 또는 펫이 참여한 그룹의 멤버다.
// Numeric 컬럼(weight_kg, amount_g)은 float 직렬화가 계약이지만,
// health-api와 같은 이유로 숫자 문자열도 유한수로 강제 변환해 받는다.

export type PetSpecies = 'dog' | 'cat' | 'other';

export type PetUpsertRequest = {
  name: string;
  species: PetSpecies;
  breed?: string | null;
  birth_year?: number | null;
  weight_kg?: number | null;
  // 모름 허용(null).
  is_neutered?: boolean | null;
};

export type PetResponse = {
  id: number;
  owner_id: number;
  name: string;
  species: PetSpecies;
  breed: string | null;
  birth_year: number | null;
  weight_kg: number | null;
  is_neutered: boolean | null;
  // 권장 일일 칼로리 (DATA_MODEL.md 18장, RER×MER). 응답 시마다 서버가 계산한다.
  // weight_kg가 null이거나 species가 other면 null. 급여 kcal 자동 계산에는 쓰지 않는다.
  recommended_kcal: number | null;
  created_at: string;
  updated_at: string;
};

export type FeedingCreateRequest = {
  food_label: string;
  amount_g: number;
  // MVP는 급여량(g)만 필수. 칼로리 산출(RER/MER)은 다음 단계다.
  kcal?: number | null;
  // 미지정 시 서버가 현재 시각(UTC)으로 저장한다.
  fed_at?: string;
};

export type FeedingResponse = {
  id: number;
  pet_id: number;
  fed_at: string;
  food_label: string;
  amount_g: number;
  kcal: number | null;
  created_at: string;
};

export const PET_API_URL = apiUrl('/api/pets', process.env.EXPO_PUBLIC_PET_API_URL);

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export async function createPet(input: PetUpsertRequest): Promise<PetResponse> {
  const response = await apiFetch(PET_API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  return ensure(parsePetResponse(await parseOk(response, '반려동물 등록 실패')));
}

export async function getPets(): Promise<PetResponse[]> {
  const response = await apiFetch(PET_API_URL);

  return ensureList(await parseOk(response, '반려동물 목록 조회 실패'), parsePetResponse);
}

// 전체 교체(PUT). 비우고 싶은 선택 필드는 null로 보낸다.
export async function updatePet(petId: number, input: PetUpsertRequest): Promise<PetResponse> {
  const response = await apiFetch(`${PET_API_URL}/${petId}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  return ensure(parsePetResponse(await parseOk(response, '반려동물 수정 실패')));
}

// soft delete. 삭제 후에는 그룹 상세의 pets 목록·급여 API에서 모두 제외된다.
export async function deletePet(petId: number): Promise<void> {
  const response = await apiFetch(`${PET_API_URL}/${petId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `반려동물 삭제 실패: ${response.status}`);
  }
}

export async function createFeeding(
  petId: number,
  input: FeedingCreateRequest
): Promise<FeedingResponse> {
  const response = await apiFetch(`${PET_API_URL}/${petId}/feedings`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  return ensure(parseFeedingResponse(await parseOk(response, '급여 기록 저장 실패')));
}

// date는 YYYY-MM-DD. 생략 시 서버가 오늘(UTC)로 조회한다. 하루 경계는 UTC (기존 /api/meals와 동일).
export async function getFeedings(petId: number, date?: string): Promise<FeedingResponse[]> {
  const query = date === undefined ? '' : `?date=${encodeURIComponent(date)}`;
  const response = await apiFetch(`${PET_API_URL}/${petId}/feedings${query}`);

  return ensureList(await parseOk(response, '급여 기록 조회 실패'), parseFeedingResponse);
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

function toPetSpecies(value: unknown): PetSpecies | null {
  return value === 'dog' || value === 'cat' || value === 'other' ? value : null;
}

function parsePetResponse(value: unknown): PetResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const species = toPetSpecies(value.species);
  const weight_kg = toNullableNumber(value.weight_kg);
  const recommended_kcal = toNullableNumber(value.recommended_kcal);

  if (
    typeof value.id !== 'number' ||
    typeof value.owner_id !== 'number' ||
    typeof value.name !== 'string' ||
    species === null ||
    (value.breed !== null && value.breed !== undefined && typeof value.breed !== 'string') ||
    (value.birth_year !== null &&
      value.birth_year !== undefined &&
      typeof value.birth_year !== 'number') ||
    weight_kg === undefined ||
    recommended_kcal === undefined ||
    (value.is_neutered !== null &&
      value.is_neutered !== undefined &&
      typeof value.is_neutered !== 'boolean') ||
    typeof value.created_at !== 'string' ||
    typeof value.updated_at !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    owner_id: value.owner_id,
    name: value.name,
    species,
    breed: value.breed ?? null,
    birth_year: value.birth_year ?? null,
    weight_kg,
    is_neutered: value.is_neutered ?? null,
    recommended_kcal,
    created_at: value.created_at,
    updated_at: value.updated_at,
  };
}

function parseFeedingResponse(value: unknown): FeedingResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const amount_g = toNumber(value.amount_g);
  const kcal = toNullableNumber(value.kcal);

  if (
    typeof value.id !== 'number' ||
    typeof value.pet_id !== 'number' ||
    typeof value.fed_at !== 'string' ||
    typeof value.food_label !== 'string' ||
    amount_g === null ||
    kcal === undefined ||
    typeof value.created_at !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    pet_id: value.pet_id,
    fed_at: value.fed_at,
    food_label: value.food_label,
    amount_g,
    kcal,
    created_at: value.created_at,
  };
}
