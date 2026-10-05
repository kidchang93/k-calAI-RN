import { apiUrl } from '@/services/api-base';
import { apiFetch, ensureOk, isRecord, JSON_HEADERS, readOk } from '@/services/http';
import { ConsentRequiredError } from '@/services/onboarding-api';

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
  // 진료 때 물어볼 것 (2026-10-05). **줄바꿈으로 나눈 목록**이다 — 한 줄이 질문 하나. outcome 과
  // 같은 규칙: 동의가 없으면 서버가 null 로 가리고, 비어 있지 않은 값을 보내려면 동의가 필요하다(403).
  // 진료일 없이도 담을 수 있다(서버가 날짜 없는 예정 행을 만든다 — scheduled_on 은 null 그대로).
  questions: string | null;
  notice: string;
};

// 진료 메모 두 칸. 생략한 칸은 서버가 그대로 두고, 빈 문자열은 지운다.
export type VisitMemo = {
  outcome?: string;
  questions?: string;
};

const VISIT_API_URL = apiUrl('/api');

function parseNextVisit(value: unknown): NextVisit {
  if (!isRecord(value)) {
    return { scheduled_on: null, outcome: null, questions: null, notice: '' };
  }

  return {
    scheduled_on: typeof value.scheduled_on === 'string' ? value.scheduled_on : null,
    outcome: typeof value.outcome === 'string' ? value.outcome : null,
    // 옛 서버는 이 필드를 주지 않는다 — null(없음)로 흘린다.
    questions: typeof value.questions === 'string' ? value.questions : null,
    notice: typeof value.notice === 'string' ? value.notice : '',
  };
}

export async function getNextVisit(): Promise<NextVisit> {
  const response = await apiFetch(`${VISIT_API_URL}/me/next-visit`);

  return parseNextVisit(await readOk(response, '진료 일정을 불러오지 못했습니다'));
}

// 날짜·메모 저장. **생략한 값은 서버가 그대로 둔다**: scheduledOn 이 null 이면 날짜를 건드리지 않고
// (예정이 없으면 날짜 없는 행을 만든다 — 질문부터 담는 사람), memo 의 빠진 칸도 그대로다.
export async function setNextVisit(
  scheduledOn: string | null,
  memo: VisitMemo = {}
): Promise<NextVisit> {
  const body: Record<string, string> = {};

  if (scheduledOn !== null) {
    body.scheduled_on = scheduledOn;
  }
  if (memo.outcome !== undefined) {
    body.outcome = memo.outcome;
  }
  if (memo.questions !== undefined) {
    body.questions = memo.questions;
  }

  const response = await apiFetch(`${VISIT_API_URL}/me/next-visit`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });

  // 400 은 범위를 벗어난 날짜(오타 방어)다 — 서버가 사용자용 한국어 문장을 준다.
  // 403 은 메모·질문에 값이 있는데 민감정보 동의가 없을 때다 — 화면이 동의 화면으로 이을 수 있게 가른다.
  return parseNextVisit(
    await readOk(response, '진료 일정을 저장하지 못했습니다', { 403: ConsentRequiredError })
  );
}

// '물어볼 것' 한 줄 담기. 지금 목록을 읽어 끝에 붙인다 — 같은 질문이 이미 있으면 다시 넣지 않는다.
// added 는 이번에 새로 담겼는가(false = 이미 있었다). questions 를 모르는 옛 서버는 PUT 을 200 으로
// 받고 버리므로, 응답에 실제로 들어 있는지까지 확인해 담긴 줄 알고 끝나지 않게 한다.
export async function addVisitQuestion(
  question: string
): Promise<{ visit: NextVisit; added: boolean }> {
  const current = await getNextVisit();
  const lines = splitQuestions(current.questions);
  const text = question.trim();

  if (text === '' || lines.includes(text)) {
    return { visit: current, added: false };
  }

  const visit = await setNextVisit(null, { questions: [...lines, text].join('\n') });

  if (!splitQuestions(visit.questions).includes(text)) {
    throw new Error('진료 가방에 담지 못했어요. 잠시 후 다시 시도해 주세요.');
  }

  return { visit, added: true };
}

// 저장값(줄바꿈 목록) → 질문 배열. 빈 줄은 버린다.
export function splitQuestions(questions: string | null): string[] {
  return (questions ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

export async function clearNextVisit(): Promise<void> {
  const response = await apiFetch(`${VISIT_API_URL}/me/next-visit`, { method: 'DELETE' });

  await ensureOk(response, '진료 일정을 삭제하지 못했습니다');
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
