import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

// 진료 일정 (서버 `docs/CARE_LOOP.md` §1·§4-3).
//
// 이 앱의 완결은 "예약"이 아니라 **진료와 진료 사이 한 바퀴**인데, 진료일을 모르면 그 바퀴의
// 시작과 끝을 알 수 없다. 리포트를 언제 뽑아야 하는지도 거기서 나온다.
//
// ⚠️ **예약이 아니다.** 사용자가 적어 두는 메모이고 병원과 아무것도 주고받지 않는다.
// 화면 문구가 '예약'으로 읽히면 안 된다 — 방향이 반대라야 의료법 제27조 제3항(영리 목적
// 소개·알선 금지)에 닿지 않는다(서버 `CARE_LOOP.md` §3).
//
// **D-day 는 앱이 센다.** 서버는 날짜만 준다 — 서버 시각은 UTC 라 자정 전후로 하루가
// 어긋난다. 남은 날은 사용자의 '오늘'에서 세야 맞다.

export type NextVisit = {
  scheduled_on: string | null;
  // 진료에서 들은 것(식단 지침·주의사항). **민감정보 동의가 없으면 서버가 null 로 내린다** —
  // 저장값이 지워진 것이 아니라 가려진 것이다.
  outcome: string | null;
  notice: string;
};

export const VISIT_API_URL = apiUrl('/api', process.env.EXPO_PUBLIC_HEALTH_API_URL);

function parseNextVisit(value: unknown): NextVisit {
  if (typeof value !== 'object' || value === null) {
    return { scheduled_on: null, outcome: null, notice: '' };
  }

  const record = value as Record<string, unknown>;

  return {
    scheduled_on: typeof record.scheduled_on === 'string' ? record.scheduled_on : null,
    outcome: typeof record.outcome === 'string' ? record.outcome : null,
    notice: typeof record.notice === 'string' ? record.notice : '',
  };
}

export async function getNextVisit(): Promise<NextVisit> {
  const response = await apiFetch(`${VISIT_API_URL}/me/next-visit`);

  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) || '진료 일정을 불러오지 못했습니다.');
  }

  return parseNextVisit(await response.json());
}

// `outcome` 을 생략하면 서버가 기존 메모를 그대로 둔다. 빈 문자열을 보내면 지운다.
export async function setNextVisit(
  scheduledOn: string,
  outcome?: string | null
): Promise<NextVisit> {
  const response = await apiFetch(`${VISIT_API_URL}/me/next-visit`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      outcome === undefined
        ? { scheduled_on: scheduledOn }
        : { scheduled_on: scheduledOn, outcome: outcome ?? '' }
    ),
  });

  if (!response.ok) {
    // 400 은 범위를 벗어난 날짜(오타 방어)다 — 서버가 사용자용 한국어 문장을 준다.
    throw new Error((await readErrorMessage(response)) || '진료 일정을 저장하지 못했습니다.');
  }

  return parseNextVisit(await response.json());
}

export async function clearNextVisit(): Promise<void> {
  const response = await apiFetch(`${VISIT_API_URL}/me/next-visit`, { method: 'DELETE' });

  if (!response.ok && response.status !== 204) {
    throw new Error((await readErrorMessage(response)) || '진료 일정을 삭제하지 못했습니다.');
  }
}

// 'YYYY-MM-DD' 가 오늘부터 며칠 뒤인가. 지났으면 음수다.
// **로컬 자정 기준**으로 센다 — new Date('2026-08-31') 은 UTC 자정으로 파싱되므로 그대로
// 빼면 시간대에 따라 하루가 밀린다. 연·월·일로 로컬 Date 를 만들어 비교하는 이유다.
export function daysUntil(scheduledOn: string, today: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(scheduledOn);

  if (match === null) {
    return null;
  }

  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}
