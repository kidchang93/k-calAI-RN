# k-calAI-RN - Knowledge Base

> 이 문서는 Claude가 프로젝트 작업 시 실수를 방지하기 위한 엄격한 기준을 제공합니다.

## 프로젝트 개요

**k-calAI-RN**은 헬스케어 앱 안의 **이미지 기반 식단 분석 기능**을 담당하는 Expo/React Native 앱입니다. 사진 한 장으로 음식을 추정하고 예상 칼로리를 확인하는 흐름을 제공합니다.

독립적인 칼로리 계산 앱이 아니라 상위 헬스케어 앱의 기능이라는 위치를 유지합니다. 제품 맥락은 `docs/PROJECT_PLANNING.md`를 참조하세요.

### 핵심 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | Expo ~54.0.30 |
| 라우팅 | expo-router ~6.0.21 (파일 기반) |
| 런타임 | React 19.1.0, React Native 0.81.5 |
| 언어 | TypeScript ~5.9.2 (`strict: true`) |
| 네비게이션 | @react-navigation (bottom-tabs, native) |
| 이미지 입력 | expo-image-picker ~17.0.11 |
| 아이콘 | @expo/vector-icons (MaterialIcons), expo-symbols |
| 린트 | eslint 9 + eslint-config-expo (flat config) |
| 테스트 | **없음** (프레임워크 미도입) |
| 실험 기능 | `newArchEnabled`, `typedRoutes`, `reactCompiler` |

---

## 빌드 및 실행 명령어

```bash
npm install

npm start              # Expo 개발 서버
npm run ios            # iOS 시뮬레이터
npm run android        # Android 에뮬레이터
npm run web            # 웹

npm run lint           # expo lint  (확인 완료: 통과)
npx tsc --noEmit       # 타입 체크  (확인 완료: 통과)
```

| 목적 | 명령어 | 상태 |
|------|--------|------|
| 타입 체크 | `npx tsc --noEmit` | 통과 확인 |
| 린트 | `npm run lint` | 통과 확인 |
| 테스트 | 없음 | <!-- TODO: 확인 필요 - 테스트 프레임워크 미도입 --> |
| 포맷 | 없음 | Prettier 설정 없음 |

> `npm run reset-project`는 `app/`을 `app-example/`로 옮기고 빈 스캐폴드로 교체하는 **파괴적 스크립트**입니다. 절대 실행하지 마세요.

---

## 환경변수

`EXPO_PUBLIC_` 접두사가 붙은 값만 클라이언트 번들에 주입됩니다. **비밀값을 넣지 마세요.**

| 변수 | 기본값 (`Platform.OS === 'android'` ? … : …) | 위치 |
|------|---------------------------------------------|------|
| `EXPO_PUBLIC_CALORIE_API_URL` | `http://10.0.2.2:8000/api/predict` : `http://127.0.0.1:8000/api/predict` | `services/calorie-api.ts:14` |
| `EXPO_PUBLIC_CALORIE_DETAIL_API_URL` | `…/api/gpt-predict` | `services/calorie-api.ts:16` |
| `EXPO_PUBLIC_AUTH_API_URL` | `…/api/auth` | `services/auth-api.ts:25` |

Android 에뮬레이터는 호스트를 `10.0.2.2`로 봅니다. 새 엔드포인트를 추가할 때 이 분기를 빠뜨리지 마세요.

<!-- TODO: 확인 필요 - .env.example 파일이 없습니다. 추가를 권장합니다. -->

---

## 서버 의존성

이 앱은 `kcalAI-model` (FastAPI) 서버를 기능 서버로 사용합니다.

| 목적 | 메서드 | 앱이 호출하는 경로 | 서버 실제 경로 | 상태 |
|------|--------|--------------------|----------------|------|
| 휴대폰 인증번호 요청 | `POST` | `/api/auth/{signup\|login}/request-code` | 동일 | 일치 |
| 휴대폰 인증번호 검증 | `POST` | `/api/auth/{signup\|login}/verify` | 동일 | 일치 |
| 음식 이미지 분류 | `POST` | `/api/predict` | 동일 | 일치 (YOLO, 한국어 라벨) |
| 칼로리 설명 생성 | `POST` | `/api/gpt-predict` | 동일 | 일치 (HF Inference API) |

**모든 경로가 일치합니다.** 서버의 `ck-local` 브랜치를 `master`에 머지한 뒤(`a03ebdf`) 앱 기본값과 맞아떨어졌습니다. 그 전까지는 분류가 `/predict`였고 칼로리 계산은 미구현이었습니다.

---

## 알려진 문제 (작업 전 반드시 인지)

| # | 내용 | 근거 |
|---|------|------|
| 1 | 로그인 세션이 **메모리에만 저장됩니다.** 앱을 재시작/새로고침하면 로그아웃됩니다. | `services/auth-session.ts:5` (모듈 전역 변수) |
| 2 | 세션 토큰(`access_token`)을 발급받지만 **어떤 요청에도 첨부하지 않습니다.** 서버에도 토큰 검증 코드가 없습니다. | `services/*.ts`에 `Authorization` 헤더 없음 |
| 3 | 칼로리 프롬프트가 **앱에 하드코딩**되어 있습니다. 서버 템플릿화가 예정 항목입니다. | `services/calorie-api.ts:71` |
| 4 | `readErrorMessage`가 `auth-api.ts`와 `calorie-api.ts`에 **중복 정의**되어 있고 동작이 다릅니다 (`calorie-api` 버전만 배열 `detail` 처리). | 두 파일 |
| 5 | 서버의 `/api/predict`는 실패 시 `{"detail": ...}`가 아니라 **500 평문 `Internal Server Error`**를 반환합니다. `readErrorMessage`가 그 문자열을 그대로 사용자에게 보여줍니다. | `kcalAI-model/api/predict_api.py:27` |
| 6 | `components/themed-text.tsx`, `themed-view.tsx`, `constants/theme.ts`의 다크모드 체계가 있으나 **실제 화면은 하드코딩 색상을 씁니다.** | `app/(tabs)/index.tsx:311` |
| 7 | `app/(tabs)/explore.tsx`가 "Flutter 원본"을 언급합니다. Expo 템플릿 잔재(`modal.tsx`, `hello-wave.tsx`, `parallax-scroll-view.tsx`, react-logo 이미지)도 남아 있습니다. | 해당 파일들 |
| 8 | `services/auth-session.ts`가 **커밋되지 않은 상태**이며, `app/_layout.tsx`·`app/auth.tsx`·`app/(tabs)/_layout.tsx`에 미커밋 변경이 있습니다. | `git status` |

---

## 절대 하지 말아야 할 것

- **`npm run reset-project`를 실행하지 않는다.** `app/` 디렉토리를 통째로 옮깁니다.
- **`EXPO_PUBLIC_*` 환경변수에 비밀값을 넣지 않는다.** 클라이언트 번들에 평문으로 포함됩니다.
- **서버 API 경로를 앱에서만 바꾸지 않는다.** `kcalAI-model`과 같은 작업 단위에서 함께 수정합니다.
- **`Platform.OS === 'android'` 분기를 빠뜨리지 않는다.** 에뮬레이터에서 `127.0.0.1`은 에뮬레이터 자신을 가리킵니다.
- **`app/` 디렉토리에 라우트가 아닌 파일을 두지 않는다.** expo-router가 모든 파일을 라우트로 해석합니다. 컴포넌트는 `components/`에 둡니다.
- **`fetch` 응답을 검증 없이 사용하지 않는다.** 기존 코드처럼 배열/타입을 확인한 뒤 씁니다 (`calorie-api.ts:54`).
- **`services/`에 React 컴포넌트나 JSX를 넣지 않는다.** (단, `auth-session.ts`의 `useAuthSession` 훅은 기존 예외입니다.)
- **`dev_code`를 프로덕션 UI에 노출하지 않는다.** 서버가 개발 편의로 인증번호를 응답에 담아 보냅니다.
- **`app.json`의 `newArchEnabled`, `reactCompiler`를 임의로 끄지 않는다.**

---

## docs 인덱스

| 작업 | 먼저 읽을 문서 |
|------|----------------|
| 디렉토리 구조·데이터 흐름 파악 | `docs/ARCHITECTURE.md` |
| 새 화면/API 클라이언트 추가 | `docs/DESIGN.md` |
| 코드 작성 직전 | `docs/CODE_STYLE.md` |
| 리뷰·머지 전 | `docs/REVIEW.md` |
| 서브에이전트 실행 | `docs/SUBAGENTS.md` |
| 제품 기획·화면 기획·MVP 기준 | `docs/PROJECT_PLANNING.md` |

---

## 연관 저장소

`kcalAI-model` (FastAPI 추론·인증 서버) — 이 앱의 유일한 백엔드입니다.
API 계약 변경은 두 저장소를 **같은 작업 단위**에서 수정합니다.
