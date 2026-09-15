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
│   │   ├── trends.tsx          # 진료 탭 - 세 묶음: 진료 준비(진료일·리포트) / 식단과 검사 수치 / 몸과 활동
│   │   ├── account.tsx         # 내 정보 탭 (프로필·목표 요약, 체중·질병·알러지 진입점, 로그아웃·회원 탈퇴)
│   ├── onboarding/             # 온보딩 스택 (consent → body → …)
│   ├── groups/                 # 그룹 스택 (홈에서 진입)
│   │   ├── _layout.tsx         # 인증 가드 (온보딩 레이아웃과 같은 패턴)
│   │   ├── index.tsx           # 내 그룹 목록
│   │   ├── create.tsx          # 그룹 생성
│   │   ├── join.tsx            # 초대코드로 참여 (`?code=`로 프리필)
│   │   └── [id].tsx            # 그룹 상세 (멤버·초대 링크 공유·나가기·삭제·멤버 제거)
│   ├── invite.tsx              # 초대 링크 착지점 (`/invite?code=`) — **인증 가드 밖**. 미가입자가 열어도 코드가 유실되지 않게 한다
│   ├── me/                     # 내 정보 하위 스택 (내 정보 탭에서 진입)
│   │   ├── _layout.tsx         # 인증 가드
│   │   ├── profile.tsx         # 프로필 수정 (GET/PUT /api/me/profile)
│   │   ├── goal.tsx            # 목표 수정 (GET/PUT /api/me/goal, 홈 목표 CTA에서도 진입)
│   │   ├── weights.tsx         # 체중 기록 (POST/GET /api/weights)
│   │   ├── conditions.tsx      # 질병 정보 수정 (GET/PUT /api/me/conditions, 칩 + 메타 폴백)
│   │   └── allergies.tsx       # 알러지 정보 수정 (GET/PUT /api/me/allergies, severity 보존)
│   ├── plan.tsx                # 요금제 (내 정보에서 진입). 내 플랜·구독 상태·오늘 인식 사용량·3종 비교·구독하기·자동결제 해지
│   ├── billing/                # 토스 결제창 착지점 스택 (사용자가 직접 들어오는 곳이 아니다)
│   │   ├── _layout.tsx         # 인증 가드 (payments 레이아웃과 같은 패턴)
│   │   ├── success.tsx         # successUrl 착지 → POST /api/billing/confirm (마운트 1회, ref 가드)
│   │   └── fail.tsx            # failUrl 착지 → 실패·취소 안내 (서버 호출 없음)
│   ├── payments/               # 결제 내역·영수증 스택 (내 정보에서 진입)
│   │   ├── _layout.tsx         # 인증 가드 (groups 레이아웃과 같은 패턴)
│   │   ├── index.tsx           # 결제 내역 목록 (GET /api/payments, 빈 상태·상태 배지)
│   │   └── [id].tsx            # 영수증 상세 (GET /api/payments/{id}, 404 안내)
│   ├── meals/                  # 끼니 기록 목록·구성 (홈 끼니 카드·캘린더·기록 탭에서 진입)
│   │   ├── _layout.tsx         # 인증 가드
│   │   ├── index.tsx           # 날짜별 기록 목록 + 삭제 + 인라인 수정 + '기록 추가'·'끼니에 항목 추가' 진입점
│   │   └── compose.tsx         # 끼니 구성 — 한 끼니에 다중 항목(사진 foods[]/DB검색/직접입력), 신규·append(meal_id) 저장
│   └── recommendations/        # 식단 추천 스택 (홈에서 진입)
│       ├── _layout.tsx         # 인증 가드
│       └── index.tsx           # 끼니 선택 + 오늘 추천 목록
├── services/                   # 외부 통신 + 앱 전역 상태
│   ├── auth-api.ts             # 카카오 로그인 API 클라이언트 (expo-web-browser로 서버 start URL 오픈 → 딥링크 파싱. 발급 전 순수 fetch, logout만 apiFetch로 Bearer 첨부)
│   ├── auth-session.ts         # 세션 싱글톤 + 영속화(SecureStore) + useAuthSession 훅 + parseAuthTokenResponse(auth-api 공유) + getWebStorage(웹 localStorage, group-invite·yesterday-summary 공유)
│   ├── calorie-api.ts          # 추론/칼로리 API 클라이언트
│   ├── photo-picker.ts         # pickPhoto('camera'|'library') — 권한 요청·거부 안내·촬영/앨범 옵션(앨범만 exif). 취소·거부는 null
│   ├── health-api.ts           # 프로필·목표·끼니·체중 (DATA_MODEL.md 3~5장)
│   ├── onboarding-api.ts       # 동의·건강 프로필·질병·알러지 (7장)
│   ├── meta-api.ts             # 선택지 참조 (10장) — 질병·알러지 + 신장병 병기(ckd_stages)
│   ├── group-api.ts            # 그룹 (9장)
│   ├── food-label.ts           # 식약처 라벨 → 화면 표시명. **조회 키는 안 바꾼다**. 언더스코어가 카테고리인지 재료인지 일반 판정이 불가해, 접두사가 뒤에 다시 나올 때만 뗀다
│   ├── group-invite.ts         # 그룹 초대 링크 생성·공유 문구 + 로그인 전 초대코드 보관(consume 1회). 서버 API 없음
│   ├── share.ts                # 텍스트 공유 플랫폼 shim — 웹은 Web Share API → 클립보드 폴백 (dialog.ts와 같은 이유)
│   ├── visit-api.ts            # 진료 일정 (31장) + daysUntil() 로컬 자정 기준 D-day 계산
│   ├── recommendation-api.ts   # 식단 추천 (11·13장)
│   ├── subscription-api.ts     # 요금제·구독 (GET /api/plans 무인증, GET·PUT /api/me/subscription) + FALLBACK_PLANS + parseMySubscription(billing-api 재사용)
│   ├── billing-api.ts          # 자동결제 (POST /api/billing/{checkout,confirm,cancel}) + BillingChargeError(502)·BillingUnavailableError(503)
│   ├── toss-sdk.ts             # 토스 결제창 SDK 어댑터 — **웹 전용**. script 1회 동적 로드(프라미스 캐시), window 접근을 여기 가둔다
│   ├── payment-api.ts          # 결제 내역·영수증 (GET /api/payments, GET /api/payments/{id}) + PaymentNotFoundError(404)
│   ├── format.ts               # 날짜·시각 표시 문자열(순수 함수). 'YYYY-MM-DD'는 Date로 파싱하지 않고, ISO 시각은 기기 로컬로 그린다
│   ├── http.ts                 # 공통 fetch 래퍼(apiFetch) + PlanLimitError(402) + 응답 헬퍼 한 벌: readOk/ensureOk(실패 시 detail로 던지고 상태코드별 오류 클래스 매핑) · ensure/ensureList · isRecord · toNumber · oneOf · JSON_HEADERS
│   └── api-base.ts             # API 오리진 결정(EXPO_PUBLIC_API_ORIGIN 우선, 없으면 Expo hostUri→LAN IP 자동). apiUrl(path) — 서비스별 URL 오버라이드 없음
├── components/                 # 재사용 UI
│   ├── session-loading.tsx     # 세션 복원 대기 화면 (인증 가드 깜빡임 방지)
│   ├── auth-guard-stack.tsx    # 탭 밖 스택 _layout.tsx 공통 인증 가드 (loading → SessionLoading, 미인증 → <Redirect href="/auth" />)
│   ├── screen.tsx              # 화면 틀 SafeAreaView → ScrollView → 가운데 컨테이너(최대 720). keyboard·gap·contentStyle 변형만
│   ├── loading-state.tsx       # 본문 불러오는 중 카드 (스피너 + 문구)
│   ├── primary-button.tsx      # 폼 제출 민트 버튼 (loading 스피너·disabled)
│   ├── goal-form.tsx, profile-form.tsx, allergy-form.tsx, condition-form.tsx  # 온보딩(app/onboarding/)·내 정보 수정(app/me/)이 같이 쓰는 폼. 불러오기·API 저장·이동은 라우트에 두고 폼은 값·onChange·onSave만 받는다. 배타 '없음' 토글(toggleExclusive·NONE_VALUE)은 condition-form이 export
│   ├── error-banner.tsx        # 오류 배너 + 다시 시도 (actionLabel로 문구 교체 — 402는 '요금제 업그레이드')
│   ├── back-button.tsx         # 탭 밖 스택 화면(그룹·요금제)의 뒤로가기
│   ├── chip-group.tsx, meal-type-card.tsx, progress-ring.tsx, onboarding-progress.tsx
│   ├── haptic-tab.tsx          # 탭 햅틱
│   └── ui/
│       └── icon-symbol.tsx / icon-symbol.ios.tsx  # 플랫폼 분기
├── hooks/                       # 현재 비어 있음 (라이트 전용 확정으로 use-color-scheme 제거, 2026-09-14)
└── assets/images/
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
| `components/` | 표시 전용 UI | `hooks/`, `constants/`. **예외로 `services/`의 타입·순수 함수·세션 훅**(`health-api` 타입, `food-label`, `format`, `auth-guard-stack`→`useAuthSession`)과 자기 데이터를 스스로 읽는 카드(`group-challenges`, `next-meal-card`, `weekly-coaching`, `condition-guide-card`) | `app/`. 그 외 `services/` 호출은 props로 주입 |
| `services/` | HTTP, 응답 검증, 세션 | 없음 (RN `Platform`만) | `app/`, `components/` |
| `hooks/` | (현재 비어 있음 — 라이트 전용 확정으로 `use-color-scheme` 제거, 2026-09-14) | `constants/` | `app/`, `services/` |
| `constants/` | 정적 데이터·토큰 (`changelog.ts` 업데이트 이력) | 없음 | 전부 |

경로 별칭: `@/*` → 프로젝트 루트 (`tsconfig.json`). 상대 경로 `../../`를 쓰지 않고 `@/services/calorie-api` 형태로 import 합니다.

## 라우팅

expo-router의 파일 기반 라우팅입니다. `app/` 하위 파일이 곧 경로입니다.

| 파일 | 경로 | 비고 |
|------|------|------|
| `app/auth.tsx` | `/auth` | `unstable_settings.initialRouteName = 'auth'` |
| `app/(tabs)/home.tsx` | `/home` | 로그인 직후 진입 탭. 그룹 진입점 |
| `app/(tabs)/index.tsx` | `/` | 그룹 `(tabs)`는 URL에 나타나지 않음 |
| `app/(tabs)/trends.tsx` | `/trends` | 진료 탭. 세 묶음(2026-09-15): **진료 준비**(다음 진료일 `GET·PUT /api/me/next-visit`·진료에 가져갈 기록 → `/report`) / **식단과 검사 수치**(그래프·캘린더 토글, 일별 섭취 `GET /api/me/trends`·질환 영양 추이·검사 수치 `GET /api/me/labs`) / **몸과 활동**(체중 `GET /api/weights` 기간 필터·체성분·주간 조언) |
| `app/(tabs)/account.tsx` | `/account` | 프로필·요금제·결제 내역·질병·알러지 진입점 |
| `app/onboarding/*.tsx` | `/onboarding/…` | 인증 가드 레이아웃 |
| `app/groups/index.tsx` | `/groups` | 내 그룹 목록 |
| `app/groups/create.tsx` | `/groups/create` | 그룹 생성 |
| `app/groups/join.tsx` | `/groups/join?code=XXXXXXXX` | 초대코드로 참여. `code`가 있으면 프리필(초대 링크 경유) — **자동 참여는 하지 않는다** |
| `app/invite.tsx` | `/invite?code=XXXXXXXX` | 초대 링크 착지점. **인증 가드 밖의 단일 라우트**인 것이 존재 이유다 — 초대받는 사람은 대개 미가입자라, 가드가 걸린 `/groups/join`으로 바로 보내면 로그인으로 튕기며 코드가 유실된다. 로그인 상태면 `/groups/join?code=`로 replace, 아니면 코드를 보관(`group-invite.ts`)하고 로그인 유도 |
| `app/groups/[id].tsx` | `/groups/:id` | 그룹 상세. `router.push({ pathname: '/groups/[id]', params })` |
| `app/recommendations/index.tsx` | `/recommendations` | 식단 추천 (홈에서 진입, 인증 가드 레이아웃) |
| `app/me/profile.tsx` | `/me/profile` | 프로필 수정 (내 정보 탭에서 진입) |
| `app/me/goal.tsx` | `/me/goal` | 목표 수정 (내 정보 탭·홈 목표 CTA에서 진입) |
| `app/me/weights.tsx` | `/me/weights` | 체중 기록 입력 + 최근 목록 |
| `app/me/conditions.tsx` | `/me/conditions` | 질병 정보 수정 (내 정보 탭에서 진입) |
| `app/me/allergies.tsx` | `/me/allergies` | 알러지 정보 수정 (내 정보 탭에서 진입, 기존 severity 보존) |
| `app/meals/index.tsx` | `/meals?date=YYYY-MM-DD` | 날짜별 끼니 기록 목록 + 삭제 + 인라인 수정 (홈 끼니 카드·캘린더에서 진입, 날짜 파라미터 유지) |
| `app/meals/compose.tsx` | `/meals/compose?date=&meal_type=&meal_id=&photoUri=…` | 끼니 구성(다중 항목). `meal_id` 있으면 append 모드(PUT 전체 교체), 없으면 신규(POST + `logged_at` 앵커). 기록 탭·캘린더·기록 목록에서 진입 |
| `app/plan.tsx` | `/plan` | 요금제 (내 정보에서 진입, 402 배너의 업그레이드 버튼 목적지). 레이아웃 없는 단일 라우트라 화면 자신이 `<Stack.Screen options={{ headerShown: false }} />` + `<Redirect>` 가드를 건다. 유료 카드 → `startCheckout` + 토스 결제창(웹), 유료 구독 중 → 화면 내 2단계 확인 후 `cancelBilling()` |
| `app/billing/success.tsx` | `/billing/success?plan=&authKey=&customerKey=` | 토스 successUrl 착지점. `confirmBilling`을 **마운트 1회**만 호출(ref 가드 — `authKey`는 1회용). `BackButton` 없음, 이동은 전부 `router.replace` (뒤가 토스 결제창이라 되돌아오면 소비된 authKey로 재confirm) |
| `app/billing/fail.tsx` | `/billing/fail?code=&message=` | 토스 failUrl 착지점. 서버를 부르지 않는다(카드 등록 자체가 없었다). `USER_CANCEL`·`PAY_PROCESS_CANCELED`는 오류가 아니라 취소로 그린다 |
| `app/payments/index.tsx` | `/payments` | 결제 내역 목록 (내 정보에서 진입, `GET /api/payments`). 포커스마다 재조회, 항목 탭 → `/payments/[id]`. 빈 목록은 빈 상태 카드 |
| `app/payments/[id].tsx` | `/payments/:id` | 영수증 상세 (`GET /api/payments/{id}`). `router.push({ pathname: '/payments/[id]', params })`. 404는 `PaymentNotFoundError` → '영수증을 찾을 수 없어요' 안내 |
| `app/updates.tsx` | `/updates` | 업데이트 이력(사용자 공지). `constants/changelog.ts`의 정적 배열을 렌더한다 — 서버·API 없음. 내 정보에서 진입 |

`groups/`·`recommendations/`·`me/`·`meals/`·`payments/`·`billing/` 스택은 루트 레이아웃에 등록하지 않고 (expo-router 자동 등록) 각 `_layout.tsx`가
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

setAuthSession(s)     → currentSession = s → notify() → 저장(네이티브 SecureStore / 웹 localStorage)
clearAuthSession()    → currentSession = null → notify() → 저장소 삭제
restoreAuthSession()  → (__DEV__ 개발 세션 ?? 저장소 읽기) → currentSession 복원 → hydrated = true → notify()
useAuthSession()      → useSyncExternalStore(subscribe, getSnapshot) → AuthSessionState 반환 (스냅샷은 notify 시점에 캐시)
```

**영속화: 네이티브는 `expo-secure-store`, 웹은 `localStorage`** (`auth-session.ts`가 `Platform.OS`로 분기 — `expo-secure-store`가 web을 지원하지 않기 때문입니다). `setAuthSession`/`clearAuthSession`이 저장·삭제하고, 앱 시작 시 `restoreAuthSession()`이 복원합니다. 복원 시 `parseAuthTokenResponse`(로그인 응답과 같은 검증)로 파싱값을 런타임 검증합니다.
**로컬 개발 세션:** `__DEV__`이고 `EXPO_PUBLIC_DEV_AUTH_SESSION`(`../dev.sh`가 넣는다)이 있으면 저장된 세션보다 먼저 복원합니다(`readDevSession`). 로컬은 카카오 허용 IP 제한으로 로그인할 수 없어서입니다. 저장소에 쓰지 않으므로 기동할 때마다 이 값이 이깁니다. 서버가 401을 주면 평소처럼 `clearAuthSession`으로 로그인 화면이 됩니다 (`docs/DEVICE_TESTING.md` A).
**웹도 새로고침하면 로그인이 유지됩니다.** 이것이 토스 결제창(브라우저를 통째로 되돌린다)에서 복귀한 `/billing/success`가 Bearer로 `confirm`을 부를 수 있는 이유입니다 — 메모리 전용이었다면 결제 확인이 401로 끊깁니다.
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

### 홈의 정보 구조 (2026-07-23 개편)

```
홈 (app/(tabs)/home.tsx)
  ├─ 칼로리 링                     SummaryRing        — 목표 미설정이면 대신 목표 CTA
  ├─ 오늘의 영양                   components/day-nutrients-card.tsx
  │    질환 축(나트륨·칼륨·인) 하루 누적. summary.nutrients 가 null 이면 통째로 사라진다
  ├─ 다음 끼니 추천                components/next-meal-card.tsx
  │    GET /api/recommendations 미리보기 2개. 실패해도 카드는 남고 진입은 열려 있다
  ├─ 끼니 카드 4개                 MealCards          — 기록 현황(조회)
  └─ 내 그룹 진입 행
```

**순서가 곧 판단입니다.** 만성질환자에게는 kcal 보다 나트륨 누적이 중요하므로 링 바로 아래에 두고
(`kcalAI-model/docs/PRODUCT_STRATEGY.md` §1), "다음에 뭘 먹지"(추천)를 "끼니별로 뭘 먹었나"(조회)보다
앞에 둡니다. 예전에는 추천이 그룹 진입과 나란한 **회색 리스트 행**이어서, 질환별 제외·등급·조리 팁까지
담긴 가장 밀도 높은 화면이 가장 눈에 띄지 않았습니다.

**3번 탭은 2026-08-19에 '리포트' → '진료'로 정체를 바꿨습니다** (서버 `docs/CARE_LOOP.md` §7).
다음 진료일·검사 수치·식단 추이·진료용 리포트가 모두 진료를 향한 행동인데 '리포트'라는 이름은
그중 하나만 가리켰습니다. 위에서부터 **다음 진료일 → 진료에 가져갈 기록 → 추이(그래프·캘린더) →
검사 수치 → 체중 → 체성분·권장 활동량 → 주간 조언** 순이고, 뷰 모드와 무관한 섹션은 분기 밖
공통 블록에 있습니다. BMI·권장 활동량과 주간 조언은 2026-07-25에 내 정보 탭으로 갔다가 이때
돌아왔습니다 — 내 정보는 계정·설정을 보는 곳이라 판단 자료가 섞여 있었습니다.

⚠️ **라우트 이름은 `trends` 그대로입니다.** URL(`/trends`)이 바뀌면 저장해 둔 링크가 깨집니다.

기록 확정 화면의 경고 배너에는 **'다음 끼니에 맞는 메뉴 보기'** 액션이 붙습니다. 경고를 막다른 길로
두지 않기 위한 것이고, 기록을 막지 않으므로 이미 먹은 것을 지우라는 뜻이 아닙니다(그래서 '다음 끼니').

### 그룹 초대 링크 (2026-07-22) — **서버 API 추가 없음**

```
그룹 상세 [링크 공유]                                    app/groups/[id].tsx
  └─ buildInviteMessage(name, code)                      services/group-invite.ts
  └─ shareText(message)                                  services/share.ts
       네이티브 → Share.share
       웹      → navigator.share → (미지원·거부 시) clipboard.writeText → 'copied' 안내

받는 사람이 링크를 연다   https://api.kcalai.link/invite?code=A7K2MPQ9
  └─ app/invite.tsx  (인증 가드 밖)
       로그인됨   → router.replace('/groups/join?code=…')  → 코드 프리필, 사람이 [참여하기]
       미로그인   → rememberPendingInvite(code) → /auth
                    카카오 로그인 (+ 신규면 온보딩) → /(tabs)
                    app/(tabs)/home.tsx 가 consumePendingInvite() → /groups/join?code=…
```

- **`/invite`가 인증 가드 밖에 있는 것이 이 설계의 핵심**입니다. 초대를 받는 사람은 대개 미가입자라, 가드가 걸린 `/groups/join`으로 바로 보내면 `<Redirect href="/auth" />`가 코드를 버립니다.
- **자동 참여는 하지 않습니다.** 잘못 눌러 들어간 그룹을 되돌리는 UI가 없어, 마지막 확인은 사람이 합니다.
- 보관한 코드는 `consumePendingInvite()`가 **읽으면서 지웁니다** — 홈에 올 때마다 참여 화면이 끼어들면 안 됩니다.
- 링크 오리진은 웹에서 `window.location.origin`(접속한 도메인을 따라감), 네이티브는 운영 도메인 상수입니다(`EXPO_PUBLIC_PUBLIC_WEB_ORIGIN`으로 덮어쓸 수 있음). 웹앱과 API가 같은 오리진이라 링크를 연 사람은 앱 설치 없이 참여합니다.
- 네이티브 앱 설치자가 링크를 눌러도 **브라우저로 열립니다** — 유니버설 링크(`apple-app-site-association` + `associatedDomains`)는 아직 없습니다.

### 자동결제 (2026-07-16, 토스페이먼츠 빌링) — **웹 전용**

```
app/plan.tsx  [구독하기]   (isBillingSupported() = Platform.OS === 'web' 일 때만 그린다)
  └─ startCheckout(planCode)          → POST /api/billing/checkout
       ← { client_key, customer_key, amount, order_name }   503 → BillingUnavailableError
  └─ requestBillingAuth({ clientKey, customerKey, successUrl, failUrl })   services/toss-sdk.ts
       └─ loadTossSdk()  웹에서만 <script src="…/v2/standard"> 1회 주입(프라미스 캐시) → window.TossPayments
       └─ TossPayments(clientKey).payment({ customerKey }).requestBillingAuth({ method:'CARD', … })
            ※ 브라우저가 통째로 이동하므로 이 호출은 정상 흐름에서 resolve하지 않는다
                 성공 → {origin}/billing/success?plan=<code>&authKey=…&customerKey=…
                 실패 → {origin}/billing/fail?code=…&message=…

app/billing/success.tsx   (billing/_layout.tsx 가드가 세션 복원 뒤에만 마운트시킨다)
  └─ useEffect + ref 가드 → confirmBilling({ authKey, customerKey, planCode })  # 마운트 1회
       └─ POST /api/billing/confirm → 카드 등록 + 최초 청구 → MySubscription
            502 → BillingChargeError      '결제하지 못했어요'  (구독 미활성화)
            503 → BillingUnavailableError '결제 서비스를 준비 중이에요'
            그 외 → '결제를 완료하지 못했어요'
       └─ 실패해도 confirm을 재호출하지 않는다 → router.replace('/plan')로 처음부터

app/billing/fail.tsx      code=USER_CANCEL|PAY_PROCESS_CANCELED → 오류가 아닌 '취소' 톤

app/plan.tsx  [자동결제 해지] → 화면 내 2단계 확인 → cancelBilling() → POST /api/billing/cancel
```

**세션은 웹에서 `localStorage`에 남는다**(`auth-session.ts`). 결제창이 브라우저를 통째로 되돌려 앱이 새로 시작돼도 `restoreAuthSession()`이 세션을 복원하므로 `confirm`에 Bearer가 붙는다 — `billing/_layout.tsx`가 복원 전(`loading`)에는 Stack을 그리지 않아 자식이 마운트되지 않게 막는 것이 이 흐름의 전제다.

**`Alert.alert`를 해지 확인에 쓰지 않는다.** react-native-web의 구현이 `static alert() {}`(no-op)이라 결제 주 무대인 웹에서 확인이 통째로 사라진다. 화면 안 2단계 확인(`confirmBox`)은 두 플랫폼에서 같게 동작한다.

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

`services/*.ts`의 각 함수는 요청을 `apiFetch`(인증 필요) 또는 `fetch`(인증 API)로 보내고, 응답을 `services/http.ts`의 `readOk`/`ensureOk`로 처리합니다. 경로는 `api-base.ts`의 `apiUrl(path)`로 만듭니다.

```
apiFetch(input, init)
  └─ 세션 있으면 Authorization: Bearer 첨부
  └─ 401  → clearAuthSession()
  └─ 402  → toPlanLimitError(response) 로 PlanLimitError 를 던짐 (개별 서비스 함수는 다루지 않음)

readOk(response, fallback, statusErrors?)              # ensureOk + 본문 JSON (204 면 null)
  └─ ensureOk(response, fallback, statusErrors?)
       └─ !response.ok →
            readErrorMessage(response)
              └─ text() → 비었으면 ''
              └─ JSON.parse 시도
                   ├─ data.detail이 배열   → item.msg 를 '\n'으로 join   (Pydantic 422 대응)
                   ├─ data.detail 존재     → String(data.detail)
                   └─ parse 실패           → 원문 text
            └─ 메시지가 비었으면 `${fallback}: ${status}`
            └─ statusErrors[status] 가 있으면 그 오류 클래스로, 없으면 Error 로 던짐
```

화면은 `catch`에서 `error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'`로 받아 `errorMessage` 상태에 넣고 `ErrorBanner`로 표시합니다.

**402(요금제 한도)는 예외입니다.** 화면은 `catch`에서 `instanceof PlanLimitError`를 먼저 판별해 같은 `ErrorBanner`를 **`actionLabel="요금제 업그레이드"` + `onRetry={() => router.push('/plan')}`**로 그립니다 — 한도 초과는 재시도로 풀리지 않기 때문입니다(2026-09-14, 전용 `PlanLimitBanner` 컴포넌트 삭제).

`readErrorMessage`·`readOk`·`ensureOk`는 `services/http.ts`의 **공통 함수**입니다. 개별 서비스 함수를 재정의하지 않고 이를 import 합니다.

## 플랫폼 분기

| 분기 방식 | 위치 |
|-----------|------|
| 파일명 접미사 (`.ios.tsx`) | `components/ui/icon-symbol.ios.tsx` |
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
| `fetchPlans` | `GET /api/plans` | — | `{ plans: [{ code, label, price_krw, daily_vision_quota, max_group_members, max_pets, max_owned_groups }] }`. `max_pets`는 서버가 계속 주지만 **화면에 그리지 않는다**(2026-08-18). **무인증**(가입 화면이 로그인 전에 호출) — 실패 시 `FALLBACK_PLANS`(번들 폴백)로 그린다 |
| `fetchMySubscription` / `changePlan` | `GET·PUT /api/me/subscription` | PUT: `{ plan_code }` | `{ plan, vision_usage: { used, limit, remaining, resets_at }, started_at, status, current_period_end, next_billing_at, cancel_at_period_end }`. 뒤 4필드는 2026-07-16 **추가**(기존 3필드 불변)라 `parseMySubscription`이 누락 시 무료 회원 기본값(`'active'`/null/false)으로 흘린다 — 신규 필드 때문에 화면 전체가 막히면 안 된다. `plan`은 **실효 플랜**(만료된 유료 구독은 lite). **PUT은 무료 전환 전용** — 유료 플랜은 400이고, 무료 전환은 남은 유료 기간을 포기시키므로 화면은 대신 `cancelBilling`을 쓴다 |
| `startCheckout` | `POST /api/billing/checkout` | `{ plan_code }` | `{ customer_key, client_key, plan_code, amount, order_name }`. `client_key`는 공개값이고 **이 응답으로만** 받는다(번들에 두지 않는다). `amount`는 표시 전용 — 실제 청구액은 confirm에서 서버가 다시 정한다. **503** = 결제 키 미설정 → `BillingUnavailableError` |
| `confirmBilling` | `POST /api/billing/confirm` | `{ auth_key, customer_key, plan_code }` — **금액 필드 없음** | `MySubscriptionResponse`. `auth_key`는 **1회용**이라 호출부가 중복을 막는다. **502** = 결제사 청구 실패 → `BillingChargeError`(이때 구독은 활성화되지 않고, 실패는 `payments` 원장에 `failed`로 남는다), **503** → `BillingUnavailableError` |
| `cancelBilling` | `POST /api/billing/cancel` | — (바디 없음) | `MySubscriptionResponse`. 즉시 무료가 아니라 `current_period_end`까지 유료를 유지한다(`status='canceled'`, `cancel_at_period_end=true`). **400** = 해지할 유료 구독 없음 |
| `getPayments` / `getPayment` | `GET /api/payments`, `GET /api/payments/{id}` | — (Bearer) | `{ payments: [PaymentItem] }`(최신순) / `PaymentItem`. `PaymentItem = { id, order_id, plan_code, plan_label, amount, status, method\|null, approved_at\|null, fail_reason\|null, created_at }`. `status`·`amount`는 서버 참조값이라 유니온으로 굳히지 않고 `string`·유한수로 받는다. 단건 **404** = `PaymentNotFoundError`(재시도 대신 안내). 자동결제 연동(2026-07-16, 24장) 이후 `confirm`·갱신 배치가 이 원장을 채운다 — 실패한 청구도 `status='failed'` + `fail_reason`(사용자용 한국어)로 남는다. 결제 이력이 없는 회원은 여전히 빈 배열 |
| `updateMeal` | `PUT /api/meals/{meal_id}` | `createMeal`과 동일 구조 (전체 교체) | `MealLog`. `logged_at` 생략 시 기존 기록 시각 유지, `total_kcal`은 서버가 items 합계로 재계산. 남의 끼니·삭제된 끼니 404 (DATA_MODEL.md 4장) |
| `deleteAccount` | `DELETE /api/me` | — | `{ message }`. **물리 삭제** — 끼니·체중·펫·소유 그룹 전부 파기, 전 토큰 즉시 무효. 성공 시에만 호출부가 `clearAuthSession()` (DATA_MODEL.md 18장) |
| `createGroup` / `getGroups` / `joinGroup` | `POST·GET /api/groups`, `POST /api/groups/join` | `{ name, kind }` / — / `{ invite_code }` | `GroupSummary` (생성·목록·참여 동일 형태). 초대 링크로 들어온 참여도 이 API 하나를 쓴다 — 링크는 코드 전달 수단일 뿐이라 **서버 API가 늘지 않는다** |
| `getGroupDetail` | `GET /api/groups/{id}` | — | 상세 + `members[]`(**`nickname`** = 카카오 닉네임. 2026-07-14 이전의 `phone_number_masked`를 대체. 닉네임이 없으면 서버가 '이름 미설정'을 준다) + `pets[]`(서버 계약이라 파싱은 유지, 화면에는 그리지 않는다) |
| `leaveGroup` / `deleteGroup` / `removeMember` | `DELETE /api/groups/{id}/members/me`, `DELETE /api/groups/{id}`, `DELETE /api/groups/{id}/members/{user_id}` | — | `{ message }`. 소유자 탈퇴 400("그룹 삭제로 진행" 안내), 비소유 삭제·제거 403, 비멤버는 404 (존재 은닉) (DATA_MODEL.md 17장) |
| `getRecommendation` | `GET /api/recommendations?meal_type&date` | 쿼리 파라미터 | `{ meal_type, rec_date, items[], excluded[], cached, disclaimer }`. `excluded`는 판별 유니온(`allergen`/`condition`/`filtered`), `items`는 빈 배열 가능. 미동의 403 → `ConsentRequiredError`. `disclaimer`는 서버 문자열을 그대로 표시 |
| `getTrends` | `GET /api/me/trends?start_date&end_date` | 쿼리 파라미터 (YYYY-MM-DD) | `{ start_date, end_date, target_kcal: number\|null, days[] }`. `days`는 범위 내 전 날짜 오름차순(빈 날 0). 역순·92일 초과는 400 + 한국어 `detail`. 체중은 포함하지 않음 — 앱이 `getWeights()`를 기간 필터해 병행 표시 (DATA_MODEL.md 15장) |
| `estimateNutrition` (개정) | `POST /api/nutrition/estimate` | `{ food_label }` | 식약처 DB 유사도 검색(pg_trgm). 응답 `food_label`은 매칭된 DB 이름(요청과 다를 수 있음). 미매칭 404 → `NutritionNotFoundError` (수동 입력 유도) |
| `checkFoodWarnings` | `POST /api/nutrition/warnings` | `{ food_labels }` (1~10개) | `{ warnings: [{ source: 'condition'\|'allergy', code, label, matched_keyword, matched_label }] }` — 해당 없으면 빈 배열. Bearer + sensitive_health 동의 필수(403). 기록 탭이 라벨 확정 시 백그라운드로 호출해 확정 카드에 경고 배너를 그린다 — 실패는 조용히 스킵, 저장은 막지 않는다 (DATA_MODEL.md 16장) |

그룹 계약의 정본은 `kcalAI-model/docs/DATA_MODEL.md` 9장, 그룹 라이프사이클(탈퇴·삭제·제거·해제)은 17장,
회원 탈퇴는 18장입니다.

> **2026-08-18 — 반려동물은 앱에서 제거했습니다.** `app/pets/`·`components/pet-form.tsx`·
> `services/pet-api.ts`와 `attachPetToGroup`·`detachPetFromGroup`을 삭제했습니다. 서버 테이블·
> 라우트·`plans.max_pets`·`GroupDetail.pets[]`는 **그대로 있습니다** — 응답 파싱은 서버 계약이라
> 유지하고 화면만 그리지 않습니다. 되살리려면 이 커밋을 되돌립니다. 판단 근거는
> `docs/DESIGN.md`의 같은 날 행.
끼니·체중·온보딩(`health-api.ts`, `onboarding-api.ts`, `meta-api.ts`)은 3~5·7·10장을 따릅니다.
식단 추천(`recommendation-api.ts`)과 영양 조회 유사도·404 규약은 11·13장을 따릅니다.

`dev_code`(휴대폰 OTP 개발 편의 응답)는 2026-07-14 카카오 로그인 전환과 함께 서버·앱 양쪽에서 **사라졌습니다.**

두 엔드포인트 모두 실패 시 `{"detail": "<사용자용 한국어 메시지>"}`를 반환합니다. `readErrorMessage`가 `detail`을 뽑아 화면 배너에 그대로 표시합니다. 서버는 내부 예외를 `task-logs/error_log.txt`에만 남깁니다.
