// 화면에 보이는 날짜·시각 문자열. 입력이 두 종류이고 해석이 다르다.
// - 'YYYY-MM-DD'(달력 날짜): Date 로 파싱하지 않는다. new Date('2026-07-16')은 UTC 자정이라
//   UTC 보다 느린 타임존에서 전날이 된다.
// - ISO 시각 문자열·Date(순간): 기기 로컬 시간으로 그린다.
// ponytail: Intl.DateTimeFormat 대신 수작업 — 괄호·마침표 같은 리터럴이 ICU 구현(Hermes iOS·Android·
// 브라우저)마다 달라 문자 단위 동일을 보장할 수 없다. 형식이 크게 늘면 기기별 출력을 확인하고 옮긴다.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 0 → '무료', 그 외 → '월 9,900원'. auth·plan 화면이 같은 형식을 썼다.
export function formatPlanPrice(priceKrw: number): string {
  return priceKrw === 0 ? '무료' : `월 ${priceKrw.toLocaleString()}원`;
}

// ---- 'YYYY-MM-DD'

// '7.16'
export function formatShortDate(date: string): string {
  return `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
}

// '7월 16일 (목)'
export function formatFullDate(date: string): string {
  const weekday =
    WEEKDAYS[
      new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))).getDay()
    ];

  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 (${weekday})`;
}

// '7월 16일'
export function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-');

  return `${Number(month)}월 ${Number(day)}일`;
}

// '2026년 7월 16일'
export function formatYearMonthDay(date: string): string {
  return `${Number(date.split('-')[0])}년 ${formatMonthDay(date)}`;
}

// ---- ISO 시각 · Date (기기 로컬)

// '7월 16일'. 없거나 못 읽으면 null
export function formatIsoMonthDay(isoText: string | null): string | null {
  const date = isoText === null ? null : parseIso(isoText);

  return date === null ? null : monthDay(date);
}

// '2026년 7월 16일'. 못 읽으면 ''
export function formatIsoYearMonthDay(isoText: string): string {
  const date = parseIso(isoText);

  return date === null ? '' : `${date.getFullYear()}년 ${monthDay(date)}`;
}

// '2026.07.16'. 못 읽으면 ''
export function formatIsoDate(isoText: string): string {
  const date = parseIso(isoText);

  return date === null ? '' : dotDate(date);
}

// '2026.07.16 09:05'. 못 읽으면 ''
export function formatIsoDateTime(isoText: string): string {
  const date = parseIso(isoText);

  return date === null ? '' : `${dotDate(date)} ${clock(date)}`;
}

// '09:05'. 못 읽으면 ''
export function formatIsoTime(isoText: string): string {
  const date = parseIso(isoText);

  return date === null ? '' : clock(date);
}

// '2026.7.16 09:05' — 월·일은 0을 채우지 않는다. 못 읽으면 ''
export function formatMeasuredAt(isoText: string): string {
  const date = parseIso(isoText);

  return date === null
    ? ''
    : `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${clock(date)}`;
}

// '2026-07-16 09:05'. 못 읽으면 입력 그대로
export function formatGeneratedAt(value: string): string {
  const date = parseIso(value);

  return date === null
    ? value
    : `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${clock(date)}`;
}

// '내일 오전 9시' | '7월 18일 오후 3시'. 못 읽으면 null
export function formatResetAt(resetsAt: string): string | null {
  const reset = parseIso(resetsAt);

  if (reset === null) {
    return null;
  }

  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isTomorrow =
    reset.getFullYear() === tomorrow.getFullYear() &&
    reset.getMonth() === tomorrow.getMonth() &&
    reset.getDate() === tomorrow.getDate();

  return `${isTomorrow ? '내일' : monthDay(reset)} ${meridiemHour(reset)}시`;
}

// '7월 16일 오전 9:05'
export function formatTakenAt(time: Date): string {
  return `${monthDay(time)} ${meridiemHour(time)}:${pad2(time.getMinutes())}`;
}

function parseIso(isoText: string): Date | null {
  const date = new Date(isoText);

  return Number.isNaN(date.getTime()) ? null : date;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function monthDay(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function dotDate(date: Date): string {
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
}

function clock(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// '오전 9' | '오후 12'
function meridiemHour(date: Date): string {
  const hour = date.getHours();

  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 === 0 ? 12 : hour % 12}`;
}
