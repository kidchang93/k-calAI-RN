// 앱이 직접 쓰는 근거의 원문 링크 (2026-10-20 App Store 1.4.1 반려 대응). 서버가 쓰는 근거(학회 지침
// 등)는 서버 응답의 `citations`로 온다 — 여기에는 서버가 모르는 것만 둔다. 모양은
// `services/citations.ts`의 `CitationLink`와 같다(constants 는 다른 레이어를 import 하지 않는다).
// 두 URL 모두 2026-10-20에 열리는 것을 확인했다.

// 목표 칼로리의 기초대사량 계산식 (`components/goal-form.tsx`, 서버 DATA_MODEL 5장).
export const MIFFLIN_CITATION = {
  title: 'A new predictive equation for resting energy expenditure in healthy individuals (Mifflin-St Jeor)',
  publisher: 'Am J Clin Nutr 1990',
  url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
};

// 칼로리·영양값의 원천 (`constants/ai-notice.ts`의 고지문이 말하는 DB).
export const MFDS_DB_CITATION = {
  title: '식품영양성분 데이터베이스',
  publisher: '식품의약품안전처',
  url: 'https://various.foodsafetykorea.go.kr/nutrient/',
};
