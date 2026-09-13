import { Platform } from 'react-native';

import { formatDateParam } from '@/services/health-api';

// 홈의 어제 요약 카드는 하루 한 번 보여주고, 닫으면 그날은 다시 띄우지 않는다
// (서버 `docs/CARE_LOOP.md` §6). 닫은 **날짜**만 기억하므로 다음 날엔 새 어제가 와서 저절로 다시 보인다.
//
// 웹은 localStorage 에 남기고 네이티브는 앱을 켜 둔 동안만 기억한다. 화면 선호일 뿐이라
// 키체인(expo-secure-store)에 넣을 이유가 없다.
const DISMISSED_KEY = 'yesterday-card-dismissed';

let dismissedDate: string | null = null;

export function yesterdayDateParam(now: Date = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() - 1);

  return formatDateParam(date);
}

export function isYesterdayDismissed(date: string): boolean {
  return (dismissedDate ?? getWebStorage()?.getItem(DISMISSED_KEY) ?? null) === date;
}

export function dismissYesterday(date: string): void {
  dismissedDate = date;
  getWebStorage()?.setItem(DISMISSED_KEY, date);
}

function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
