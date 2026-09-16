import { apiUrl } from '@/services/api-base';
import { apiFetch, ensure, ensureOk, isRecord, JSON_HEADERS, oneOf, readOk } from '@/services/http';

// kcalAI-model/docs/DATA_MODEL.md 7장 계약 (v2 1차 구현분).
// 서버 필드는 snake_case를 그대로 유지한다 (docs/CODE_STYLE.md).
//
// 상태코드 규약:
//   401 — 미로그인. apiFetch가 세션을 비우고 <Redirect> 가드가 로그인으로 보낸다.
//   403 — 로그인했지만 sensitive_health 동의가 없거나 철회됨. 401과 다르다.
//         ConsentRequiredError로 구분해 화면이 동의 화면으로 보낼 수 있게 한다.

// group_activity_share: 그룹 챌린지에서 내 활동량·순위를 **같은 그룹 멤버에게** 보이는 것에 대한 동의.
// sensitive_health(우리가 수집·이용)와 별개다 — 이건 제3자 노출이라 따로 받는다.
const CONSENT_KINDS = ['sensitive_health', 'terms', 'privacy', 'group_activity_share'] as const;
const BLOOD_TYPES = ['A', 'B', 'O', 'AB', 'unknown'] as const;
const RH_FACTORS = ['+', '-'] as const;
const ALLERGY_SEVERITIES = ['mild', 'severe'] as const;

export type ConsentKind = (typeof CONSENT_KINDS)[number];
export type BloodType = (typeof BLOOD_TYPES)[number];
export type RhFactor = (typeof RH_FACTORS)[number];
export type AllergySeverity = (typeof ALLERGY_SEVERITIES)[number];

export type ConsentRecord = {
  kind: ConsentKind;
  version: string;
  agreed_at: string;
  revoked_at: string | null;
  // 이 행의 버전이 서버의 현재 문서 버전과 같은가 (2026-09-13, KCAL-22).
  // 옛 서버는 이 필드를 주지 않아 true 로 읽는다(없다고 멀쩡한 동의를 낡았다고 그리지 않는다).
  is_current: boolean;
  // 이 동의로 **기능이 막히는가** (2026-09-16). `is_current` 와 다르다 — 문구만 다듬은 개정이면
  // 낡아도(is_current=false) 기능은 그대로라 false 다. 둘을 가르지 않으면 화면이 멀쩡히 동작하는
  // 사용자에게 "다시 동의하기 전까지 쓸 수 없어요"라고 거짓 안내를 한다.
  // 옛 서버는 이 필드를 주지 않는다 → 그때는 `!is_current` 를 그대로 쓴다(예전 동작).
  requires_reconsent: boolean;
};

// 신장병 병기(투석 여부). 나트륨 하루 상한이 여기서 갈린다 — 비투석 2,000 / 투석 3,000
// (서버 docs/CKD_NUTRITION.md 3-6). 모름은 별도 코드가 아니라 null 이다.
const CKD_STAGES = ['nondialysis', 'hemodialysis', 'peritoneal'] as const;

export type CkdStage = (typeof CKD_STAGES)[number];

export type HealthProfile = {
  blood_type: BloodType | null;
  rh: RhFactor | null;
  ckd_stage: CkdStage | null;
};

export type HealthProfileRequest = {
  blood_type?: BloodType | null;
  rh?: RhFactor | null;
  ckd_stage?: CkdStage | null;
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
  name = 'ConsentRequiredError';
}

const ONBOARDING_API_URL = apiUrl('/api');

// 403은 ConsentRequiredError, 그 외 실패는 일반 Error.
const CONSENT_ERRORS = { 403: ConsentRequiredError };

export async function getConsents(): Promise<ConsentRecord[]> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/consents`);
  const data = await readOk(response, '동의 이력 조회 실패', CONSENT_ERRORS);
  const list = extractList(data, 'consents');

  if (list === null) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return list.map((item) => ensure(parseConsent(item)));
}

// 민감정보 동의가 철회되지 않았지만 **다시 받아야 하는** 상태인가 (2026-09-13 KCAL-22, 2026-09-16 정정).
// 서버는 이 상태에서 질환·병기·검사 수치를 읽지 않고 빈 값으로 준다 — 화면이 빈 값을 "없음"으로
// 그리면 거짓이 되므로 이걸로 가른다.
// ⚠️ `is_current` 가 아니라 `requires_reconsent` 를 본다: 문구만 다듬은 개정으로 낡은 동의는
// 기능이 멀쩡히 동작하므로 리포트에서 질환을 빼면 안 된다.
export function isSensitiveConsentOutdated(consents: ConsentRecord[]): boolean {
  const latest = latestSensitiveConsent(consents);

  return latest !== null && latest.revoked_at === null && latest.requires_reconsent;
}

export function latestSensitiveConsent(consents: ConsentRecord[]): ConsentRecord | null {
  return (
    consents
      .filter((consent) => consent.kind === 'sensitive_health')
      .sort((left, right) => right.agreed_at.localeCompare(left.agreed_at))[0] ?? null
  );
}

export async function postConsent(kind: ConsentKind, version: string): Promise<void> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/consents`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ kind, version }),
  });

  await ensureOk(response, '동의 기록 실패', CONSENT_ERRORS);
}

export async function revokeConsent(kind: ConsentKind): Promise<void> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/consents/revoke`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ kind }),
  });

  await ensureOk(response, '동의 철회 실패', CONSENT_ERRORS);
}

// 아직 입력 전(404)이면 null을 반환한다. getProfile의 404 처리와 같은 규약.
export async function getHealthProfile(): Promise<HealthProfile | null> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/health-profile`);

  if (response.status === 404) {
    return null;
  }

  return ensure(parseHealthProfile(await readOk(response, '건강 정보 조회 실패', CONSENT_ERRORS)));
}

export async function putHealthProfile(input: HealthProfileRequest): Promise<void> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/health-profile`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  await ensureOk(response, '건강 정보 저장 실패', CONSENT_ERRORS);
}

// 값은 GET /api/meta/options의 표준 code다 (DATA_MODEL.md 10장). 참조 테이블이
// 릴리즈 없이 늘 수 있으므로 앱은 Literal로 좁히지 않는다.
export async function getConditions(): Promise<string[]> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/conditions`);
  const data = await readOk(response, '질병 정보 조회 실패', CONSENT_ERRORS);
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

  await ensureOk(response, '질병 정보 저장 실패', CONSENT_ERRORS);
}

export async function getAllergies(): Promise<AllergyEntry[]> {
  const response = await apiFetch(`${ONBOARDING_API_URL}/me/allergies`);
  const data = await readOk(response, '알러지 정보 조회 실패', CONSENT_ERRORS);
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

  await ensureOk(response, '알러지 정보 저장 실패', CONSENT_ERRORS);
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

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

function parseConsent(value: unknown): ConsentRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = oneOf(CONSENT_KINDS, value.kind);

  if (
    kind === null ||
    typeof value.version !== 'string' ||
    typeof value.agreed_at !== 'string' ||
    (value.revoked_at !== null &&
      value.revoked_at !== undefined &&
      typeof value.revoked_at !== 'string') ||
    (value.is_current !== undefined && typeof value.is_current !== 'boolean') ||
    (value.requires_reconsent !== undefined && typeof value.requires_reconsent !== 'boolean')
  ) {
    return null;
  }

  const isCurrent = typeof value.is_current === 'boolean' ? value.is_current : true;

  return {
    kind,
    version: value.version,
    agreed_at: value.agreed_at,
    revoked_at: typeof value.revoked_at === 'string' ? value.revoked_at : null,
    is_current: isCurrent,
    // 옛 서버(필드 없음)는 "낡음 = 막힘"이었다 — 그 서버에 붙었을 때의 동작을 그대로 둔다.
    requires_reconsent:
      typeof value.requires_reconsent === 'boolean' ? value.requires_reconsent : !isCurrent,
  };
}

function parseHealthProfile(value: unknown): HealthProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const blood_type = oneOf(BLOOD_TYPES, value.blood_type);
  const rh = oneOf(RH_FACTORS, value.rh);

  // 둘 다 nullable(모름 허용). enum 밖의 값이 오면 검증 실패로 처리한다.
  if (value.blood_type !== null && value.blood_type !== undefined && blood_type === null) {
    return null;
  }

  if (value.rh !== null && value.rh !== undefined && rh === null) {
    return null;
  }

  // ckd_stage는 옛 서버가 주지 않는다 — 모르는 값·누락은 전부 null(모름)로 흘린다.
  return { blood_type, rh, ckd_stage: oneOf(CKD_STAGES, value.ckd_stage) };
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
    severity: oneOf(ALLERGY_SEVERITIES, value.severity),
  };
}
