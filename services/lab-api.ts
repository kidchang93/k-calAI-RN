import { apiUrl } from '@/services/api-base';
import { apiFetch, ensureOk, isRecord, JSON_HEADERS, readOk } from '@/services/http';
import { ConsentRequiredError } from '@/services/onboarding-api';

// 검사 수치 (서버 `docs/CARE_LOOP.md` §4).
//
// 식단만 기록하면 "나트륨을 얼마나 먹었다"까지만 말할 수 있다. 이 값들이 **결과 축**이고,
// 둘을 나란히 놓는 것이 이 앱이 하려는 일이다 — 해석은 하지 않는다.
//
// ⚠️ **우리가 측정하지 않는다.** 사용자가 결과지를 보고 옮겨 적는다. 화면 문구가 '측정'으로
// 읽히면 안 된다(Apple 은 센서만으로 혈압·혈당을 측정한다고 주장하는 앱을 거부한다).
//
// 항목·단위·정상범위는 **서버가 준다** — 앱이 의학 용어와 수치를 갖지 않는다(`ckd_stages`와
// 같은 규약). 민감정보라 sensitive_health 동의가 필수다(미동의 403).

export type LabResult = {
  id: number;
  measured_on: string;
  panel: string;
  label: string;
  value: number;
  unit: string;
  // 지침이 정한 정상범위 문장. 근거가 없는 항목(혈압)은 null 이다 — 지어내지 않는다.
  reference: string | null;
  source_note: string;
  note: string | null;
  created_at: string;
};

export type LabPanel = {
  code: string;
  label: string;
  unit: string;
  reference: string | null;
  source: string;
  conditions: string[];
  decimals: number;
  // 내 질환에 해당하는 항목인가. 서버가 이 항목을 **앞으로 정렬**해 준다.
  is_mine: boolean;
};

const LAB_API_URL = apiUrl('/api');

// 403 은 민감정보 미동의다 — 일반 오류와 구분해야 화면이 '동의하러 가기'로 유도할 수 있다.
const LAB_ERRORS = { 403: ConsentRequiredError };

export async function listLabPanels(): Promise<{ panels: LabPanel[]; notice: string }> {
  const response = await apiFetch(`${LAB_API_URL}/me/lab-panels`);
  const payload = await readOk(response, '검사 항목 조회 실패', LAB_ERRORS);

  if (!isRecord(payload) || !Array.isArray(payload.panels)) {
    return { panels: [], notice: '' };
  }

  return {
    panels: payload.panels.filter(isLabPanel),
    notice: typeof payload.notice === 'string' ? payload.notice : '',
  };
}

export async function listLabResults(params?: {
  panel?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ results: LabResult[]; notice: string }> {
  const query = new URLSearchParams();

  if (params?.panel) query.set('panel', params.panel);
  if (params?.startDate) query.set('start_date', params.startDate);
  if (params?.endDate) query.set('end_date', params.endDate);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await apiFetch(`${LAB_API_URL}/me/labs${suffix}`);
  const payload = await readOk(response, '검사 수치 조회 실패', LAB_ERRORS);

  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    return { results: [], notice: '' };
  }

  return {
    results: payload.results.filter(isLabResult),
    notice: typeof payload.notice === 'string' ? payload.notice : '',
  };
}

export async function saveLabResult(input: {
  measured_on: string;
  panel: string;
  value: number;
  note?: string | null;
}): Promise<LabResult> {
  const response = await apiFetch(`${LAB_API_URL}/me/labs`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });

  const payload = await readOk(response, '검사 수치 저장 실패', LAB_ERRORS);

  if (!isLabResult(payload)) {
    throw new Error('저장 응답 형식이 올바르지 않습니다.');
  }

  return payload;
}

export async function deleteLabResult(id: number): Promise<void> {
  const response = await apiFetch(`${LAB_API_URL}/me/labs/${id}`, { method: 'DELETE' });

  await ensureOk(response, '삭제 실패', LAB_ERRORS);
}

function isLabResult(value: unknown): value is LabResult {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.measured_on === 'string' &&
    typeof value.panel === 'string' &&
    typeof value.label === 'string' &&
    typeof value.value === 'number' &&
    typeof value.unit === 'string' &&
    (value.reference === null || typeof value.reference === 'string') &&
    typeof value.source_note === 'string' &&
    (value.note === null || typeof value.note === 'string')
  );
}

function isLabPanel(value: unknown): value is LabPanel {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.label === 'string' &&
    typeof value.unit === 'string' &&
    (value.reference === null || typeof value.reference === 'string') &&
    typeof value.source === 'string' &&
    Array.isArray(value.conditions) &&
    typeof value.decimals === 'number' &&
    typeof value.is_mine === 'boolean'
  );
}
