# ARCHITECTURE

## 디렉토리 구조

```
k-calAI-RN/
├── app/                        # expo-router 파일 기반 라우트 (이 안의 파일 = 화면)
│   ├── _layout.tsx             # 루트 Stack + ThemeProvider + 인증 가드
│   ├── auth.tsx                # 휴대폰 인증 (initialRouteName)
│   ├── modal.tsx               # Expo 템플릿 잔재
│   ├── (tabs)/
│   │   ├── _layout.tsx         # 하단 탭 (홈 / 기록 / 추이 / 내 정보) + 온보딩 게이트
│   │   ├── home.tsx            # 홈 탭 - 오늘 요약 (그룹 진입점)
│   │   ├── index.tsx           # 기록 탭 - 사진 입력 → 예측 → 끼니 저장
│   │   ├── trends.tsx          # 추이 탭 - 주/월 섭취 kcal 바 차트 + 요약 + 체중 변화
│   │   ├── account.tsx         # 내 정보 탭 (프로필·목표 요약, 체중·질병·알러지·반려동물 진입점, 로그아웃)
│   │   └── explore.tsx         # 개발자 진단 (탭 바에서 숨김)
│   ├── onboarding/             # 온보딩 스택 (consent → body → …)
│   ├── groups/                 # 그룹 스택 (홈에서 진입)
│   │   ├── _layout.tsx         # 인증 가드 (온보딩 레이아웃과 같은 패턴)
│   │   ├── index.tsx           # 내 그룹 목록
│   │   ├── create.tsx          # 그룹 생성
│   │   ├── join.tsx            # 초대코드로 참여
│   │   └── [id].tsx            # 그룹 상세 (멤버·펫·초대코드 공유·내 펫 공유)
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
│   ├── meals/                  # 끼니 기록 목록 (홈 끼니 카드에서 진입)
│   │   ├── _layout.tsx         # 인증 가드
│   │   └── index.tsx           # 날짜별 기록 목록 + 삭제
│   └── recommendations/        # 식단 추천 스택 (홈에서 진입)
│       ├── _layout.tsx         # 인증 가드
│       └── index.tsx           # 끼니 선택 + 오늘 추천 목록
├── services/                   # 외부 통신 + 앱 전역 상태
│   ├── auth-api.ts             # 인증 API 클라이언트 (발급 전 순수 fetch, logout만 apiFetch로 Bearer 첨부)
│   ├── auth-session.ts         # 세션 싱글톤 + 영속화(SecureStore) + useAuthSession 훅
│   ├── calorie-api.ts          # 추론/칼로리 API 클라이언트
│   ├── health-api.ts           # 프로필·목표·끼니·체중 (DATA_MODEL.md 3~5장)
│   ├── onboarding-api.ts       # 동의·건강 프로필·질병·알러지 (7장)
│   ├── meta-api.ts             # 선택지 참조 (10장)
│   ├── group-api.ts            # 그룹 (9장)
│   ├── pet-api.ts              # 반려동물·급여 기록 (9장)
│   ├── recommendation-api.ts   # 식단 추천 (11·13장)
│   └── http.ts                 # 공통 fetch 래퍼(apiFetch) + readErrorMessage
├── components/                 # 재사용 UI
│   ├── session-loading.tsx     # 세션 복원 대기 화면 (인증 가드 깜빡임 방지)
│   ├── error-banner.tsx        # 오류 배너 + 다시 시도
│   ├── back-button.tsx         # 탭 밖 스택 화면(그룹·펫)의 뒤로가기
│   ├── pet-form.tsx            # 반려동물 등록·수정 공용 폼 (services 미의존, 구조적 타입)
│   ├── chip-group.tsx, meal-type-card.tsx, progress-ring.tsx, onboarding-progress.tsx
│   ├── themed-text.tsx, themed-view.tsx
│   ├── external-link.tsx, haptic-tab.tsx
│   ├── hello-wave.tsx, parallax-scroll-view.tsx   # 템플릿 잔재
│   └── ui/
│       ├── collapsible.tsx
│       └── icon-symbol.tsx / icon-symbol.ios.tsx  # 플랫폼 분기
├── hooks/
│   ├── use-color-scheme.ts / use-color-scheme.web.ts
│   └── use-theme-color.ts
├── constants/theme.ts          # Colors, Fonts
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
| `app/(tabs)/explore.tsx` | `/explore` | 탭 바에서 숨김 (`href: null`) |
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
| `app/meals/index.tsx` | `/meals?date=YYYY-MM-DD` | 날짜별 끼니 기록 목록 + 삭제 (홈 끼니 카드에서 진입) |
| `app/modal.tsx` | `/modal` | `presentation: 'modal'` |

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

### 인증 (`app/auth.tsx`)

```
사용자 입력 (mode: signup | login, phoneNumber)
  └─ requestPhoneCode(mode, phoneNumber)
       └─ POST {AUTH_API_URL}/{mode}/request-code
            ← { message, expires_at, dev_code? }
  └─ (사용자가 code 입력)
  └─ verifyPhoneCode(mode, phoneNumber, code)
       └─ POST {AUTH_API_URL}/{mode}/verify
            ← { access_token, token_type, expires_at, user }
       └─ setAuthSession(result)   → SecureStore 저장 + 스토어 notify
            └─ auth.tsx 리렌더 → <Redirect href="/(tabs)" /> (router.replace 아님)
```

### 식단 분석 (`app/(tabs)/index.tsx`)

```
pickFromCamera() / pickFromLibrary()
  └─ ImagePicker 권한 요청 → 거부 시 Alert
  └─ launchCameraAsync / launchImageLibraryAsync (aspect 4:3, quality 0.86)
  └─ setPhoto(result.assets[0])   + 하위 상태 전부 초기화

analyzePhoto()
  └─ uploadFoodPhoto({ uri, fileName, mimeType })
       ├─ web:    fetch(uri) → blob → FormData.append('file', blob, name)
       └─ native: FormData.append('file', { uri, name, type } as unknown as Blob)
       └─ POST CALORIE_API_URL
            ← { predictions: [{ label, score }] }
            (Array.isArray 검증 후 label/score 강제 캐스팅)
  └─ setPredictions(result.sort((a,b) => b.score - a.score))

selectPrediction(prediction)             # 라벨 확정 → 기록 확정 카드
  └─ estimateNutrition(prediction.label)
       └─ POST {HEALTH_API_URL}/nutrition/estimate  { food_label }
            ← { food_label, kcal_per_serving, serving_desc, carbs_g, protein_g, fat_g, source }
            (식약처 DB 유사도 검색 — 응답 food_label이 요청 라벨과 다를 수 있다.
             미매칭이면 404 → NutritionNotFoundError)
  └─ setNutrition(...)                   # 매칭 이름이 다르면 화면에 표시하고 그 이름으로 저장
       # 404면 에러 배너 없이 kcal 수동 입력(TextInput)으로 유도, 그 외 실패는 배너 + 재시도

saveMeal()                               # 끼니(meal_type) + 섭취량(serving_ratio) 선택 후
  └─ createMeal({ meal_type, items: [{ food_label, serving_ratio, kcal, source: 'ai', confidence }] })
       └─ POST {HEALTH_API_URL}/meals
  └─ reset() → router.navigate('/home')  # 홈은 useFocusEffect로 summary를 재조회
```

> `requestCalorieDetail`(`/api/gpt-predict`, 프롬프트 하드코딩 `services/calorie-api.ts:71`)은 기록 탭에서 더 이상 쓰지 않지만 `services/calorie-api.ts`에 남아 있습니다.

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
| `uploadFoodPhoto` | `POST /api/predict` | `multipart/form-data`, `file` | `{ predictions: [{ label, score }] }` — 라벨은 **한국어** (YOLO 한국 음식 분류기) |
| `requestCalorieDetail` | `POST /api/gpt-predict` | `{ text, max_tokens }` | `{ response_text }` — 마크다운 표를 포함할 수 있음 |
| `requestPhoneCode` | `POST /api/auth/{mode}/request-code` | `{ phone_number }` | `{ message, expires_at, dev_code? }` |
| `verifyPhoneCode` | `POST /api/auth/{mode}/verify` | `{ phone_number, code }` | `{ access_token, token_type, expires_at, user }` |
| `createGroup` / `getGroups` / `joinGroup` | `POST·GET /api/groups`, `POST /api/groups/join` | `{ name, kind }` / — / `{ invite_code }` | `GroupSummary` (생성·목록·참여 동일 형태) |
| `getGroupDetail` | `GET /api/groups/{id}` | — | 상세 + `members[]`(전화번호는 서버가 마스킹) + `pets[]` |
| `attachPetToGroup` | `POST /api/groups/{id}/pets` | `{ pet_id }` | `{ message }` — 그룹 멤버이면서 펫 소유자만 |
| `createPet` / `getPets` / `updatePet` / `deletePet` | `POST·GET /api/pets`, `PUT·DELETE /api/pets/{id}` | `PetUpsertRequest` | `PetResponse`. 남의 펫은 404 (존재 은닉). 단건 조회 API 없음 — 상세 화면은 목록에서 찾는다 |
| `createFeeding` / `getFeedings` | `POST·GET /api/pets/{id}/feedings` | `{ food_label, amount_g, kcal?, fed_at? }` | `FeedingResponse`. 권한 = 소유자 또는 펫이 참여한 그룹의 멤버 |
| `getRecommendation` | `GET /api/recommendations?meal_type&date` | 쿼리 파라미터 | `{ meal_type, rec_date, items[], excluded[], cached, disclaimer }`. `excluded`는 판별 유니온(`allergen`/`condition`/`filtered`), `items`는 빈 배열 가능. 미동의 403 → `ConsentRequiredError`. `disclaimer`는 서버 문자열을 그대로 표시 |
| `getTrends` | `GET /api/me/trends?start_date&end_date` | 쿼리 파라미터 (YYYY-MM-DD) | `{ start_date, end_date, target_kcal: number\|null, days[] }`. `days`는 범위 내 전 날짜 오름차순(빈 날 0). 역순·92일 초과는 400 + 한국어 `detail`. 체중은 포함하지 않음 — 앱이 `getWeights()`를 기간 필터해 병행 표시 (DATA_MODEL.md 15장) |
| `estimateNutrition` (개정) | `POST /api/nutrition/estimate` | `{ food_label }` | 식약처 DB 유사도 검색(pg_trgm). 응답 `food_label`은 매칭된 DB 이름(요청과 다를 수 있음). 미매칭 404 → `NutritionNotFoundError` (수동 입력 유도) |

그룹·반려동물 계약의 정본은 `kcalAI-model/docs/DATA_MODEL.md` 9장입니다.
끼니·체중·온보딩(`health-api.ts`, `onboarding-api.ts`, `meta-api.ts`)은 3~5·7·10장을 따릅니다.
식단 추천(`recommendation-api.ts`)과 영양 조회 유사도·404 규약은 11·13장을 따릅니다.

`dev_code`는 서버의 `AUTH_INCLUDE_DEV_CODE=true`일 때만 내려옵니다. 로컬 개발 편의 기능이며 **프로덕션 UI에 노출하면 안 됩니다.**

두 엔드포인트 모두 실패 시 `{"detail": "<사용자용 한국어 메시지>"}`를 반환합니다. `readErrorMessage`가 `detail`을 뽑아 화면 배너에 그대로 표시합니다. 서버는 내부 예외를 `task-logs/error_log.txt`에만 남깁니다.
