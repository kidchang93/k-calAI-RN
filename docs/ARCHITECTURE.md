# ARCHITECTURE

## 디렉토리 구조

```
k-calAI-RN/
├── app/                        # expo-router 파일 기반 라우트 (이 안의 파일 = 화면)
│   ├── _layout.tsx             # 루트 Stack + ThemeProvider + 인증 가드
│   ├── auth.tsx                # 카카오 로그인 + 신규 회원 동의·요금제 (initialRouteName, 딥링크 kcalairn://auth 목적지)
│   ├── (tabs)/
│   │   ├── _layout.tsx         # 하단 탭 (홈 / 기록 / 추이 / 내 정보) + 온보딩 게이트
│   │   ├── home.tsx            # 홈 탭 - 오늘 요약 (그룹 진입점)
│   │   ├── index.tsx           # 기록 탭 - '오늘 기록 만들기' 런처 (사진/검색·직접입력 → compose로 진입)
│   │   ├── trends.tsx          # 추이 탭 - 주/월 섭취 kcal 바 차트 + 요약 + 체중 변화
│   │   ├── account.tsx         # 내 정보 탭 (프로필·목표 요약, 체중·질병·알러지·반려동물 진입점, 로그아웃·회원 탈퇴)
│   ├── onboarding/             # 온보딩 스택 (consent → body → …)
│   ├── groups/                 # 그룹 스택 (홈에서 진입)
│   │   ├── _layout.tsx         # 인증 가드 (온보딩 레이아웃과 같은 패턴)
│   │   ├── index.tsx           # 내 그룹 목록
│   │   ├── create.tsx          # 그룹 생성
│   │   ├── join.tsx            # 초대코드로 참여
│   │   └── [id].tsx            # 그룹 상세 (멤버·펫·초대코드 공유·내 펫 공유·나가기·삭제·멤버 제거·펫 참여 해제)
│   ├── pets/                   # 반려동물 스택 (내 정보에서 진입)
│   │   ├── _layout.tsx         # 인증 가드
│   │   ├── index.tsx           # 내 반려동물 목록
│   │   ├── new.tsx             # 등록
│   │   └── [id]/
│   │       ├── index.tsx       # 상세 + 오늘 급여 기록·목록 + 삭제
│   │       └── edit.tsx        # 수정 (전체 교체 PUT)
│   ├── me/                     # 내 정보 하위 스택 (내 정보 탭에서 진입)
│   │   ├── _layout.tsx         # 인증 가드
│   │   ├── profile.tsx         # 프로필 수정 (GET/PUT /api/me/profile)
│   │   ├── goal.tsx            # 목표 수정 (GET/PUT /api/me/goal, 홈 목표 CTA에서도 진입)
│   │   ├── weights.tsx         # 체중 기록 (POST/GET /api/weights)
│   │   ├── conditions.tsx      # 질병 정보 수정 (GET/PUT /api/me/conditions, 칩 + 메타 폴백)
│   │   └── allergies.tsx       # 알러지 정보 수정 (GET/PUT /api/me/allergies, severity 보존)
│   ├── plan.tsx                # 요금제 (내 정보에서 진입). 내 플랜·오늘 인식 사용량·3종 비교·변경
│   ├── meals/                  # 끼니 기록 목록·구성 (홈 끼니 카드·캘린더·기록 탭에서 진입)
│   │   ├── _layout.tsx         # 인증 가드
│   │   ├── index.tsx           # 날짜별 기록 목록 + 삭제 + 인라인 수정 + '기록 추가'·'끼니에 항목 추가' 진입점
│   │   └── compose.tsx         # 끼니 구성 — 한 끼니에 다중 항목(사진 foods[]/DB검색/직접입력), 신규·append(meal_id) 저장
│   └── recommendations/        # 식단 추천 스택 (홈에서 진입)
│       ├── _layout.tsx         # 인증 가드
│       └── index.tsx           # 끼니 선택 + 오늘 추천 목록
├── services/                   # 외부 통신 + 앱 전역 상태
│   ├── auth-api.ts             # 카카오 로그인 API 클라이언트 (expo-web-browser로 서버 start URL 오픈 → 딥링크 파싱. 발급 전 순수 fetch, logout만 apiFetch로 Bearer 첨부)
│   ├── auth-session.ts         # 세션 싱글톤 + 영속화(SecureStore) + useAuthSession 훅
│   ├── calorie-api.ts          # 추론/칼로리 API 클라이언트
│   ├── health-api.ts           # 프로필·목표·끼니·체중 (DATA_MODEL.md 3~5장)
│   ├── onboarding-api.ts       # 동의·건강 프로필·질병·알러지 (7장)
│   ├── meta-api.ts             # 선택지 참조 (10장)
│   ├── group-api.ts            # 그룹 (9장)
│   ├── pet-api.ts              # 반려동물·급여 기록 (9장)
│   ├── recommendation-api.ts   # 식단 추천 (11·13장)
│   ├── subscription-api.ts     # 요금제·구독 (GET /api/plans 무인증, GET·PUT /api/me/subscription) + FALLBACK_PLANS
│   ├── http.ts                 # 공통 fetch 래퍼(apiFetch) + readErrorMessage + PlanLimitError(402)
│   └── api-base.ts             # API 오리진 결정(Expo hostUri→LAN IP 자동, 실기기 도달). apiUrl()
├── components/                 # 재사용 UI
│   ├── session-loading.tsx     # 세션 복원 대기 화면 (인증 가드 깜빡임 방지)
│   ├── error-banner.tsx        # 오류 배너 + 다시 시도
│   ├── plan-limit-banner.tsx   # 402 안내 배너 + 요금제 화면 유도 (재시도 대신 업그레이드)
│   ├── back-button.tsx         # 탭 밖 스택 화면(그룹·펫)의 뒤로가기
│   ├── pet-form.tsx            # 반려동물 등록·수정 공용 폼 (services 미의존, 구조적 타입)
│   ├── chip-group.tsx, meal-type-card.tsx, progress-ring.tsx, onboarding-progress.tsx
│   ├── haptic-tab.tsx          # 탭 햅틱
│   └── ui/
│       └── icon-symbol.tsx / icon-symbol.ios.tsx  # 플랫폼 분기
├── hooks/
│   └── use-color-scheme.ts / use-color-scheme.web.ts   # 루트 ThemeProvider(내비 라이트/다크)용
├── assets/images/
└── scripts/reset-project.js    # 파괴적 - 실행 금지
```

## 의존성 방향

```
app/  ──→  components/  ──→  hooks/  ──→  constants/
  │             │
  └─────────────┴──→  services/
```

| 레이어 | 책임 | 의존해도 되는 것 | 의존하면 안 되는 것 |
|--------|------|------------------|---------------------|
| `app/` | 화면, 라우팅, 로컬 UI 상태 | 전부 | — |
| `components/` | 표시 전용 UI | `hooks/`, `constants/` | `app/`, `services/` |
| `services/` | HTTP, 응답 검증, 세션 | 없음 (RN `Platform`만) | `app/`, `components/` |
| `hooks/` | 테마·색상 훅 | `constants/` | `app/`, `services/` |
| `constants/` | 색상·폰트 토큰 | 없음 | 전부 |

경로 별칭: `@/*` → 프로젝트 루트 (`tsconfig.json`). 상대 경로 `../../`를 쓰지 않고 `@/services/calorie-api` 형태로 import 합니다.

## 라우팅

expo-router의 파일 기반 라우팅입니다. `app/` 하위 파일이 곧 경로입니다.

| 파일 | 경로 | 비고 |
|------|------|------|
| `app/auth.tsx` | `/auth` | `unstable_settings.initialRouteName = 'auth'` |
| `app/(tabs)/home.tsx` | `/home` | 로그인 직후 진입 탭. 그룹 진입점 |
| `app/(tabs)/index.tsx` | `/` | 그룹 `(tabs)`는 URL에 나타나지 않음 |
| `app/(tabs)/trends.tsx` | `/trends` | 주/월 토글 + 일별 섭취 바 차트(`GET /api/me/trends`) + 체중 변화(`GET /api/weights` 기간 필터) |
| `app/(tabs)/account.tsx` | `/account` | 반려동물 진입점 |
| `app/onboarding/*.tsx` | `/onboarding/…` | 인증 가드 레이아웃 |
| `app/groups/index.tsx` | `/groups` | 내 그룹 목록 |
| `app/groups/create.tsx` | `/groups/create` | 그룹 생성 |
| `app/groups/join.tsx` | `/groups/join` | 초대코드로 참여 |
| `app/groups/[id].tsx` | `/groups/:id` | 그룹 상세. `router.push({ pathname: '/groups/[id]', params })` |
| `app/pets/index.tsx` | `/pets` | 내 반려동물 목록 |
| `app/pets/new.tsx` | `/pets/new` | 등록 |
| `app/pets/[id]/index.tsx` | `/pets/:id` | 상세 + 급여 기록 |
| `app/pets/[id]/edit.tsx` | `/pets/:id/edit` | 수정 |
| `app/recommendations/index.tsx` | `/recommendations` | 식단 추천 (홈에서 진입, 인증 가드 레이아웃) |
| `app/me/profile.tsx` | `/me/profile` | 프로필 수정 (내 정보 탭에서 진입) |
| `app/me/goal.tsx` | `/me/goal` | 목표 수정 (내 정보 탭·홈 목표 CTA에서 진입) |
| `app/me/weights.tsx` | `/me/weights` | 체중 기록 입력 + 최근 목록 |
| `app/me/conditions.tsx` | `/me/conditions` | 질병 정보 수정 (내 정보 탭에서 진입) |
| `app/me/allergies.tsx` | `/me/allergies` | 알러지 정보 수정 (내 정보 탭에서 진입, 기존 severity 보존) |
| `app/meals/index.tsx` | `/meals?date=YYYY-MM-DD` | 날짜별 끼니 기록 목록 + 삭제 + 인라인 수정 (홈 끼니 카드·캘린더에서 진입, 날짜 파라미터 유지) |
| `app/meals/compose.tsx` | `/meals/compose?date=&meal_type=&meal_id=&photoUri=…` | 끼니 구성(다중 항목). `meal_id` 있으면 append 모드(PUT 전체 교체), 없으면 신규(POST + `logged_at` 앵커). 기록 탭·캘린더·기록 목록에서 진입 |
| `app/plan.tsx` | `/plan` | 요금제 (내 정보에서 진입, 402 배너의 업그레이드 버튼 목적지). 레이아웃 없는 단일 라우트라 화면 자신이 `<Stack.Screen options={{ headerShown: false }} />` + `<Redirect>` 가드를 건다 |

`groups/`·`pets/`·`recommendations/`·`me/`·`meals/` 스택은 루트 레이아웃에 등록하지 않고 (expo-router 자동 등록) 각 `_layout.tsx`가
온보딩 레이아웃과 같은 방식으로 자기 헤더를 숨기고 인증 가드를 겁니다. 화면 상단의 뒤로가기는
네이티브 헤더 대신 `components/back-button.tsx`를 씁니다 (탭 밖 스택 공통).

> `.expo/types/router.d.ts`(typedRoutes 생성물)는 `expo start` 시 재생성됩니다. 새 라우트를 추가하고
> 개발 서버를 띄우지 않은 채 `npx tsc`를 돌리려면 이 파일에 라우트가 반영되어 있어야 합니다.

`app.json`의 `experiments.typedRoutes: true`로 `router.replace('/auth')` 같은 호출이 타입 체크됩니다.

## 인증 가드

각 라우트가 `<Redirect>`로 **선언형** 가드를 겁니다. 루트 레이아웃은 네비게이션에 관여하지 않습니다.

`useAuthSession()`은 3-상태 판별 유니온(`AuthSessionState`)을 반환합니다.

```
{ status: 'loading' }                          복원 중 (아직 판단 불가)
{ status: 'authenticated', session }           세션 있음
{ status: 'unauthenticated' }                  세션 없음

app/(tabs)/_layout.tsx   loading → <SessionLoading/>,  unauthenticated → <Redirect href="/auth" />
app/auth.tsx             loading → <SessionLoading/>,  authenticated   → <Redirect href="/(tabs)" />
```

**복원 중(`loading`)에는 리다이렉트하지 않습니다.** 앱 시작 시 `restoreAuthSession()`이 SecureStore에서 세션을 읽는 동안 `status`가 `loading`이고, 이때 `null`(미인증)로 간주해 로그인으로 튕기면 이미 로그인된 사용자가 깜빡입니다. 두 가드 모두 `loading`이면 `components/session-loading.tsx`를 그리고 판단을 미룹니다.

루트 레이아웃(`app/_layout.tsx`)은 `useEffect`에서 `restoreAuthSession()`만 호출합니다. **네비게이션은 하지 않습니다** — 복원이 끝나 `hydrated`가 켜지면 스토어 리스너가 각 가드를 리렌더하고, 가드가 `<Redirect>`로 스스로 이동합니다.

로그인 성공 시 `setAuthSession()`이 세션 스토어 리스너를 깨우고, `auth.tsx`가 리렌더되면서 `<Redirect>`가 탭으로 넘깁니다. 명령형 `router.replace()`는 쓰지 않습니다.

**루트 레이아웃(`app/_layout.tsx`)에서 `useEffect` + `router.replace()`로 가드를 걸면 안 됩니다.** 그 effect는 네비게이터가 마운트되기 전에 실행될 수 있고, expo-router의 `assertIsReady()`가 다음 예외를 던집니다.

```
Attempted to navigate before mounting the Root Layout component.
Ensure the Root Layout component is rendering a Slot, or other navigator on the first render.
```

`<Redirect>`는 `useFocusEffect` 안에서 동작하므로 화면이 실제로 마운트·포커스된 뒤에만 이동하며, 내부적으로 `try/catch`까지 걸려 있어 이 예외가 구조적으로 발생하지 않습니다.

## 세션 상태

`services/auth-session.ts`는 **모듈 전역 변수 + 리스너 Set** 기반의 경량 스토어입니다. Context나 상태 라이브러리를 쓰지 않습니다.

```
currentSession: AuthTokenResponse | null   (모듈 스코프)
hydrated: boolean                          (복원 완료 여부)
listeners: Set<() => void>

setAuthSession(s)     → currentSession = s → notify() → SecureStore 저장(비웹)
clearAuthSession()    → currentSession = null → notify() → SecureStore 삭제(비웹)
restoreAuthSession()  → SecureStore 읽기 → currentSession 복원 → hydrated = true → notify()
useAuthSession()      → useState(스냅샷) + useEffect로 listener 등록 → AuthSessionState 반환
```

**영속화: `expo-secure-store`.** `setAuthSession`/`clearAuthSession`이 저장·삭제하고, 앱 시작 시 `restoreAuthSession()`이 복원합니다. 저장 전 `isAuthTokenResponse`로 파싱값을 런타임 검증합니다.
**웹 폴백:** `expo-secure-store`는 web 미지원이라 `Platform.OS === 'web'`이면 저장을 건너뛰고 메모리만 씁니다(재시작 시 로그아웃). 웹은 정식 지원 대상이 아닙니다.
**토큰 첨부:** `access_token`은 `services/http.ts`의 `apiFetch`가 세션이 있을 때 `Authorization: Bearer`로 붙입니다. 인증 API(`auth-api.ts`)는 순수 `fetch`를 써 헤더를 붙이지 않습니다.

## 데이터 흐름

### 인증 — 카카오 로그인 (`app/auth.tsx`, 2026-07-14)

로그인/회원가입 탭이 없습니다. **카카오가 신규(`is_new`)를 알려주므로** 앱이 미리 물어볼 이유가 없습니다.

```
[카카오로 시작하기]
  └─ startKakaoLogin()
       └─ WebBrowser.openAuthSessionAsync(
            `{AUTH_API_URL}/kakao/start?platform=native|web`, 'kcalairn://auth')
            → 서버 302 → 카카오 동의 → 카카오 → 서버 콜백 → 딥링크 복귀
       └─ Linking.parse(result.url)
            ← code=<1회용 연동코드>&is_new=true|false        (성공)
            ← error=cancelled|invalid_state|expired|kakao_unavailable   (실패)
              cancelled → KakaoCancelledError (에러 배너 없이 조용히 원상복귀)
              그 외      → 한국어 메시지 Error

  ├─ is_new=false ─ loginWithKakao(link_code)
  │                   └─ POST {AUTH_API_URL}/kakao/login  { link_code }
  │                        ← { access_token, token_type, expires_at, user }
  │                        404 → KakaoNotRegisteredError → 가입 단계로 이어 붙임
  │                        400 → KakaoLinkExpiredError    → 처음부터 다시
  │
  └─ is_new=true ── (같은 화면에서 동의 2종 + 요금제 카드 3종)
                      └─ signupWithKakao(link_code, { agreed_terms, agreed_privacy, plan_code })
                           └─ POST {AUTH_API_URL}/kakao/signup
                                400 → KakaoLinkExpiredError (TTL 10분 초과·1회용 소비)
                                      → 화면이 'kakao' 단계로 되돌리고 재시도를 안내

  └─ setAuthSession(result)   → SecureStore 저장 + 스토어 notify
       └─ auth.tsx 리렌더 → <Redirect href="/(tabs)" /> (router.replace 아님)
```

연동 코드는 **1회용·TTL 10분**입니다 (서버 `auth_service.LINK_CODE_TTL_MINUTES`). 요금제 목록은 가입 단계에 진입할 때만 `GET /api/plans`(무인증)로 읽고, 실패하면 번들 폴백(`FALLBACK_PLANS`)으로 그립니다 — 네트워크 오류로 가입이 막히면 안 됩니다.

**웹:** `platform=web`으로 열면 서버가 같은 오리진의 `/auth?…`로 되돌립니다. 팝업이 결과를 부모 창에 넘기도록 `app/auth.tsx`가 마운트 시 `completeKakaoAuthSession()`(`WebBrowser.maybeCompleteAuthSession()`)을 호출합니다 (네이티브 no-op).

### 식단 분석 · 끼니 구성 (2026-07-16, 다중 항목)

기록 탭(`app/(tabs)/index.tsx`)은 **런처**다. 사진을 고르거나 '검색·직접 입력'을 누르면 오늘 날짜로
**끼니 구성 화면**(`app/meals/compose.tsx`)에 진입한다. 실제 분석·구성·저장은 compose 한 곳에 있다 —
과거 날짜(캘린더)·기존 끼니에 항목 추가(기록 목록)와 같은 로직을 공유한다.

```
기록 탭 (런처)
  └─ pickFromCamera/Library → router.push('/meals/compose',
        { date: 오늘, photoUri, photoName?, photoMime? })
  └─ '검색·직접 입력으로 추가' → router.push('/meals/compose', { date: 오늘 })

app/meals/compose.tsx   params: date, meal_type?, meal_id?(=append), photoUri?
  ├─ (append) getMeals(date) → meal_id의 기존 항목 로드 (전체 교체 PUT에 그대로 다시 보냄)
  ├─ (photoUri 있으면) 마운트 시 1회 자동 분석
  │
  ├─ analyzePhoto(asset)                       # 사진당 쿼터 1건
  │    └─ uploadFoodPhoto → POST /api/predict
  │         ← { foods: [{ label, score, portion_g }], vision_used, vision_limit }
  │            (foods 없으면 predictions를 foods로 수용 — 전환기 대비)
  │    └─ 각 food → estimateNutrition(food.label)   # 쿼터 0, 병렬. 일부 실패해도 나머지 살림
  │         성공 → 초안(source:'ai', kcalText=matched kcal_per_serving)
  │         실패(404/503) → 초안(kcal 비움 → 직접 입력 유도)
  │
  ├─ addBySearch(name)                         # 쿼터 0
  │    └─ estimateNutrition(name) → 초안(source:'manual')
  │         404 → 입력 이름으로 빈 kcal 초안 + 안내
  ├─ addManual()                               # 빈 초안(source:'manual') → 인라인 입력
  │
  ├─ 각 초안: 이름·1인분 kcal·섭취량(chips) 개별 수정 / 삭제. 항목 kcal = round(perServing × ratio)
  ├─ checkFoodWarnings(현재 초안 라벨들)         # 추가·삭제 시 백그라운드, 실패는 조용히 스킵
  │
  └─ saveMeal()
       신규:  createMeal({ meal_type, logged_at: `${date}T12:00:00Z`, items })  # UTC 정오 앵커
       append: updateMeal(meal_id, { meal_type: 기존, items: [기존…, 신규…] })  # logged_at 생략
       └─ router.back()   # 이전 화면(캘린더·기록 목록·기록 탭)이 useFocusEffect로 재조회
```

**`logged_at` UTC 앵커:** 서버는 끼니 하루를 **UTC 자정**으로 나눈다(`GET /api/meals?date=`도 UTC 날짜로 필터).
캘린더 셀 `D`에 추가한 끼니가 그 셀에서 다시 보이려면 `logged_at`의 UTC 날짜가 `D`여야 하므로,
`services/health-api.ts`의 `dayAnchorLoggedAt(date)`가 `D`의 **정오(UTC)**로 앵커한다(타임존 무관 고정).

> 레거시 `requestCalorieDetail`(`/api/gpt-predict`)은 2026-07-12에 제거됐습니다. 칼로리·영양은
> `/api/nutrition/estimate`(식약처 DB)를 씁니다. `/api/predict` 응답은 2026-07-16에 `predictions`→`foods`로 바뀌었습니다.

## 오류 처리 흐름

`services/*.ts`의 각 함수는 `!response.ok`일 때 `readErrorMessage(response)`로 서버 메시지를 뽑아 `Error`를 던집니다.

```
readErrorMessage(response)
  └─ text() → 비었으면 ''
  └─ JSON.parse 시도
       ├─ data.detail이 배열   → item.msg 를 '\n'으로 join   (Pydantic 422 대응, calorie-api만)
       ├─ data.detail 존재     → String(data.detail)
       └─ parse 실패           → 원문 text
```

화면은 `catch`에서 `error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'`로 받아 `errorMessage` 상태에 넣고 배너로 표시합니다.

**402(요금제 한도)는 예외입니다.** `apiFetch`가 응답 본문을 `PlanLimitError`(`message`·`resource`·`plan`·`limit`)로 바꿔 던지므로, 개별 서비스 함수는 402를 다루지 않습니다. 화면은 `catch`에서 `instanceof PlanLimitError`를 먼저 판별해 **재시도 버튼이 있는 `ErrorBanner` 대신** `PlanLimitBanner`(→ `/plan`)를 그립니다 — 한도 초과는 재시도로 풀리지 않기 때문입니다.

`readErrorMessage`는 `services/http.ts`의 **공통 함수**입니다 (배열 `detail` = Pydantic 422 처리 포함). `auth-api.ts`·`calorie-api.ts`가 이를 import 합니다. 과거의 중복 정의는 제거되었습니다.

## 플랫폼 분기

| 분기 방식 | 위치 |
|-----------|------|
| 파일명 접미사 (`.ios.tsx`, `.web.ts`) | `components/ui/icon-symbol.ios.tsx`, `hooks/use-color-scheme.web.ts` |
| `Platform.OS` 런타임 분기 | `services/*.ts`의 기본 URL, `calorie-api.ts`의 FormData 구성 |

## 외부 시스템

| 시스템 | 용도 | 접점 |
|--------|------|------|
| `kcalAI-model` (FastAPI) | 인증, 이미지 분류, 칼로리 설명 | `services/auth-api.ts`, `services/calorie-api.ts` |
| OS 카메라 / 사진 라이브러리 | 이미지 입력 | `expo-image-picker` (권한 문구는 `app.json`) |

### 서버 계약

| 앱 함수 | 경로 | 요청 | 응답 |
|---------|------|------|------|
| `uploadFoodPhoto` | `POST /api/predict` | `multipart/form-data`, `file` | `{ foods: [{ label, score, portion_g }], vision_used, vision_limit }` — 사진 속 **서로 다른 음식들**(후보 나열이 아님), 라벨은 **한국어**, 최대 10. `portion_g`·사용량 2종은 `number \| null`로 좁혀 받고, `foods` 없으면 `predictions`를 foods로 수용(전환기). 쿼터는 **사진당 1건**, 초과 시 **402**(`PlanLimitError`) |
| `startKakaoLogin` | `GET /api/auth/kakao/start?platform=native\|web` | — (브라우저가 연다) | 302 → 카카오 → 서버 콜백 → 딥링크 `kcalairn://auth?code=…&is_new=…` 또는 `?error=…`. 앱은 `expo-web-browser`만 쓴다 (네이티브 카카오 SDK 없음) |
| `loginWithKakao` | `POST /api/auth/kakao/login` | `{ link_code }` | `{ access_token, token_type, expires_at, user }`. **404 = 미가입**(`KakaoNotRegisteredError`), **400 = 연동 코드 만료·소비**(`KakaoLinkExpiredError`) |
| `signupWithKakao` | `POST /api/auth/kakao/signup` | `{ link_code, agreed_terms, agreed_privacy, plan_code \| null }` | 같은 `AuthTokenResponse`. 동의 누락 422, `false` 400. `plan_code` 생략 시 서버가 무료(lite) 부여. 연동 코드 TTL 10분 초과 시 400 |
| `fetchPlans` | `GET /api/plans` | — | `{ plans: [{ code, label, price_krw, daily_vision_quota, max_group_members, max_pets, max_owned_groups }] }`. **무인증**(가입 화면이 로그인 전에 호출) — 실패 시 `FALLBACK_PLANS`(번들 폴백)로 그린다 |
| `fetchMySubscription` / `changePlan` | `GET·PUT /api/me/subscription` | PUT: `{ plan_code }` | `{ plan, vision_usage: { used, limit, remaining, resets_at }, started_at }`. **결제 미연동** — PUT은 영수증 검증 없이 즉시 반영된다(화면이 이 사실을 명시) |
| `updateMeal` | `PUT /api/meals/{meal_id}` | `createMeal`과 동일 구조 (전체 교체) | `MealLog`. `logged_at` 생략 시 기존 기록 시각 유지, `total_kcal`은 서버가 items 합계로 재계산. 남의 끼니·삭제된 끼니 404 (DATA_MODEL.md 4장) |
| `deleteAccount` | `DELETE /api/me` | — | `{ message }`. **물리 삭제** — 끼니·체중·펫·소유 그룹 전부 파기, 전 토큰 즉시 무효. 성공 시에만 호출부가 `clearAuthSession()` (DATA_MODEL.md 18장) |
| `createGroup` / `getGroups` / `joinGroup` | `POST·GET /api/groups`, `POST /api/groups/join` | `{ name, kind }` / — / `{ invite_code }` | `GroupSummary` (생성·목록·참여 동일 형태) |
| `getGroupDetail` | `GET /api/groups/{id}` | — | 상세 + `members[]`(**`nickname`** = 카카오 닉네임. 2026-07-14 이전의 `phone_number_masked`를 대체. 닉네임이 없으면 서버가 '이름 미설정'을 준다) + `pets[]` |
| `attachPetToGroup` | `POST /api/groups/{id}/pets` | `{ pet_id }` | `{ message }` — 그룹 멤버이면서 펫 소유자만 |
| `leaveGroup` / `deleteGroup` / `removeMember` / `detachPetFromGroup` | `DELETE /api/groups/{id}/members/me`, `DELETE /api/groups/{id}`, `DELETE /api/groups/{id}/members/{user_id}`, `DELETE /api/groups/{id}/pets/{pet_id}` | — | `{ message }`. 소유자 탈퇴 400("그룹 삭제로 진행" 안내), 비소유 삭제·제거 403, 비멤버는 404 (존재 은닉). 펫·급여 기록은 어떤 라우트에서도 삭제되지 않는다 (DATA_MODEL.md 17장) |
| `createPet` / `getPets` / `updatePet` / `deletePet` | `POST·GET /api/pets`, `PUT·DELETE /api/pets/{id}` | `PetUpsertRequest` | `PetResponse` — `recommended_kcal`(RER×MER 서버 계산, `weight_kg` 없거나 `other` 종이면 null) 포함 (18장). 남의 펫은 404 (존재 은닉). 단건 조회 API 없음 — 상세 화면은 목록에서 찾는다 |
| `createFeeding` / `getFeedings` | `POST·GET /api/pets/{id}/feedings` | `{ food_label, amount_g, kcal?, fed_at? }` | `FeedingResponse`. 권한 = 소유자 또는 펫이 참여한 그룹의 멤버 |
| `getRecommendation` | `GET /api/recommendations?meal_type&date` | 쿼리 파라미터 | `{ meal_type, rec_date, items[], excluded[], cached, disclaimer }`. `excluded`는 판별 유니온(`allergen`/`condition`/`filtered`), `items`는 빈 배열 가능. 미동의 403 → `ConsentRequiredError`. `disclaimer`는 서버 문자열을 그대로 표시 |
| `getTrends` | `GET /api/me/trends?start_date&end_date` | 쿼리 파라미터 (YYYY-MM-DD) | `{ start_date, end_date, target_kcal: number\|null, days[] }`. `days`는 범위 내 전 날짜 오름차순(빈 날 0). 역순·92일 초과는 400 + 한국어 `detail`. 체중은 포함하지 않음 — 앱이 `getWeights()`를 기간 필터해 병행 표시 (DATA_MODEL.md 15장) |
| `estimateNutrition` (개정) | `POST /api/nutrition/estimate` | `{ food_label }` | 식약처 DB 유사도 검색(pg_trgm). 응답 `food_label`은 매칭된 DB 이름(요청과 다를 수 있음). 미매칭 404 → `NutritionNotFoundError` (수동 입력 유도) |
| `checkFoodWarnings` | `POST /api/nutrition/warnings` | `{ food_labels }` (1~10개) | `{ warnings: [{ source: 'condition'\|'allergy', code, label, matched_keyword, matched_label }] }` — 해당 없으면 빈 배열. Bearer + sensitive_health 동의 필수(403). 기록 탭이 라벨 확정 시 백그라운드로 호출해 확정 카드에 경고 배너를 그린다 — 실패는 조용히 스킵, 저장은 막지 않는다 (DATA_MODEL.md 16장) |

그룹·반려동물 계약의 정본은 `kcalAI-model/docs/DATA_MODEL.md` 9장, 그룹 라이프사이클(탈퇴·삭제·제거·해제)은 17장,
회원 탈퇴·펫 권장 칼로리는 18장입니다.
끼니·체중·온보딩(`health-api.ts`, `onboarding-api.ts`, `meta-api.ts`)은 3~5·7·10장을 따릅니다.
식단 추천(`recommendation-api.ts`)과 영양 조회 유사도·404 규약은 11·13장을 따릅니다.

`dev_code`(휴대폰 OTP 개발 편의 응답)는 2026-07-14 카카오 로그인 전환과 함께 서버·앱 양쪽에서 **사라졌습니다.**

두 엔드포인트 모두 실패 시 `{"detail": "<사용자용 한국어 메시지>"}`를 반환합니다. `readErrorMessage`가 `detail`을 뽑아 화면 배너에 그대로 표시합니다. 서버는 내부 예외를 `task-logs/error_log.txt`에만 남깁니다.
