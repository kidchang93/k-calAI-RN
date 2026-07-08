# SUBAGENTS

## 원칙

서브에이전트에게도 이 저장소의 기준이 그대로 적용됩니다. 프롬프트에 **`CLAUDE.md` 경로와 작업 관련 docs 경로를 반드시 포함**합니다. 포함하지 않으면 에이전트는 루트 레이아웃에서 `router.replace()`를 부르거나, `interface Props`와 `any`를 쓰거나, `app/`에 헬퍼 파일을 만듭니다.

## 프롬프트에 항상 포함할 컨텍스트

```
저장소: /Users/kidchang/Desktop/ck/privacy/kcal/k-calAI-RN
먼저 읽을 것:
  - CLAUDE.md            (특히 "알려진 불일치", "절대 하지 말아야 할 것")
  - docs/ARCHITECTURE.md (디렉토리 구조, 의존성 방향)
작업별 추가:
  - 새 화면/API 클라이언트 → docs/DESIGN.md
  - 코드 작성              → docs/CODE_STYLE.md
  - 리뷰                   → docs/REVIEW.md

제약:
  - app/ 하위 파일은 전부 expo-router 라우트다. 헬퍼 파일을 두지 않는다.
  - 루트 레이아웃(app/_layout.tsx)에서 router.replace()/push() 를 호출하지 않는다.
    인증 가드는 <Redirect> 로 건다.
  - 화면은 fetch를 직접 호출하지 않는다. services/ 를 경유한다.
  - 서버 라우트는 /api/predict, /api/gpt-predict, /api/auth/**, /api/s3/** 이다.
    추가 전에 curl -sf localhost:8000/openapi.json 으로 확인한다.
  - strict TypeScript. any 금지. 서버 응답은 런타임 검증 후 사용한다.
  - 검증 명령: npx tsc --noEmit && npm run lint  (둘 다 현재 통과 중)
  - npm run reset-project 는 절대 실행하지 않는다.
```

## 역할 분담

| 역할 | 에이전트 | 도구 | 용도 |
|------|----------|------|------|
| 탐색 | `Explore` | 읽기 전용 | 컴포넌트 사용처, 호출 URL 전수 조사, 템플릿 잔재 식별 |
| 설계 | `Plan` | 읽기 전용 | 화면 추가 계획, 세션 영속화 전략 |
| 구현 | `general-purpose` | 전체 | 파일 수정이 필요한 작업 |
| 리뷰 | `general-purpose` | 읽기 위주 | `docs/REVIEW.md` 체크리스트 적용 |

## 병렬화 기준

### 병렬로 안전한 작업

- 서로 다른 화면 파일 수정 (`app/(tabs)/index.tsx` vs `app/auth.tsx`)
- 서로 다른 서비스 모듈 수정 (`services/auth-api.ts` vs `services/calorie-api.ts`)
- 읽기 전용 조사 전반 (호출 URL 목록화, `any` 사용처 탐색, 미사용 컴포넌트 식별)
- 앱 저장소와 서버 저장소(`kcalAI-model`)를 각각 조사

### 반드시 순차로 해야 하는 작업

| 작업 | 이유 |
|------|------|
| `app/_layout.tsx` 수정 | 인증 가드·ThemeProvider·Stack 등록이 한 파일에 모여 있습니다 |
| `app/(tabs)/_layout.tsx` 수정 | 탭 등록 지점. 동시 편집 시 덮어씁니다 |
| `services/auth-session.ts` 수정 | 세션 스토어. `_layout.tsx`와 `auth.tsx`가 동시에 의존합니다 |
| `readErrorMessage` 공통화 | 두 서비스 파일을 함께 건드립니다 |
| `constants/theme.ts` + 화면 색상 토큰화 | 토큰 정의가 먼저 확정되어야 합니다 |
| `package.json` 의존성 추가 | `package-lock.json`이 충돌합니다 |
| 새 화면 추가 (화면 파일 → 탭 등록) | 뒤 단계가 앞 단계에 의존합니다 |

**파일 단위로 소유권을 나눌 수 없으면 병렬화하지 않습니다.**

### worktree 격리

여러 에이전트가 동시에 파일을 쓰는 구현 작업에만 `isolation: "worktree"`를 씁니다. `node_modules/`가 worktree에 복제되지 않으므로 **worktree에서 `tsc`/`lint`/`expo start`를 실행할 수 없습니다.** 검증은 메인 워크트리로 병합한 뒤 수행합니다.

## 결과물 검수

서브에이전트 결과를 반영하기 전에 다음을 직접 확인합니다. 에이전트의 "완료했습니다" 보고를 그대로 신뢰하지 않습니다.

1. `npx tsc --noEmit` → exit 0.
2. `npm run lint` → exit 0.
3. `docs/CODE_STYLE.md`의 **금지 패턴 표**에 걸리는 코드가 없는가. 특히 `any`, `interface Props`, `{cond && <JSX/>}`, 상대 경로 import.
4. `docs/REVIEW.md`의 **레이어 / 플랫폼 / API 계약** 체크리스트를 통과하는가.
5. 새 색상이 `docs/DESIGN.md` 팔레트 밖에서 추가되지 않았는가.
6. 호출하는 서버 경로가 실제로 존재하는가.
7. UI 변경이라면 시뮬레이터에서 렌더 확인. **(에이전트가 아니라 사람이 확인)**

## 에이전트에게 시키지 말 것

- **`npm run reset-project` 실행.** `app/` 디렉토리를 파괴적으로 이동합니다.
- **`expo start` / 시뮬레이터 기동.** 대화형이며 종료되지 않습니다. 필요하면 사용자에게 `! npm run ios` 실행을 요청합니다.
- **템플릿 잔재 일괄 삭제.** `modal.tsx`, `hello-wave.tsx`, `parallax-scroll-view.tsx`, `collapsible.tsx`, react-logo 이미지의 삭제 범위는 제품 결정입니다. 사용자에게 확인합니다.
- **`/api/gpt-predict` 관련 코드를 "고치기".** 서버에 엔드포인트가 없습니다. 앱만 수정해도 동작하지 않습니다.
- **미커밋 변경(`services/auth-session.ts`, `app/_layout.tsx`, `app/auth.tsx`) 되돌리기.**
- **`package.json` 의존성 버전 임의 변경.** Expo SDK 54가 버전을 고정합니다.

## 두 저장소를 함께 다루는 세션

`k-calAI-RN`과 `kcalAI-model`은 하나의 기능 체인입니다. API 계약을 건드리는 세션에서는 두 저장소를 함께 엽니다.

```
Explore  →  앱이 호출하는 URL 전수 조사   (k-calAI-RN)
Explore  →  서버 라우트 전수 조사         (kcalAI-model)   ← 병렬 가능
         ↓
        diff 확인 후 사용자에게 계약 확정 요청
         ↓
general-purpose → 앱 수정     ┐
general-purpose → 서버 수정   ┘  ← 계약 확정 후에만, 순차 또는 파일 소유권 분리
```

계약이 확정되기 전에 구현 에이전트를 띄우지 않습니다.
