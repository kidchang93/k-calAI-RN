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

**API base는 `services/api-base.ts`가 자동 결정합니다** — Expo 개발 서버 호스트(`Constants.expoConfig.hostUri`)에서 Mac의 LAN IP를 꺼내 `http://<LAN_IP>:8000`으로 붙습니다(실기기 포함). 시뮬레이터/에뮬레이터는 `127.0.0.1`/`10.0.2.2` 폴백. 따라서 아래 `EXPO_PUBLIC_*`는 **선택적 오버라이드**(원격·터널 서버 강제용)이며 보통 설정하지 않습니다. 실기기(iPhone) 테스트는 **`docs/DEVICE_TESTING.md`** 참조.

| 변수 (오버라이드) | 리소스 경로 | 위치 |
|------|-------------|------|
| `EXPO_PUBLIC_CALORIE_API_URL` | `/api/predict` | `services/calorie-api.ts` |
| `EXPO_PUBLIC_AUTH_API_URL` | `/api/auth` | `services/auth-api.ts` |
| `EXPO_PUBLIC_HEALTH_API_URL` | `/api` | `services/health-api.ts` |
| `EXPO_PUBLIC_ONBOARDING_API_URL` | `/api` | `services/onboarding-api.ts` |
| `EXPO_PUBLIC_META_API_URL` | `/api/meta` | `services/meta-api.ts` |
| `EXPO_PUBLIC_GROUP_API_URL` | `/api/groups` | `services/group-api.ts` |
| `EXPO_PUBLIC_PET_API_URL` | `/api/pets` | `services/pet-api.ts` |
| `EXPO_PUBLIC_RECOMMENDATION_API_URL` | `/api/recommendations` | `services/recommendation-api.ts` |

기본 오리진(base)은 `services/api-base.ts`가 결정합니다(위 설명). 새 서비스는 `apiUrl('/api/…', process.env.EXPO_PUBLIC_…)` 패턴을 따르세요 — 호스트 분기를 개별 파일에 두지 않습니다.

기본값 폴백이 있어 `.env` 없이도 로컬에서 동작합니다. 오버라이드가 필요하면 `.env.example`을 `.env`로 복사해 값을 바꾸세요(`.env`는 gitignore).

---

## 서버 의존성

이 앱은 `kcalAI-model` (FastAPI) 서버를 기능 서버로 사용합니다.

| 목적 | 메서드 | 앱이 호출하는 경로 | 서버 실제 경로 | 상태 |
|------|--------|--------------------|----------------|------|
| 휴대폰 인증번호 요청 | `POST` | `/api/auth/{signup\|login}/request-code` | 동일 | 일치 |
| 휴대폰 인증번호 검증 | `POST` | `/api/auth/{signup\|login}/verify` | 동일 | 일치 |
| 로그아웃(서버 세션 폐기) | `POST` | `/api/auth/logout` | 동일 | 일치 (`auth-api.ts`, 2026-07-11 openapi.json 실측. Bearer 첨부, 실패해도 앱은 로컬 세션 삭제) |
| 음식 이미지 분류 | `POST` | `/api/predict` | 동일 | 일치 (YOLO, 한국어 라벨). 칼로리·영양은 `/api/nutrition/estimate`. (레거시 `/api/gpt-predict`는 2026-07-12 서버·앱 모두 제거) |
| 프로필·목표·끼니·체중 | — | `/api/me/**`, `/api/meals*`, `/api/weights`, `/api/nutrition/estimate` | 동일 | 일치 (`health-api.ts`. `PUT /api/meals/{meal_id}` 전체 교체 수정 포함 — 2026-07-11 user 15 실측, `logged_at` 생략 시 기존 시각 유지) |
| 칼로리·영양 추정 | `POST` | `/api/nutrition/estimate` | 동일 | 일치 (2026-07-13, `DATA_MODEL.md` **19장**). 서버가 식약처 DB에 없는 음식은 **AI로 1회 추정해 DB에 적재·동결**한다 → 같은 음식은 항상 같은 값. `source === 'llm'`이면 실측이 아닌 **AI 추정값**이라 기록 화면이 'AI 추정' 배지를 띄운다. **404** = 추정까지 실패(수동 입력) → `NutritionNotFoundError`, **503** = 추정 백엔드 일시 장애(재시도 가능) → `NutritionUnavailableError` |
| 회원 탈퇴 | `DELETE` | `/api/me` | 동일 | 일치 (`health-api.ts` `deleteAccount`, 2026-07-11 openapi.json 확인 — 물리 삭제·전 토큰 무효라 로컬 호출 실측은 하지 않는다) |
| 주/월 추이 집계 · **캘린더** | `GET` | `/api/me/trends?start_date&end_date` | 동일 | 일치 (`health-api.ts`, 2026-07-11 openapi.json·user 15 실측. Bearer 필수, 최대 92일, 초과·역순 400). 추이 탭의 **캘린더 뷰**(2026-07-13, `components/kcal-calendar.tsx`)가 같은 API를 '해당 달 1일~말일' 범위로 재사용한다 — 서버 신규 API 없음. 날짜를 누르면 `GET /api/meals?date=`로 그날 끼니를 읽는다 |
| 동의·건강 프로필·질병·알러지 | — | `/api/me/consents*`, `/api/me/{health-profile\|conditions\|allergies}` | 동일 | 일치 (`onboarding-api.ts`) |
| 선택지 참조 | `GET` | `/api/meta/options` | 동일 | 일치 (`meta-api.ts`) |
| 그룹 | — | `/api/groups`, `/api/groups/join`, `/api/groups/{id}`, `/api/groups/{id}/pets` | 동일 | 일치 (`group-api.ts`, 2026-07-10 로컬 실측) |
| 그룹 라이프사이클 | `DELETE` | `/api/groups/{id}`, `/api/groups/{id}/members/me`, `/api/groups/{id}/members/{user_id}`, `/api/groups/{id}/pets/{pet_id}` | 동일 | 일치 (`group-api.ts`, 2026-07-11 openapi.json·403/404 비파괴 실측. 파괴적 라우트는 비멤버 404 은닉, detail 한국어 — DATA_MODEL.md 17장) |
| 반려동물·급여 | — | `/api/pets`, `/api/pets/{id}`, `/api/pets/{id}/feedings` | 동일 | 일치 (`pet-api.ts`, 2026-07-10 로컬 실측. `PetResponse.recommended_kcal`(RER×MER, null 가능)은 2026-07-11 user 15 실측 — 18장) |
| 식단 추천 | `GET` | `/api/recommendations?meal_type&date` | 동일 | 일치 (`recommendation-api.ts`, 2026-07-10 로컬 실측. Bearer + sensitive_health 동의 필수 — 미동의 403) |
| 기록 시 알러지·질병 경고 판정 | `POST` | `/api/nutrition/warnings` | 동일 | 일치 (`health-api.ts`, 2026-07-11 openapi.json·user 15 실측. Bearer + sensitive_health 동의 필수 — 미동의 403. 라벨 1~10개, 해당 없으면 빈 배열) |

**모든 경로가 일치합니다.** 서버의 `ck-local` 브랜치를 `master`에 머지한 뒤(`a03ebdf`) 앱 기본값과 맞아떨어졌습니다. 그 전까지는 분류가 `/predict`였고 칼로리 계산은 미구현이었습니다.

---

## 알려진 문제 (작업 전 반드시 인지)

| # | 내용 | 근거 |
|---|------|------|
| 1 | ~~세션이 메모리에만 저장~~ **해결.** `expo-secure-store`로 영속화(`restoreAuthSession`으로 복원). 웹은 미지원이라 메모리 폴백. | `services/auth-session.ts` |
| 2 | 앱은 이제 `apiFetch`가 세션 있을 때 `Authorization: Bearer`를 붙입니다. **단, 서버에 토큰 검증 코드가 아직 없습니다** (`get_current_user` 미도입). | `services/http.ts`, `kcalAI-model/docs/DATA_MODEL.md` 4장 |
| 3 | 칼로리 프롬프트가 **앱에 하드코딩**되어 있습니다. 서버 템플릿화가 예정 항목입니다. | `services/calorie-api.ts:71` |
| 4 | ~~`readErrorMessage` 중복 정의~~ **해결.** `services/http.ts` 공통 함수로 통일(배열 `detail` 처리 포함). | `services/http.ts` |
| 5 | ~~서버 `/api/s3/*`가 `detail`에 boto3 내부 예외 노출~~ **해소.** S3 미사용 확정으로 서버에서 라우트가 제거되었습니다(`file_upload_api.py` 삭제, 2026-07-12 서버 소스 확인). 앱은 원래 호출하지 않았고, `photo_s3_key`는 `/api/meals` 응답 스키마 필드로만 남아 있습니다. | `kcalAI-model/api/` |
| 6 | ~~`themed-text.tsx`·`themed-view.tsx`·`constants/theme.ts` 다크모드 체계가 있으나 실화면은 하드코딩~~ **해소** (2026-07-12): 라이트 전용 확정으로 테마 인프라 제거. 실화면 하드코딩 팔레트가 표준. 루트 `use-color-scheme`(내비 테마용)만 유지. | — |
| 7 | ~~Expo 템플릿 잔재(`modal.tsx`·`hello-wave.tsx`·`parallax-scroll-view.tsx`·`collapsible.tsx`·`external-link.tsx`)~~ **삭제됨** (2026-07-12). `explore.tsx`(개발자 진단 화면)도 **삭제됨** (2026-07-13) — 서버 endpoint URL을 화면에 노출하고 있었습니다. 내 정보의 '개발자 정보' 진입점, 로그인 화면·기록 화면의 '연결 서버' 카드도 함께 제거했습니다. | — |
| 8 | ~~`auth-session.ts` 미커밋~~ **해소.** 커밋됨(세션 영속화·Bearer 첨부 포함). | — |

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
