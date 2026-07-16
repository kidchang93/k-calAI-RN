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
| `EXPO_PUBLIC_SUBSCRIPTION_API_URL` | `/api` (`/plans`, `/me/subscription`) | `services/subscription-api.ts` |
| `EXPO_PUBLIC_PAYMENT_API_URL` | `/api/payments` | `services/payment-api.ts` |
| `EXPO_PUBLIC_BILLING_API_URL` | `/api/billing` | `services/billing-api.ts` |

기본 오리진(base)은 `services/api-base.ts`가 결정합니다(위 설명). 새 서비스는 `apiUrl('/api/…', process.env.EXPO_PUBLIC_…)` 패턴을 따르세요 — 호스트 분기를 개별 파일에 두지 않습니다.

기본값 폴백이 있어 `.env` 없이도 로컬에서 동작합니다. 오버라이드가 필요하면 `.env.example`을 `.env`로 복사해 값을 바꾸세요(`.env`는 gitignore).

---

## 서버 의존성

이 앱은 `kcalAI-model` (FastAPI) 서버를 기능 서버로 사용합니다.

| 목적 | 메서드 | 앱이 호출하는 경로 | 서버 실제 경로 | 상태 |
|------|--------|--------------------|----------------|------|
| 카카오 로그인 시작 | `GET` | `/api/auth/kakao/start?platform=native\|web` | 동일 | 일치 (2026-07-14, 서버 `api/auth_api.py` 대조). 앱은 `expo-web-browser`의 `openAuthSessionAsync`로 이 URL만 연다 — **네이티브 카카오 SDK를 쓰지 않는다** |
| 카카오 로그인 (기존 회원) | `POST` | `/api/auth/kakao/login` | 동일 | 일치. 바디 `{ link_code }`. **404 = 미가입** → `KakaoNotRegisteredError`(앱이 가입 단계로 보낸다), **400 = 연동 코드 만료·소비** → `KakaoLinkExpiredError` |
| 카카오 회원가입 (신규) | `POST` | `/api/auth/kakao/signup` | 동일 | 일치. 바디 `{ link_code, agreed_terms, agreed_privacy, plan_code }` — 동의 2종 필수(false면 400·누락 시 422), `plan_code` 생략 시 lite |
| 요금제 목록 | `GET` | `/api/plans` | 동일 | 일치 (`subscription-api.ts`. **무인증** — 가입 화면이 로그인 전에 호출. 실패 시 번들 폴백 `FALLBACK_PLANS`) |
| 내 요금제·사진 인식 사용량 | `GET·PUT` | `/api/me/subscription` | 동일 | 일치 (`subscription-api.ts`, Bearer. **2026-07-16: PUT은 무료(lite) 전환 전용** — 유료 플랜을 보내면 **400**("결제를 통해 업그레이드해주세요"). 업그레이드는 결제 흐름뿐이다. GET 응답에 자동결제 4필드(`status`·`current_period_end`·`next_billing_at`·`cancel_at_period_end`)가 **추가**됐다(기존 3필드 불변). `plan`은 **실효 플랜**이라 기간이 만료된 유료 구독은 lite로 내려온다) |
| **자동결제(빌링)** | `POST` | `/api/billing/checkout`, `/api/billing/confirm`, `/api/billing/cancel` | 동일 | 일치 (2026-07-16, 서버 `api/billing_api.py`·`docs/DATA_MODEL.md` 24장 대조. `billing-api.ts`, 전부 Bearer). checkout `{plan_code}` → `{customer_key, client_key, plan_code, amount, order_name}` (400=무료·없는 플랜, 503=결제 키 미설정). confirm `{auth_key, customer_key, plan_code}` → `MySubscriptionResponse` (**502**=결제사 청구 실패 → `BillingChargeError`, **503** → `BillingUnavailableError`). cancel(바디 없음) → `MySubscriptionResponse` (400=유료 구독 아님). **요청에 금액이 없다** — 청구액은 서버가 `plans.price_krw`로 정한다. 앱에 내려오는 키는 `client_key`(공개값)뿐이고 **checkout 응답으로만** 받는다 |
| 결제 내역·영수증 | `GET` | `/api/payments`, `/api/payments/{id}` | 동일 | 일치 (`payment-api.ts`, Bearer. 앱 계약: 목록 `{ payments: [PaymentItem] }` 최신순, 단건 `PaymentItem`·본인 것만·**404**=`PaymentNotFoundError`). 자동결제 연동(24장) 이후 confirm·갱신 배치가 이 원장에 행을 쌓는다 — 실패 청구도 `status='failed'` + `fail_reason`(사용자용 한국어)로 남는다 |
| 로그아웃(서버 세션 폐기) | `POST` | `/api/auth/logout` | 동일 | 일치 (`auth-api.ts`, 2026-07-11 openapi.json 실측. Bearer 첨부, 실패해도 앱은 로컬 세션 삭제) |
| 음식 이미지 분류 | `POST` | `/api/predict` | 동일 | 일치 (Gemini 비전, 한국어 라벨). **2026-07-16: 응답이 `predictions`(한 음식의 후보 나열) → `foods`(사진 속 **서로 다른 음식들**, 각 `label`·`score`·`portion_g`, 최대 10)로 바뀜 — 서버 22장.** 쿼터는 **사진당 1건**(음식 개수 무관). 앱(`calorie-api.ts`)은 배포 전환기 대비로 `foods` 없으면 `predictions`를 foods로 받아들인다. 끼니 구성 화면은 분할 로직을 갖췄으나 **현재 기본은 대표 음식 1개만** 초안 항목으로 만든다(`compose.tsx`의 `MULTI_FOOD_SPLIT=false` — 원래대로 한 객체, true면 `foods[]` 전부 분할). 항목은 `/api/nutrition/estimate`(쿼터 0)로 kcal을 채우고, **업로드한 사진은 로컬 URI로 미리보기만**(서버 저장 안 함). 사진은 고른 뒤 **분석 버튼**을 눌러야 predict를 호출한다(자동 요청 안 함 — 쿼터 오용 방지). 직접 입력 항목은 **이름만 쓰면 estimate로 칼로리를 자동 조회**한다(kcal 비어 있을 때만, 쿼터 0). 응답의 **`vision_used`·`vision_limit`**(오늘 사용량, 사진당)로 남은 건수를 표시. (레거시 `/api/gpt-predict`는 2026-07-12 제거) |
| 프로필·목표·끼니·체중 | — | `/api/me/**`, `/api/meals*`, `/api/weights`, `/api/nutrition/estimate` | 동일 | 일치 (`health-api.ts`. `PUT /api/meals/{meal_id}` 전체 교체 수정 포함 — 2026-07-11 user 15 실측, `logged_at` 생략 시 기존 시각 유지). **2026-07-16: 과거 날짜 끼니 기록 지원.** 끼니 구성 화면(`app/meals/compose.tsx`)이 `POST /api/meals`에 `logged_at`을 실어 과거 날짜에 기록한다 — 서버 끼니 하루 경계가 **UTC 자정**이라, 캘린더 셀 D에서 다시 보이도록 `logged_at`을 `D`의 **UTC 정오**로 앵커한다(`dayAnchorLoggedAt`). append(기존 끼니에 항목 추가)는 `logged_at` 생략 + `PUT`으로 기존+신규 항목 전체를 보낸다 |
| 칼로리·영양 추정 | `POST` | `/api/nutrition/estimate` | 동일 | 일치 (2026-07-13, `DATA_MODEL.md` **19장**). 서버가 식약처 DB에 없는 음식은 **AI로 1회 추정해 DB에 적재·동결**한다 → 같은 음식은 항상 같은 값. `source === 'llm'`이면 실측이 아닌 **AI 추정값**이라 기록 화면이 'AI 추정' 배지를 띄운다. **404** = 추정까지 실패(수동 입력) → `NutritionNotFoundError`, **503** = 추정 백엔드 일시 장애(재시도 가능) → `NutritionUnavailableError` |
| 회원 탈퇴 | `DELETE` | `/api/me` | 동일 | 일치 (`health-api.ts` `deleteAccount`, 2026-07-11 openapi.json 확인 — 물리 삭제·전 토큰 무효라 로컬 호출 실측은 하지 않는다) |
| 주/월 추이 집계 · **캘린더** | `GET` | `/api/me/trends?start_date&end_date` | 동일 | 일치 (`health-api.ts`, 2026-07-11 openapi.json·user 15 실측. Bearer 필수, 최대 92일, 초과·역순 400). 추이 탭의 **캘린더 뷰**(2026-07-13, `components/kcal-calendar.tsx`)가 같은 API를 '해당 달 1일~말일' 범위로 재사용한다 — 서버 신규 API 없음. 날짜를 누르면 `GET /api/meals?date=`로 그날 끼니를 읽는다 |
| 동의·건강 프로필·질병·알러지 | — | `/api/me/consents*`, `/api/me/{health-profile\|conditions\|allergies}` | 동일 | 일치 (`onboarding-api.ts`) |
| 선택지 참조 | `GET` | `/api/meta/options` | 동일 | 일치 (`meta-api.ts`) |
| 그룹 | — | `/api/groups`, `/api/groups/join`, `/api/groups/{id}`, `/api/groups/{id}/pets` | 동일 | 일치 (`group-api.ts`, 2026-07-10 로컬 실측). **2026-07-14: `GET /api/groups/{id}`의 `members[].phone_number_masked` → `members[].nickname`**(카카오 닉네임, 없으면 서버가 '이름 미설정') |
| 그룹 라이프사이클 | `DELETE` | `/api/groups/{id}`, `/api/groups/{id}/members/me`, `/api/groups/{id}/members/{user_id}`, `/api/groups/{id}/pets/{pet_id}` | 동일 | 일치 (`group-api.ts`, 2026-07-11 openapi.json·403/404 비파괴 실측. 파괴적 라우트는 비멤버 404 은닉, detail 한국어 — DATA_MODEL.md 17장) |
| 반려동물·급여 | — | `/api/pets`, `/api/pets/{id}`, `/api/pets/{id}/feedings` | 동일 | 일치 (`pet-api.ts`, 2026-07-10 로컬 실측. `PetResponse.recommended_kcal`(RER×MER, null 가능)은 2026-07-11 user 15 실측 — 18장) |
| 식단 추천 | `GET` | `/api/recommendations?meal_type&date` | 동일 | 일치 (`recommendation-api.ts`, 2026-07-10 로컬 실측. Bearer + sensitive_health 동의 필수 — 미동의 403) |
| 기록 시 알러지·질병 경고 판정 | `POST` | `/api/nutrition/warnings` | 동일 | 일치 (`health-api.ts`, 2026-07-11 openapi.json·user 15 실측. Bearer + sensitive_health 동의 필수 — 미동의 403. 라벨 1~10개, 해당 없으면 빈 배열) |

**모든 경로가 일치합니다.** 서버의 `ck-local` 브랜치를 `master`에 머지한 뒤(`a03ebdf`) 앱 기본값과 맞아떨어졌습니다. 그 전까지는 분류가 `/predict`였고 칼로리 계산은 미구현이었습니다.

### 402 — 요금제 한도 초과 (전 라우트 공통)

서버(`main.py`의 전역 핸들러)가 어느 라우트에서든 같은 본문을 줍니다:
`{ detail, code: 'plan_limit_exceeded', resource, plan, limit }` (`resource` = `vision_daily` | `owned_groups` | `group_members` | `pets`).

`services/http.ts`의 **`apiFetch`가 402를 `PlanLimitError`로 변환해 던집니다.** 개별 API 클라이언트는 402를 다루지 않습니다 — 화면이 `catch`에서 `error instanceof PlanLimitError`로만 분기해 `components/plan-limit-banner.tsx`(요금제 화면 `/plan`으로 유도)를 그립니다. 402가 나올 수 있는 호출: `POST /api/predict`, `POST /api/groups`, `POST /api/groups/join`, `POST /api/groups/{id}/pets`, `POST /api/pets`.

### 토스페이먼츠 자동결제 (2026-07-16) — **결제는 웹 전용**

```
요금제 화면 [구독하기]  (웹에서만 그린다)
  └─ POST /api/billing/checkout {plan_code} → {client_key, customer_key, amount, order_name}
  └─ 토스 SDK(script 동적 로드) payment.requestBillingAuth({ method:'CARD', successUrl, failUrl })
       성공 → /billing/success?plan=<code>&authKey=…&customerKey=…   (토스가 & 로 덧붙인다)
       실패 → /billing/fail?code=…&message=…                        (USER_CANCEL = 취소, 오류 아님)
  └─ /billing/success 가 POST /api/billing/confirm → 카드 등록 + 최초 청구 → 구독 활성화
요금제 화면 [자동결제 해지] → POST /api/billing/cancel  (기간까지는 유료 유지)
```

- **토스 SDK를 npm으로 설치하지 마세요.** 브라우저 전용(`window`·`document` 의존)이라 번들에 들어가면 네이티브가 DOM 없는 런타임에서 평가합니다. `services/toss-sdk.ts`가 **웹에서만** `https://js.tosspayments.com/v2/standard`를 script 태그로 1회 로드합니다(프라미스 캐시).
- **네이티브에는 결제 버튼을 그리지 않습니다.** `isBillingSupported()`(= `Platform.OS === 'web'`)가 false면 "결제는 웹에서 진행해주세요" 안내만 그립니다 (인앱결제 예정).
- **`client_key`를 `EXPO_PUBLIC_*`에 넣지 마세요.** 서버 checkout 응답으로만 받습니다. 시크릿 키·빌링키는 서버 밖으로 나오지 않습니다.
- **`changePlan`(PUT)을 업그레이드에 쓰지 마세요.** 유료 플랜은 400입니다. 유료 구독자의 '그만두기'는 **`cancelBilling()`**입니다 — PUT lite는 즉시 적용되며 **남은 유료 기간을 포기시킵니다.**
- **`confirm`은 마운트 1회만** 부릅니다 (`app/billing/success.tsx`의 ref 가드). `authKey`는 1회용입니다. 단 **ref 가드는 마운트 안에서만 삽니다** — 이 화면의 URL은 토스가 브라우저를 통째로 되돌려 만든 실제 URL이라 새로고침·뒤로가기로 새 마운트가 생기면 가드가 초기화되고 소비된 `authKey`로 confirm이 다시 나가 502가 됩니다. 그래서 **confirm 실패를 확정하기 전에 `fetchMySubscription()`으로 서버 상태를 되묻습니다**(2026-07-16). 요청한 유료 플랜이 실효 플랜으로 내려오면 청구는 이미 성공한 것이라 성공 화면을 그립니다 — 이게 없으면 결제에 성공한 사람에게 '다시 시도'를 권해 **이중 결제**로 몹니다. 진짜 카드 거절은 구독이 lite로 남아 있어 이 되물음을 통과하지 못하므로 오류 화면이 그대로 동작합니다.
- **해지 확인에 `Alert.alert`를 쓰지 마세요.** react-native-web의 `Alert.alert`는 **no-op**(`static alert() {}`)이라 결제 주 무대인 웹에서 확인 없이 넘어갑니다. 화면 안 2단계 확인을 씁니다.

### 카카오 로그인 (2026-07-14, 휴대폰 OTP 전면 대체)

인증 수단은 **카카오 로그인 하나**입니다. `POST /api/auth/{signup,login}/request-code`·`/verify`와 `dev_code` 개념은 서버·앱 양쪽에서 **제거**됐습니다.

```
앱  WebBrowser.openAuthSessionAsync(`${AUTH_API_URL}/kakao/start?platform=native`, 'kcalairn://auth')
서버 → 카카오 302 → 사용자 동의 → 카카오 → 서버 콜백 → 딥링크 복귀
     성공  kcalairn://auth?code=<1회용 연동코드>&is_new=true|false
     실패  kcalairn://auth?error=cancelled|invalid_state|expired|kakao_unavailable
앱  is_new=false → POST /api/auth/kakao/login  { link_code }
    is_new=true  → 동의 2종 + 요금제 선택 → POST /api/auth/kakao/signup { link_code, agreed_terms, agreed_privacy, plan_code }
```

- **연동 코드는 1회용·TTL 10분**입니다. 동의 화면에 오래 머물면 만료되고, 그때는 카카오 로그인부터 다시 해야 합니다 (`KakaoLinkExpiredError` → 화면이 처음 단계로 되돌립니다).
- `error=cancelled`는 오류가 아니라 정상 흐름입니다 — `KakaoCancelledError`로 구분해 **에러 배너를 띄우지 않습니다.**
- **네이티브 카카오 SDK(`@react-native-seoul/kakao-login` 등)를 설치하지 마세요.** 카카오는 Redirect URI에 커스텀 스킴을 등록할 수 없고 `client_secret`이 필요해 토큰 교환은 서버가 합니다. 앱에 카카오 키를 넣지 않습니다.
- 딥링크 목적지 `kcalairn://auth`는 서버의 `APP_DEEPLINK_SCHEME`와 `app.json`의 `scheme`이 **문자 단위로 일치**해야 합니다. Expo Go는 스킴이 `exp://`라 카카오 로그인이 동작하지 않습니다 (dev client/스탠드얼론 빌드 필요).
- 웹 빌드는 `platform=web`으로 열고 서버가 같은 오리진의 `/auth?...`로 되돌립니다. 팝업이 부모 창에 결과를 넘기도록 `app/auth.tsx`가 마운트 시 `completeKakaoAuthSession()`(= `WebBrowser.maybeCompleteAuthSession()`)을 부릅니다.

---

## 알려진 문제 (작업 전 반드시 인지)

| # | 내용 | 근거 |
|---|------|------|
| 1 | ~~세션이 메모리에만 저장~~ **해결.** 네이티브는 `expo-secure-store`, **웹은 `localStorage`**로 영속화(`restoreAuthSession`으로 복원). 웹도 새로고침하면 로그인이 유지된다 — 토스 결제창에서 복귀한 `/billing/success`가 Bearer로 confirm을 부를 수 있는 근거다. | `services/auth-session.ts` |
| 2 | ~~서버에 토큰 검증 코드가 없습니다~~ **해소.** 서버가 `api/dependencies.py`의 `get_current_user`로 Bearer 세션을 검증합니다. `apiFetch`가 세션이 있을 때 헤더를 붙이는 동작은 그대로입니다. | `services/http.ts` |
| 9 | **Expo Go에서는 카카오 로그인이 동작하지 않습니다.** Expo Go의 스킴은 `exp://`인데 서버는 `kcalairn://auth`로만 되돌립니다. **dev client 또는 스탠드얼론 빌드**로 확인하세요 (`docs/LOCAL_BUILD.md`). | `services/auth-api.ts` |
| 10 | **웹 로그인은 FastAPI가 웹 빌드를 서빙하는 프로덕션 구성에서만 성립합니다.** `expo start --web`(:8081) + 서버(:8000)는 오리진이 갈려 콜백 팝업이 막힙니다. | `services/auth-api.ts` |
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
- **네이티브 카카오 SDK를 도입하지 않는다.** 앱은 `expo-web-browser`로 서버 start URL만 엽니다 (위 '카카오 로그인' 절).
- **토스 SDK를 npm으로 설치하지 않는다.** 브라우저 전용이라 네이티브 번들을 오염시킵니다 — 웹에서만 script 태그로 동적 로드합니다 (위 '토스페이먼츠 자동결제' 절).
- **결제 금액을 앱에서 서버로 보내지 않는다.** `confirm` 요청 스키마에 금액 필드가 없습니다. 앱이 보낸 금액을 서버가 받으면 100원짜리 Premium이 팔립니다 (서버 DATA_MODEL.md 24장).
- **`changePlan`(PUT `/api/me/subscription`)으로 업그레이드하지 않는다.** 유료 플랜은 400입니다. 유료 구독자에게는 `cancelBilling()`을 붙입니다.
- **카카오 REST 키·`client_secret`을 앱에 넣지 않는다.** `EXPO_PUBLIC_*`는 번들에 평문 노출됩니다 — 토큰 교환은 서버에서만 합니다.
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
