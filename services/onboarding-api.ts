import { Platform } from 'react-native';

import { apiFetch, readErrorMessage } from '@/services/http';

// kcalAI-model/docs/DATA_MODEL.md 7장 계약 (v2 1차 구현분).
// 서버 필드는 snake_case를 그대로 유지한다 (docs/CODE_STYLE.md).
//
// 상태코드 규약:
//   401 — 미로그인. apiFetch가 세션을 비우고 <Redirect> 가드가 로그인으로 보낸다.
//   403 — 로그인했지만 sensitive_health 동의가 없거나 철회됨. 401과 다르다.
//         ConsentRequiredError로 구분해 화면이 동의 화면으로 보낼 수 있게 한다.

export type ConsentKind = 'sensitive_health' | 'terms' | 'privacy';
export type BloodType = 'A' | 'B' | 'O' | 'AB' | 'unknown';
export type RhFactor = '+' | '-';
export type AllergySeverity = 'mild' | 'severe';

export type ConsentRecord = {
  kind: ConsentKind;
  version: string;
  agreed_at: string;
  revoked_at: string | null;
};

export type HealthProfile = {
  blood_type: BloodType | null;
  rh: RhFactor | null;
};

export type HealthProfileRequest = {
  blood_type?: BloodType | null;
  rh?: RhFactor | null;
};

// allergen은 자유 문자열이 아니라 GET /api/meta/options의 표준 code다 (DATA_MODEL.md 10장).
// 화면 표시는 메타 옵션의 label로 매핑한다.
export type AllergyEntry = {
  allergen: string;
  severity: AllergySeverity | null;
};

export type AllergyInput = {
  allergen: string;
  severity?: AllergySeverity | null;
};

// 403(동의 없음/철회)을 세션 만료(401)와 구분하는 명시적 오류 타입.
// 화면은 catch에서 instanceof로 판별해 동의 화면으로 보낸다.
export class ConsentRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConsentRequiredError';
  }
}

const DEFAULT_ONBOARDING_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000/api' : 'http://127.0.0.1:8000/api';

export const ONBOARDING_API_URL =
  process.env.EXPO_PUBLIC_ONBOARDING_API_URL ?? DEFAULT_ONBOARDING_API_URL;

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export async function getConsents(): Promise<ConsentRecord[]> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/consents`);
  const data = await parseOk(response, '동의 이력 조회 실패');
  const list = extractList(data, 'consents');

  if (list === null) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return list.map((item) => ensure(parseConsent(item)));
}

export async function postConsent(kind: ConsentKind, version: string): Promise<void> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/consents`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ kind, version }),
  });

  await ensureOk(response, '동의 기록 실패');
}

export async function revokeConsent(kind: ConsentKind): Promise<void> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/consents/revoke`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ kind }),
  });

  await ensureOk(response, '동의 철회 실패');
}

// 아직 입력 전(404)이면 null을 반환한다. getProfile의 404 처리와 같은 규약.
export async function getHealthProfile(): Promise<HealthProfile | null> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/health-profile`);

  if (response.status === 404) {
    return null;
  }

  return ensure(parseHealthProfile(await parseOk(response, '건강 정보 조회 실패')));
}

export async function putHealthProfile(input: HealthProfileRequest): Promise<void> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/health-profile`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  await ensureOk(response, '건강 정보 저장 실패');
}

// 값은 GET /api/meta/options의 표준 code다 (DATA_MODEL.md 10장). 참조 테이블이
// 릴리즈 없이 늘 수 있으므로 앱은 Literal로 좁히지 않는다.
export async function getConditions(): Promise<string[]> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/conditions`);
  const data = await parseOk(response, '질병 정보 조회 실패');
  const list = extractList(data, 'conditions');

  if (list === null) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  // 문자열이 아닌 값이 내려오면 화면을 깨뜨리는 대신 무시한다 (표시 용도라 손실이 안전하다).
  return list.filter((item): item is string => typeof item === 'string');
}

// replace-all: 빈 배열이면 전체 삭제.
// 값은 GET /api/meta/options의 표준 code다. 서버가 condition_types 참조 테이블로 검증하므로
// (DATA_MODEL.md 10장) 앱은 Literal로 좁히지 않는다 — 없는 코드는 서버가 400으로 거른다.
export async function putConditions(conditions: string[]): Promise<void> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/conditions`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ conditions }),
  });

  await ensureOk(response, '질병 정보 저장 실패');
}

export async function getAllergies(): Promise<AllergyEntry[]> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/allergies`);
  const data = await parseOk(response, '알러지 정보 조회 실패');
  const list = extractList(data, 'allergies');

  if (list === null) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return list.map((item) => ensure(parseAllergyEntry(item)));
}

// replace-all: 빈 배열이면 전체 삭제.
// allergen은 자유 문자열이 아니라 GET /api/meta/options의 표준 code다 (DATA_MODEL.md 10장).
// 서버가 allergen_types 참조 테이블로 검증한다 — 없는 코드는 400.
export async function putAllergies(allergies: AllergyInput[]): Promise<void> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/allergies`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ allergies }),
  });

  await ensureOk(response, '알러지 정보 저장 실패');
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

// 403은 ConsentRequiredError, 그 외 실패는 일반 Error. 성공이면 Response를 그대로 돌려준다.
async function ensureOk(response: Response, fallback: string): Promise<Response> {
  if (response.status === 403) {
    const message = await readErrorMessage(response);
    throw new ConsentRequiredError(message || '민감정보 수집 동의가 필요합니다.');
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `${fallback}: ${response.status}`);
  }

  return response;
}

async function parseOk(response: Response, fallback: string): Promise<unknown> {
  await ensureOk(response, fallback);

  return (await response.json()) as unknown;
}

function ensure<T>(parsed: T | null): T {
  if (parsed === null) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return parsed;
}

// 목록 응답이 배열 그대로거나 { <key>: [...] } 래핑일 수 있어 둘 다 허용한다.
function extractList(value: unknown, key: string): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }

  if (isRecord(value)) {
    const wrapped = value[key];

    if (Array.isArray(wrapped)) {
      return wrapped;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toConsentKind(value: unknown): ConsentKind | null {
  return value === 'sensitive_health' || value === 'terms' || value === 'privacy' ? value : null;
}

function toBloodType(value: unknown): BloodType | null {
  return value === 'A' || value === 'B' || value === 'O' || value === 'AB' || value === 'unknown'
    ? value
    : null;
}

function toRhFactor(value: unknown): RhFactor | null {
  return value === '+' || value === '-' ? value : null;
}

function toAllergySeverity(value: unknown): AllergySeverity | null {
  return value === 'mild' || value === 'severe' ? value : null;
}

function parseConsent(value: unknown): ConsentRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = toConsentKind(value.kind);

  if (
    kind === null ||
    typeof value.version !== 'string' ||
    typeof value.agreed_at !== 'string' ||
    (value.revoked_at !== null &&
      value.revoked_at !== undefined &&
      typeof value.revoked_at !== 'string')
  ) {
    return null;
  }

  return {
    kind,
    version: value.version,
    agreed_at: value.agreed_at,
    revoked_at: typeof value.revoked_at === 'string' ? value.revoked_at : null,
  };
}

function parseHealthProfile(value: unknown): HealthProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const blood_type = toBloodType(value.blood_type);
  const rh = toRhFactor(value.rh);

  // 둘 다 nullable(모름 허용). enum 밖의 값이 오면 검증 실패로 처리한다.
  if (value.blood_type !== null && value.blood_type !== undefined && blood_type === null) {
    return null;
  }

  if (value.rh !== null && value.rh !== undefined && rh === null) {
    return null;
  }

  return { blood_type, rh };
}

function parseAllergyEntry(value: unknown): AllergyEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.allergen !== 'string') {
    return null;
  }

  return {
    allergen: value.allergen,
    severity: toAllergySeverity(value.severity),
  };
}
