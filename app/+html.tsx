import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// 웹 정적 렌더링의 HTML 껍데기. **라우트가 아니다** — `+html`은 expo-router 예약 파일명이라
// `app/` 안에 있어도 화면이 생기지 않는다(app/ 에 라우트만 둔다는 규칙의 유일한 예외).
// 웹에서만 쓰이고 네이티브 번들에는 포함되지 않는다.
//
// 이 파일을 만든 이유는 **브라우저 탭 제목이 비어 있었기 때문**이다(2026-08-18 확인).
// `app.json`의 `expo.name`은 네이티브 앱 이름이라 웹 문서 title 로 가지 않는다. 이 앱은
// 웹이 주 무대라(FastAPI 가 webapp/ 서빙, 결제도 웹 전용) 탭에 서비스명이 없으면
// 즐겨찾기·여러 탭 사용에서 무엇인지 알 수 없다.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* 런타임에는 각 화면의 `options.title`이 이 값을 덮어쓴다(루트 Stack 에서 지정).
            여기 값은 정적 HTML 의 기본값이라 자바스크립트가 뜨기 전에도 이름이 보인다. */}
        <title>케어테이블</title>
        <meta
          name="description"
          content="만성질환 식이돌봄 서비스. 질환별 식이기준에 맞춰 식사를 기록하고, 검사 수치와 함께 진료용 리포트로 정리합니다."
        />

        {/* 스크롤 컨테이너를 body 가 아니라 ScrollView 로 두는 기본 리셋 (expo-router 제공).
            빼면 웹에서 body 스크롤과 화면 스크롤이 겹쳐 어긋난다. */}
        <ScrollViewStyleReset />

        {/* 번들이 뜨기 전 흰 화면이 번쩍이지 않도록 배경을 미리 칠한다 —
            값은 루트 레이아웃 NAV_THEME.background 와 같은 값이다 (docs/DESIGN.md). */}
        <style dangerouslySetInnerHTML={{ __html: BACKGROUND_STYLE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const BACKGROUND_STYLE = `body { background-color: #f7f6f4; }`;
