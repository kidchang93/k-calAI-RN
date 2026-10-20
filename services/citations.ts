import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import { apiUrl } from '@/services/api-base';
import { apiFetch, isRecord, readOk } from '@/services/http';

// 근거 문헌의 원문 링크 (서버 `docs/DATA_MODEL.md` 34장).
//
// 2026-10-20 App Store 1.4.1 반려 — 건강 계산·참고 정보·리포트에 출처가 없다는 사유였다. 근거 문장은
// 이미 있었지만 **누를 수 있는 링크**가 아니었다. 서버가 쓰는 근거(학회 지침 등)의 링크는 응답의
// `citations`로 오고, 앱이 직접 쓰는 근거(계산식·식약처 DB)는 `constants/citations.ts`에 있다.
export type CitationLink = {
  title: string;
  publisher: string;
  url: string;
};

const CITATIONS_API_URL = apiUrl('/api/citations');

// 옛 서버는 이 필드를 주지 않는다 — 없거나 형식이 어긋나면 빈 배열이라 '출처' 줄만 빠진다.
// https 만 남긴다: 이 값은 그대로 브라우저로 열린다.
export function parseCitations(value: unknown): CitationLink[] {
  return Array.isArray(value) ? value.filter(isCitationLink) : [];
}

// 형식 검사 함수(isGuideAxis·isLabPanel 등)는 citations 를 보지 않는다 — 통과한 객체의 이 필드를
// 여기서 다시 읽는다.
export function withCitations<T extends { citations: CitationLink[] }>(item: T): T {
  return { ...item, citations: parseCitations(item.citations) };
}

// 여러 묶음을 순서대로 합치고 같은 url 은 한 번만 남긴다.
export function mergeCitations(...groups: CitationLink[][]): CitationLink[] {
  const seen = new Set<string>();

  return groups.flat().filter((citation) => {
    if (seen.has(citation.url)) {
      return false;
    }

    seen.add(citation.url);

    return true;
  });
}

// 서버가 쓰는 문헌 전체 — '근거와 출처' 화면이 그린다.
export async function fetchCitations(): Promise<CitationLink[]> {
  const response = await apiFetch(CITATIONS_API_URL);
  const payload = await readOk(response, '출처 목록 조회 실패');

  if (!isRecord(payload) || !Array.isArray(payload.citations)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }

  return parseCitations(payload.citations);
}

// 앱 안 브라우저로 연다. 못 열면 기기 기본 브라우저로 넘기고, 그것도 실패하면 조용히 끝낸다 —
// 링크 하나를 못 연 것으로 화면을 오류 상태로 만들 일은 아니다(주소는 인쇄 리포트에 적혀 있다).
export async function openCitation(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url).catch(() => undefined);
  }
}

function isCitationLink(value: unknown): value is CitationLink {
  return (
    isRecord(value) &&
    typeof value.title === 'string' &&
    typeof value.publisher === 'string' &&
    typeof value.url === 'string' &&
    value.url.startsWith('https://')
  );
}
