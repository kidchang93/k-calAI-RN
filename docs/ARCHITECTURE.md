# ARCHITECTURE

## 디렉토리 구조

```
k-calAI-RN/
├── app/                        # expo-router 파일 기반 라우트 (이 안의 파일 = 화면)
│   ├── _layout.tsx             # 루트 Stack + ThemeProvider + 인증 가드
│   ├── auth.tsx                # 휴대폰 인증 (initialRouteName)
│   ├── modal.tsx               # Expo 템플릿 잔재
│   └── (tabs)/
│       ├── _layout.tsx         # 하단 탭 (분석 / 상태)
│       ├── index.tsx           # 분석 탭 - 사진 입력 → 예측 → 칼로리
│       └── explore.tsx         # 상태 탭 - 엔드포인트 진단용
├── services/                   # 외부 통신 + 앱 전역 상태
│   ├── auth-api.ts             # 인증 API 클라이언트
│   ├── auth-session.ts         # 세션 싱글톤 + useAuthSession 훅 (미커밋)
│   └── calorie-api.ts          # 추론/칼로리 API 클라이언트
├── components/                 # 재사용 UI
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
| `app/(tabs)/index.tsx` | `/` | 그룹 `(tabs)`는 URL에 나타나지 않음 |
| `app/(tabs)/explore.tsx` | `/explore` | |
| `app/modal.tsx` | `/modal` | `presentation: 'modal'` |

`app.json`의 `experiments.typedRoutes: true`로 `router.replace('/auth')` 같은 호출이 타입 체크됩니다.

## 인증 가드

각 라우트가 `<Redirect>`로 **선언형** 가드를 겁니다. 루트 레이아웃은 네비게이션에 관여하지 않습니다.

```
app/(tabs)/_layout.tsx   세션 없음  →  <Redirect href="/auth" />
app/auth.tsx             세션 있음  →  <Redirect href="/(tabs)" />
```

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
listeners: Set<() => void>

setAuthSession(s)  → currentSession = s  → notify() → 모든 useAuthSession 리렌더
clearAuthSession() → currentSession = null → notify()
useAuthSession()   → useState(getAuthSession) + useEffect로 listener 등록
```

**영속화가 없습니다.** 앱을 재시작하면 세션이 사라집니다. `expo-secure-store` 등의 도입이 필요합니다.
**토큰이 사용되지 않습니다.** `access_token`을 보관만 하고 어떤 요청 헤더에도 넣지 않습니다.

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
       └─ setAuthSession(result)
            └─ _layout.tsx의 useEffect가 router.replace('/(tabs)')
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

calculateCalories(prediction)
  └─ requestCalorieDetail(prediction.label)
       └─ POST CALORIE_DETAIL_API_URL  { text: <한국어 프롬프트>, max_tokens: 512 }
            ← { response_text }
  └─ setCalorieResult(...)
```

> **프롬프트가 앱에 하드코딩되어 있습니다** (`services/calorie-api.ts:71`). 서버 템플릿화가 예정된 항목입니다 (`kcalAI-model/docs/PROJECT_PLANNING.md`).

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

`readErrorMessage`는 `auth-api.ts`와 `calorie-api.ts`에 **중복 정의**되어 있으며, `calorie-api.ts` 버전만 배열 `detail`을 처리합니다.

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

`dev_code`는 서버의 `AUTH_INCLUDE_DEV_CODE=true`일 때만 내려옵니다. 로컬 개발 편의 기능이며 **프로덕션 UI에 노출하면 안 됩니다.**

`/api/predict`의 실패 응답은 `{"detail": ...}`가 아니라 **500 평문**입니다 (서버 버그). `readErrorMessage`가 JSON 파싱에 실패해 원문 `Internal Server Error`를 그대로 반환합니다.
