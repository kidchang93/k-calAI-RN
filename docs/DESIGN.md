# DESIGN

## 설계 원칙

1. **AI 데모가 아니라 건강 관리 루틴의 일부처럼 보인다.** 화면 문구와 흐름을 그 기준으로 판단합니다.
2. **네트워크 경계는 `services/`에만 있다.** 화면은 `fetch`를 직접 호출하지 않습니다.
3. **서버 응답을 신뢰하지 않는다.** 타입 가드를 통과한 값만 화면으로 넘깁니다.
4. **실패는 사용자가 이해할 수 있는 한국어 문장으로 표시한다.**
5. **입력 흐름이 길어지면 사용자는 기록을 포기한다.** 단계를 늘리는 변경은 신중히 판단합니다.

## 코드에서 확인된 설계 결정

| 결정 | 위치 | 이유 |
|------|------|------|
| API 클라이언트를 `services/`로 분리하고 타입을 함께 수출 | `services/calorie-api.ts:3` | 화면이 응답 형태를 재정의하지 않게 함 |
| 응답을 런타임 검증 후 반환 | `calorie-api.ts:54`, `:83` | 서버 스키마 오류가 화면 크래시로 이어지지 않게 함 |
| 서버 오류 메시지를 파싱해 `Error`로 던짐 | `readErrorMessage` | 화면은 `error.message`만 알면 됨 |
| 세션을 Context 대신 모듈 싱글톤 + 리스너로 관리 | `services/auth-session.ts` | Provider 중첩 없이 어느 라우트에서든 바로 구독 |
| 인증 가드를 `<Redirect>` 선언형으로 구현 | `app/(tabs)/_layout.tsx`, `app/auth.tsx` | 루트 레이아웃의 `useEffect` + `router.replace()`는 네비게이터 마운트 전에 실행되어 `assertIsReady()` 예외를 던짐 |
| 기본 API URL에 `Platform.OS === 'android'` 분기 | `services/*.ts` | 에뮬레이터의 `10.0.2.2` 호스트 매핑 |
| 끼니 구성은 사진마다 초기화가 아니라 **항목을 누적** | `app/meals/compose.tsx` | 한 끼에 반찬 여러 장을 이어 담아야 한다. 사진·검색·직접입력을 섞어 초안 목록에 쌓고 한 번에 저장 |
| 그룹 진입점은 홈, 반려동물 진입점은 내 정보 | `app/(tabs)/home.tsx`, `app/(tabs)/account.tsx` | 매일 보는 곳이라야 모임이 굴러간다 (기획 목업 확정) |
| 탭 밖 스택(그룹·펫)은 네이티브 헤더 대신 `BackButton` | `components/back-button.tsx` | 중첩 Stack 헤더의 뒤로가기 귀속 문제를 피하고 기존 화면 골격(headerShown: false) 유지 |
| 목록 화면은 `useFocusEffect`로 포커스마다 재조회 | `app/groups/index.tsx`, `app/pets/index.tsx`, 상세 화면들 | 생성·수정 화면에서 돌아왔을 때 갱신 (홈 화면 패턴) |
| 펫 단건 조회는 목록에서 찾는다 | `app/pets/[id]/index.tsx` | 서버에 `GET /api/pets/{id}` 단건 API가 없음 (DATA_MODEL.md 9장) |
| `PetForm`은 서버 타입을 import 하지 않고 구조적 타입 선언 | `components/pet-form.tsx` | `components/ → services/` 의존 금지. `PetFormValue`는 `PetUpsertRequest`와 구조 호환 |
| 초대코드 공유는 RN `Share` 시트 | `app/groups/[id].tsx` | 추가 의존성 없이 OS 공유. 취소·미지원(web)은 오류로 취급하지 않음 |
| predict `foods[]`는 후보가 아니라 **사진 속 서로 다른 음식**이라 전부 초안으로 담는다 | `app/meals/compose.tsx`, `services/calorie-api.ts` | 한 접시의 여러 메뉴를 하나도 버리지 않는다. 각 음식은 개별 항목으로 편집·삭제 (구계약 `predictions`는 전환기 폴백) |
| 식단 추천 진입점은 홈 (그룹 카드와 같은 행 패턴) | `app/(tabs)/home.tsx`, `app/recommendations/` | 다음 끼니를 정하는 곳은 오늘 요약 옆이다 (기획 목업) |
| 추천 고지 문구는 서버 `disclaimer`를 그대로 표시 | `app/recommendations/index.tsx` | 앱 하드코딩 문구가 화면마다 어긋나는 것을 막는다 (DATA_MODEL.md 11장) |
| 추천 403은 `ConsentRequiredError`로 동의 화면 리다이렉트 | `services/recommendation-api.ts` | 질병·알러지를 쓰는 조회라 온보딩 화면들의 403 규약과 동일하게 처리 |
| estimate 404(DB 미매칭)는 에러 배너가 아니라 수동 입력 유도 | `app/meals/compose.tsx`, `NutritionNotFoundError` | 유사도 검색은 결정적이라 재시도가 무의미하다. 서버 detail 문구를 안내로 쓰고 kcal 비운 초안으로 잇는다 (13장) |
| estimate 유사도 매칭 이름을 초안 라벨로 채우고 그 이름으로 저장 | `app/meals/compose.tsx` | 어떤 음식으로 인식됐는지 투명하게 — 화면에 보여준 이름과 기록된 이름을 일치시킨다 |
| `quality: 0.86`, `aspect: [4,3]`로 업로드 이미지 축소 | `app/(tabs)/index.tsx`, `app/meals/compose.tsx` | 업로드 크기와 지연 절감 |
| 홈 목표 CTA는 내 정보 탭이 아니라 목표 수정 화면(`/me/goal`)으로 직행 | `app/(tabs)/home.tsx` | 탭에 내려놓고 다시 찾게 하지 않는다 — 막다른 길 제거 |
| 홈 끼니 카드 탭 → 해당 날짜 기록 목록(`/meals?date=`) | `app/(tabs)/home.tsx`, `app/meals/index.tsx` | 합계만 보이고 개별 기록을 지울 수 없던 문제 해소. 삭제 후 홈 복귀 시 `useFocusEffect`가 합계 재조회 |
| 로그아웃은 서버 폐기 실패에도 로컬 세션을 지운다 | `app/(tabs)/account.tsx` | 오프라인에서도 기기에서 로그아웃할 수 있어야 한다 |
| 카카오 로그인을 네이티브 SDK 없이 `expo-web-browser`로만 구현 | `services/auth-api.ts` | 카카오는 Redirect URI에 커스텀 스킴을 등록할 수 없고 `client_secret`이 필요하다 — 토큰 교환은 서버가 한다. 네이티브 SDK를 넣으면 iOS/Android 네이티브 설정이 붙고 **웹 빌드가 깨진다** (서버 CLAUDE.md 21장의 같은 판단) |
| 로그인·회원가입 탭을 없애고 진입점을 버튼 하나로 | `app/auth.tsx` | 신규 여부는 서버가 `is_new`로 알려준다. 사용자에게 "가입인가 로그인인가"를 먼저 묻는 것은 앱이 모르는 것을 사용자에게 떠넘기는 질문이다 |
| 카카오 취소(`error=cancelled`)는 에러 배너를 띄우지 않는다 | `KakaoCancelledError` | 사용자가 스스로 닫은 것은 실패가 아니다. 오류로 표시하면 앱이 고장난 것처럼 보인다 |
| 연동 코드 400(만료·소비)은 화면을 '카카오' 단계로 되돌리고 재시도를 안내 | `KakaoLinkExpiredError`, `app/auth.tsx` | 코드는 1회용·TTL 10분이다. 동의 화면에 오래 머물면 죽는데, 그 코드를 붙들고 재시도 버튼을 주면 영원히 실패한다 |
| 목표 수정 화면은 수동 수정이 없으면 `target_kcal`을 보내지 않는다 | `app/me/goal.tsx` (온보딩 `goal.tsx`와 동일 규칙) | 산출의 단일 진실은 서버 |
| 질병·알러지 수정 화면은 저장값 GET 실패 시 폼을 그리지 않는다 (메타 옵션 실패만 번들 폴백) | `app/me/conditions.tsx`, `app/me/allergies.tsx` | replace-all PUT이라 프리필 없이 저장하면 기존 값(알러지 severity 포함)을 지운다. 온보딩과 달리 수정 화면은 기존 데이터가 걸려 있다 |
| 추이 차트는 라이브러리 없이 View 높이 비례 순수 RN 바 차트 | `app/(tabs)/trends.tsx` | 주 7·월 30개 바 수준에 차트 의존성은 과하다. Expo SDK 54가 버전을 고정하는 `package.json`도 불변 |
| 추이의 `target_kcal: null`은 목표 관련 표기를 전부 생략한다 (0으로 취급 금지) | `app/(tabs)/trends.tsx` | 0으로 치면 모든 날이 "초과"가 되고 달성일 계산이 왜곡된다 — summary(홈)와 동일 규칙. 기준선·범례·달성일 셀을 아예 그리지 않는다 |
| 목표 달성일은 기록한 날(meal_count > 0) 중에서만 센다 | `app/(tabs)/trends.tsx` | 기록 없는 날(0 kcal)을 "달성"으로 세면 안 기록할수록 달성률이 오른다 |
| 체중 추이는 trends API가 아니라 기존 `getWeights()` 전체를 기간으로 필터 | `app/(tabs)/trends.tsx` | 서버가 체중을 trends 응답에 넣지 않기로 확정 (DATA_MODEL.md 15장). 기간 내 기록 없으면 `/me/weights` 진입 안내 |
| 끼니 구성의 알러지·질병 경고는 **비차단** — 저장 버튼 동작 불변 | `app/meals/compose.tsx`, `checkFoodWarnings` | 기획이 "기록할 때 경고"로 확정 (HEALTHCARE_EXPANSION 12장). 차단하면 기록 자체를 포기한다 |
| 경고 조회 실패(401/403/네트워크)는 조용히 스킵 — 배너·에러 UI·스피너 없음 | `app/meals/compose.tsx` `runWarningCheck` | 경고는 부가 기능이라 실패가 기록 흐름을 방해하면 안 된다. 항목 추가·삭제 시 백그라운드 조회 + 시퀀스 경합 차단(늦은 응답 무시) |
| 끼니 수정은 별도 화면 없이 목록 카드 **인라인 편집** (끼니 종류·항목 이름·kcal만) | `app/meals/index.tsx`, `updateMeal` | 재촬영 없는 간단 수정이 목적. PUT은 전체 교체라 `serving_ratio`·`source`·`confidence`는 보존해 다시 보내고, `logged_at`은 생략해 기록 시각을 유지한다 (DATA_MODEL.md 4장) |
| 그룹 소유자 판별은 상세 응답 `owner_id` ↔ 세션 `user.id` 비교 | `app/groups/[id].tsx` | 상세 응답에 "내 역할" 필드가 없다. 목록 `role`은 상세 화면에 없으므로 기존 필드 조합으로 판별. 펫 해제 버튼은 `isOwner \|\| 내 펫(myPets 포함 여부)` |
| 그룹 나가기·삭제·멤버 제거·펫 해제 실패는 서버 한국어 `detail`을 Alert로 그대로 표시 | `app/groups/[id].tsx` | 400/403/404 detail이 사용자용 한국어 문장으로 확정된 계약 (DATA_MODEL.md 17장). 성공 시 나가기·삭제는 `router.back()` — 목록이 `useFocusEffect`로 재조회 |
| 회원 탈퇴는 **2단계 Alert 확인** 후 성공 시에만 `clearAuthSession()` | `app/(tabs)/account.tsx`, `deleteAccount` | 물리 삭제 파기(DATA_MODEL.md 18장)라 되돌릴 수 없다. 2차 Alert에 파기 항목(기록·반려동물·소유 그룹)을 명시. 로그아웃과 달리 서버 파기가 확인돼야 세션을 지운다 — 실패 시 세션 유지 + 오류 Alert |
| 펫 `recommended_kcal`이 null이면 숫자 대신 안내 문구 (`other` 종은 미지원, 그 외는 체중 입력 유도) | `app/pets/[id]/index.tsx` | 서버가 `weight_kg` 없음·`other` 종에 null을 준다(18장). 오늘 급여 kcal 합계가 있으면 `오늘 X / 권장 Y kcal`로 나란히 표시 — kcal 미입력 급여는 합계에서 제외 |
| 402(요금제 한도)를 `apiFetch` **한 곳에서** `PlanLimitError`로 변환 | `services/http.ts` | 서버가 어느 라우트에서든 같은 본문을 준다. 각 API 클라이언트가 따로 처리하면 업그레이드 유도가 화면마다 어긋난다 — 호출부는 `instanceof`로만 분기한다 |
| 402는 `ErrorBanner`(다시 시도)가 아니라 `PlanLimitBanner`(요금제 업그레이드) | `components/plan-limit-banner.tsx` | 한도 초과는 재시도로 풀리지 않는다. 429(기다리면 풀림)와 달리 402는 "결제해야 풀린다"는 뜻이라 다음 행동이 다르다 |
| 요금제 `code`·`resource`를 앱에서 유니온으로 굳히지 않는다 (`string` 유지) | `services/subscription-api.ts`, `services/http.ts` | 요금제는 서버 참조 테이블(`plans`)이 정본이다. 플랜을 추가할 때 앱을 함께 배포해야 하는 결합을 만들지 않는다 (서버 `subscription_schema.py`의 같은 판단) |
| 가입 화면의 요금제는 `GET /api/plans`로 그리고, 실패 시 번들 폴백(`FALLBACK_PLANS`) | `app/auth.tsx` | 메타 옵션과 같은 규칙 — 네트워크 오류로 **가입 자체가 막히면 안 된다**. 기본 선택은 Lite(무료)로, 서버의 `plan_code` 미지정 기본값과 일치시킨다 |
| 동의·요금제는 **가입 바디에만** 싣는다 (로그인 바디는 `{ link_code }` 하나) | `services/auth-api.ts` | 서버가 `kakao/login`과 `kakao/signup`을 분리했다. 기존 회원에게는 동의·요금제 UI를 렌더하지도 않는다 |
| ~~유료 플랜 변경 버튼 옆에 "결제 연동 준비 중 — 지금은 즉시 적용됩니다" 명시~~ **해소** (2026-07-16) | `app/plan.tsx` | 토스페이먼츠 자동결제가 붙어 유료 전환이 실제 청구를 거친다. 아래 결제 관련 행들이 대체한다 |
| 유료 전환은 **오직 결제 흐름**. `changePlan`(PUT)을 업그레이드에 쓰지 않는다 | `app/plan.tsx`, `services/subscription-api.ts` | 서버가 유료 플랜 PUT을 400으로 막는다(24장) — 이 경로엔 결제 검증이 없어 열어 두면 누구나 Premium이 된다. `changePlan`은 무료 전환 전용으로만 남긴다 |
| 유료 구독자의 '그만두기'는 무료 전환(PUT lite)이 아니라 **자동결제 해지**(cancel) | `app/plan.tsx`, `services/billing-api.ts` | PUT lite는 즉시 적용되며 **남은 유료 기간을 포기시킨다** — 이미 낸 돈을 버리는 버튼을 무심코 누르게 두지 않는다. cancel은 기간을 지키고 갱신만 끈다. 그래서 무료 카드에는 버튼 대신 "해지하면 남은 기간 뒤 전환돼요" 안내만 둔다 |
| 해지 확인을 `Alert.alert`가 아니라 **화면 안 2단계 확인**으로 | `app/plan.tsx` `confirmBox` | react-native-web의 `Alert.alert`는 **no-op**(`static alert() {}`)이다. 결제 주 무대가 웹인데 Alert로 물으면 웹에서 확인이 통째로 사라진다. 인라인 확인은 두 플랫폼에서 같게 동작한다 (회원 탈퇴의 2단계 Alert는 네이티브 전용 흐름이라 그대로 둔다) |
| 토스 SDK를 npm이 아니라 **웹에서만 script 태그로 동적 로드** | `services/toss-sdk.ts` | SDK가 브라우저 전용(`window`·`document`)이라 번들에 넣으면 네이티브가 DOM 없는 런타임에서 평가한다. `package.json`도 Expo SDK 54가 고정한다 — 의존성을 늘리지 않는 편이 맞다. `window` 접근은 `billingReturnUrl()`로 services 안에 가둔다 (화면은 DOM을 모른다) |
| 네이티브에는 결제 버튼 대신 "결제는 웹에서 진행해주세요" 안내 | `app/plan.tsx`, `isBillingSupported()` | 토스 결제창은 브라우저 전용이고, 마켓 정책상 디지털 상품은 인앱결제를 붙여야 한다(예정). 누를 수 없는 버튼을 그려 두고 눌렀을 때 실패시키지 않는다 |
| `confirm`은 마운트 1회(ref 가드), 실패해도 **재호출하지 않는다** | `app/billing/success.tsx` | `authKey`는 1회용이라 두 번째 호출은 반드시 실패한다. 실패 시 '다시 시도'는 confirm 재전송이 아니라 `/plan`에서 결제를 처음부터 |
| confirm 실패는 **서버 상태를 되물어 확정한다** (2026-07-16) | `app/billing/success.tsx`, `fetchActivePaidSubscription` | ref 가드는 마운트 안에서만 산다 — 토스가 만든 실제 URL이라 새로고침 한 번이면 가드가 초기화되고 소비된 `authKey`로 confirm이 재발사돼 502가 난다. 그때 첫 confirm은 성공했을 수 있어, 오류를 그리면 **결제 성공자에게 '다시 시도'를 권해 이중 결제**로 몬다. `fetchMySubscription()`이 요청한 유료 플랜을 주면 성공으로 갈아끼운다. 만료 구독은 서버가 lite로 해석하므로(24장) 이 비교는 살아 있는 구독만 통과시키고, 진짜 카드 거절은 lite로 남아 걸러진다 |
| 결제 내역·영수증은 **금액을 상품명과 같은 줄**에 (2026-07-16) | `app/payments/index.tsx`, `app/payments/[id].tsx` | 목록은 두 줄로 읽는다: 위가 '무엇을 얼마에'(상품명 ↔ 금액, baseline 정렬), 아래가 '언제 어떻게 됐나'(날짜 · 상태 배지). 금액을 오른쪽 세로 중앙에 두면 3줄짜리 왼쪽 칼럼의 **가운데(= 날짜 줄)에 걸려** 무엇의 금액인지 눈으로 잇기 어려웠다. 영수증 상세는 상품명을 **헤더 부제 한 곳**에만 둔다(카드에 또 두면 한 화면에 같은 값이 세 번 나온다). 상태 배지는 금액 아래가 아니라 라벨 옆에 둬 720px 카드의 빈 오른쪽을 채운다. **승인 시각이 없으면 라벨이 '시도일시'다** — 나가지도 않은 돈에 '결제일시'를 붙이지 않는다 |
| 영수증 상품명은 **서버가 '{label} 요금제'로** 내려준다 (2026-07-16) | `kcalAI-model/services/payment_service.py`, `_plan_label` | `plans.label_ko`가 'Pro'라 그대로 쓰면 영수증에 "상품명: Pro"로 찍혀 무엇을 샀는지 읽히지 않았다. 결제창 주문명(`billing_service._order_name` = "{label} 요금제 1개월")과 같은 규칙으로 맞췄다. 표시 문자열만 바뀌어 **계약 변경이 아니다**(앱은 받은 값을 그대로 그린다). 라벨을 못 찾은 폴백은 코드(`pro`)라 '요금제'를 붙이지 않는다 |
| 가입 시 **앱이 그린 문서의 버전**을 서버로 보낸다 (2026-07-16) | `services/auth-api.ts`, `constants/legal.ts`·`constants/consent.ts` | 이전에는 가입 요청에 버전 필드가 없어 서버가 자기 상수를 박았다 — 문서를 개정하고 구버전 앱이 남아 있으면 **사용자는 v1.0을 보고 동의했는데 DB에는 "2.0에 동의함"으로 기록**된다(증빙이 거짓이 된다). 이제 `TERMS.version`·`PRIVACY_POLICY.version`을 보내고 서버가 대조해 다르면 400 → 업데이트 안내. 상수를 호출부에서 받지 않고 `auth-api.ts`가 `legal.ts`를 직접 읽는다 — 사용자가 보는 문서와 보내는 버전이 **같은 원본**에서 나와야 갈리지 않는다. ⚠️ 문서를 개정하면 서버 상수(`consent_service`)와 **같은 작업 단위에서** 올릴 것 |
| 약관·처리방침 **정본은 `constants/legal.ts`** (2026-07-16) | `constants/legal.ts`, `app/legal/*`, `components/legal-document-view.tsx` | 2026-07-16까지 약관 **본문도 링크도 앱에 없었다** — 이름만 있는 체크박스에 동의를 받고 있었다(웹 번들까지 디코딩해 확인). 정본을 한 곳에 두는 이유는 드리프트다: 마크다운 문서와 앱 상수를 따로 두면 하나만 고쳐져 **사용자가 본 약관과 검토받은 약관이 갈린다.** 구조화된 상수(제목 + 문단 배열)라 마크다운 파서 의존성이 없다. 각 조항에 **근거 코드를 주석으로** 달았다 — 그 코드가 바뀌면 약관도 같은 작업 단위에서 고쳐야 한다. 레이아웃에 인증 가드를 두지 않는다(동의 전에 읽어야 하므로). 가입 화면의 '보기'는 체크박스 **밖**에 둔다 — 안에 두면 문서를 열려다 동의가 토글된다 |
| 동의 철회는 **내 정보 → 동의 관리**에서 (2026-07-16) | `app/me/consents.tsx`, `app/(tabs)/account.tsx` | 온보딩이 "내 정보에서 언제든 철회할 수 있어요"라고 고지하는데(`onboarding/consent.tsx`·`blood.tsx`) **그 경로가 없었다** — `revokeConsent`는 구현돼 있었으나 호출부 0건의 dead code였고, 앱이 지키지 못할 약속을 하고 있었다. 철회하면 서버가 혈액형·질병·알러지를 **물리 삭제**하므로(`consent_service._destroy_sensitive_data`) 화면 안 2단계 확인으로 그 사실을 알린다. **가입 필수 동의(약관·처리방침)에는 철회 버튼을 두지 않는다** — 서버 revoke는 받아주지만 `revoked_at`만 채울 뿐 이용은 그대로라, 버튼을 두면 "철회했는데 계속 쓰인다"는 더 나쁜 거짓말이 된다. 그만두는 길은 회원 탈퇴다. `CONSENT_VERSION`은 두 화면이 같은 값을 보내야 해서 `constants/consent.ts`로 옮겼다(라우트 파일에 두면 한쪽만 고쳐진다) |
| 기간 중 플랜 변경은 **결제창 전에 손실을 고지**한다 (2026-07-16) | `app/plan.tsx`, `changeCostNotice` | 서버는 플랜 변경을 전액 재청구 + 기간 재설정으로 처리한다(`_activate_subscription`이 `current_period_end = 오늘 + 1개월`) — 7/1에 Pro를 사고 7/16에 바꾸면 남은 16일이 환불 없이 사라지고, **다운그레이드도 즉시 전액이 청구된다.** 전액 재청구는 감수한 결정이지만(서버 24장) 화면에는 "매월 자동으로 결제돼요"뿐이라 사용자가 모르고 눌렀다. 남은 일수·금액을 계산해 2단계 확인으로 보여준다. 확인은 **잃을 것이 있을 때만** — 무료 회원의 첫 구독에는 끼우지 않는다(마찰만 는다). 결제창이 뜬 뒤에는 안내를 넣을 자리가 없어 `subscribe()` 앞에서 가른다. 조사는 라벨에 붙이지 않는다(`plan.label`이 영어라 받침을 판정할 수 없다 — "Pro으로"가 된다. '요금제'를 끼워 회피) |
| 해지 버튼·갱신 실패 경고는 **실효 플랜이 아니라 `next_billing_at`·`status`로 판정** (2026-07-16) | `app/plan.tsx`, `canCancel`·`subscriptionStatus` | 갱신 실패 시 서버는 기간을 줄이지 않은 채 `past_due`로 두고 최대 3일 재청구하는데(`billing_service._mark_past_due`), 그 사이 기간이 지나면 `plan`은 lite로 해석돼 내려온다. 실효 플랜으로 판정하면 **카드가 계속 긁히는 동안 해지 버튼과 경고가 둘 다 사라진다**. 서버 `cancel_billing`은 저장된 `plan_code`로 판정하므로 이 창에서도 해지는 정상 동작한다 — 앱이 멀쩡한 탈출구를 가리고 있었다 |
| 결제 결과 화면(`/billing/*`)에는 `BackButton`을 두지 않고 이동은 전부 `router.replace` | `app/billing/success.tsx`, `app/billing/fail.tsx` | 뒤가 토스 결제창이다. 되돌아오면 소비된 `authKey`로 confirm을 다시 부른다 — 탭 밖 스택의 BackButton 관례를 여기서만 깬다 |
| 토스 `USER_CANCEL`·`PAY_PROCESS_CANCELED`는 오류가 아니라 '취소' 톤으로 | `app/billing/fail.tsx` | 카카오 `error=cancelled`와 같은 판단 — 사용자가 스스로 닫은 것을 빨간 오류로 그리면 앱이 고장난 것처럼 보인다. 오류 코드도 취소일 때는 감춘다(노이즈) |
| 502(청구 실패)·503(결제 미설정)을 `BillingChargeError`·`BillingUnavailableError`로 분리 | `services/billing-api.ts` | "카드가 거절됐다"와 "결제가 아직 준비되지 않았다"는 사용자가 할 수 있는 일이 다르다 — 제목 문구가 갈린다. 402를 `PlanLimitError`로 한 곳에서 좁히는 것과 같은 규칙 |
| `MySubscription`의 신규 4필드는 누락 시 **무료 회원 기본값**으로 흘린다 (기존 3필드는 필수 검증 유지) | `services/subscription-api.ts` `parseMySubscription` | 2026-07-16에 **추가**된 필드라 구버전 서버 응답엔 없다. 없다고 요금제 화면 전체를 '응답 형식 오류'로 막으면 배포 전환기에 화면이 죽는다 |
| `status`(active/canceled/past_due)를 유니온으로 굳히지 않고 `string`으로 받는다 | `services/subscription-api.ts` | 요금제 `code`·결제 `status`와 같은 규칙 — 서버가 상태를 늘려도 앱을 함께 배포하지 않아도 되게. 화면은 아는 값만 분기하고 나머지는 기간 표시로 흘린다 |
| 오늘 남은 인식 건수는 `predict` 응답의 `vision_used`/`vision_limit`로 표시 (별도 조회 없음) | `app/meals/compose.tsx` | 서버가 응답에 담아 준다. 기록 흐름에 조회를 하나 더 얹지 않는다 — 값이 없으면 표시를 생략한다. 쿼터는 **사진당 1건**(음식 개수 무관)이라 그 문구도 함께 안내 |
| 기록 탭을 분석 화면이 아니라 **런처**로, 끼니 구성은 `compose` 한 곳으로 단일화 | `app/(tabs)/index.tsx`, `app/meals/compose.tsx` | 오늘·과거·기존 끼니 추가가 같은 다중 항목 로직을 쓴다. 화면이 서비스에 의존하는 구성 로직을 두 곳에 복제하지 않는다 (`components/`는 `services/` 의존 금지). 사진은 URI 파라미터로 넘겨 compose가 마운트 시 자동 분석 |
| 신규 끼니 `logged_at`을 그 날짜의 **UTC 정오**로 앵커 | `app/meals/compose.tsx`, `services/health-api.ts` `dayAnchorLoggedAt` | 서버는 끼니 하루를 UTC 자정으로 나눈다. 캘린더 셀 D에 추가한 끼니가 그 셀에서 다시 보이려면 `logged_at`의 UTC 날짜가 D여야 한다 — 정오 앵커면 타임존 무관하게 D로 고정 |
| append(기존 끼니에 항목 추가)는 기존 항목을 그대로 보존해 PUT 전체 교체 | `app/meals/compose.tsx`, `updateMeal` | PUT은 전체 교체다. `getMeals(date)`로 기존 항목을 읽어 편집 없이 다시 싣고 신규만 더한다. `logged_at` 생략으로 기존 시각 유지 (DATA_MODEL.md 4장) |
| 캘린더·기록 목록에 **빈 날짜에도** 추가 진입점 노출, 선택 날짜를 파라미터로 전달 | `app/(tabs)/trends.tsx`, `app/meals/index.tsx` | 과거 빈 날짜가 막다른 길이던 문제 해소. `router.push('/meals')`가 날짜를 버려 오늘로 폴백되던 버그도 함께 수정 |

## 선택지 데이터 규칙 (2026-07-09 확정)

온보딩의 질병·알러지 선택지는 앱 하드코딩이 아니라 **서버 참조 테이블이 정본**입니다 (`kcalAI-model/docs/DATA_MODEL.md` 10장). 화면은 진입 시 `GET /api/meta/options`로 칩 목록을 받아 그리고, 네트워크 실패 시 **번들 폴백 상수**(서버 시드와 동일한 code/label)로 그립니다 — 온보딩이 네트워크 오류로 막히면 안 됩니다. 서버로는 한국어 라벨이 아니라 **표준 code**를 보냅니다. '없음' 칩은 서버 값이 아니라 앱 전용입니다(replace-all PUT 빈 배열). 끼니·섭취량·혈액형처럼 화면 구조에 붙은 값은 코드 상수를 유지합니다.

## 의도적으로 하지 않은 것

- **상태 관리 라이브러리를 쓰지 않습니다.** `useState` + 모듈 싱글톤으로 충분한 규모입니다.
- **비밀번호가 없습니다.** 카카오 로그인이 유일한 인증 수단입니다 (2026-07-14, 휴대폰 OTP 제거).
- **네이티브 카카오 SDK를 쓰지 않습니다.** `expo-web-browser`로 서버 start URL만 엽니다 — 앱에 카카오 키가 없습니다.

## 미완성 설계 (구현 전 반드시 확인)

| 항목 | 현재 상태 | 필요한 결정 |
|------|-----------|-------------|
| ~~세션 영속화~~ | **완료.** `expo-secure-store`로 저장·복원 (웹은 메모리 폴백) | `services/auth-session.ts` |
| ~~토큰 사용~~ | **완료.** `apiFetch`가 세션 있으면 `Authorization: Bearer` 첨부, 401 시 세션 비움 | `services/http.ts`. 서버 `get_current_user` 도입 대기 |
| ~~로그아웃~~ | **완료.** 내 정보 탭에서 확인 Alert → `POST /api/auth/logout` → 로컬 세션 삭제 (서버 폐기 실패에도 삭제 = 오프라인 로그아웃 허용) | `app/(tabs)/account.tsx` |
| 칼로리 프롬프트 | 앱에 하드코딩 (`calorie-api.ts:71`) | 서버 템플릿화 시점 |
| ~~다크모드~~ | **라이트 전용 확정** (2026-07-12). 테마 인프라(`ThemedText`·`constants/theme` 등) 제거, 실화면은 하드코딩 팔레트 | 해소 |
| 상태 탭 | 개발자용 진단 화면(`explore.tsx`)은 **삭제** (2026-07-13) — 서버 endpoint URL 노출 제거 | 해소 (삭제됨) |
| ~~템플릿 잔재~~ | **삭제됨** (2026-07-12): `modal.tsx`, `hello-wave.tsx`, `parallax-scroll-view.tsx`, `collapsible.tsx`, `external-link.tsx` | 해소 |

## 새 API 클라이언트 추가 절차

1. `services/<domain>-api.ts` 파일을 만듭니다.
2. 서버 응답 형태를 `type`으로 선언하고 **export** 합니다. 필드명은 서버의 `snake_case`를 그대로 씁니다.
3. 기본 URL에 `Platform.OS === 'android'` 분기를 넣고, `EXPO_PUBLIC_*` 환경변수로 덮어쓸 수 있게 합니다.

```typescript
const DEFAULT_X_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/x' : 'http://127.0.0.1:8000/api/x';

export const X_API_URL = process.env.EXPO_PUBLIC_X_API_URL ?? DEFAULT_X_API_URL;
```

4. `async function`을 작성합니다. 반드시 다음 순서를 지킵니다.

```typescript
export async function doSomething(input: Input): Promise<Output> {
  const response = await fetch(X_API_URL, { method: 'POST', headers: {...}, body: ... });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `작업 실패: ${response.status}`);   // 한국어 폴백 메시지
  }

  const data = (await response.json()) as { field?: unknown };

  if (typeof data.field !== 'string') {                            // 런타임 검증 필수
    throw new Error('서버 응답에 field 값이 없습니다.');
  }

  return data.field;
}
```

5. 서버(`kcalAI-model`)에 해당 경로가 **실제로 존재하는지 확인합니다.** `curl -sf localhost:8000/openapi.json`으로 대조하세요 (과거 없는 `/api/gpt-predict`를 호출하던 코드가 있었고, 2026-07-12에 제거했습니다).

## 새 화면 추가 절차

1. `app/` 하위에 파일을 만듭니다. 파일명이 곧 경로입니다. **라우트가 아닌 파일을 `app/`에 두지 마세요.**
2. `export default function <Name>Screen()` 형태로 기본 export 합니다.
3. `SafeAreaView`(`react-native-safe-area-context`에서 import — react-native의 것은 deprecated) → `ScrollView contentContainerStyle={styles.container}` 골격을 따릅니다.
4. 화면 전용 하위 컴포넌트는 **같은 파일 하단에 named function**으로 둡니다 (`ActionButton`, `PredictionRow`, `StatusItem`). 여러 화면이 공유할 때만 `components/`로 승격합니다.
5. `StyleSheet.create`를 파일 맨 아래에 둡니다.
6. 탭에 노출하려면 `app/(tabs)/_layout.tsx`에 `<Tabs.Screen>`을 추가합니다.

## 상태 관리 규칙

- 화면 로컬 상태는 `useState`. 파생 값은 `useMemo` (`confidence` 계산).
- 비동기 작업마다 별도의 `isXxx` 플래그를 둡니다 (`isUploading`, `isCalculating`, `isRequesting`, `isVerifying`). 하나의 `loading`으로 합치지 않습니다.
- 오류는 화면당 하나의 `errorMessage: string | null`로 모읍니다.
- 새 작업을 시작할 때 `setErrorMessage(null)`로 먼저 지웁니다.
- `finally`에서 로딩 플래그를 내립니다.

```typescript
setIsUploading(true);
setErrorMessage(null);
try {
  ...
} catch (error) {
  setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
} finally {
  setIsUploading(false);
}
```

## 오류 표시 규칙

| 상황 | 방식 |
|------|------|
| 권한 거부, 사용자 선행 조건 미충족 | `Alert.alert(제목, 안내문)` — 즉시 차단해야 하는 경우 |
| 네트워크·서버 오류 | 화면 내 `errorBox` 배너 (`#fff5f5` 배경 + `error-outline` 아이콘) |
| 서버가 준 메시지 | 그대로 표시. 없으면 `` `업로드 실패: ${response.status}` `` 같은 폴백 |

모든 사용자 노출 문자열은 **한국어**이며, 다음 행동을 알려주는 문장으로 씁니다.

- `'분석할 음식 사진을 먼저 촬영하거나 선택해주세요.'`
- `'음식 사진을 촬영하려면 카메라 권한을 허용해주세요.'`

## 디자인 토큰 (실화면 기준)

실제 화면은 아래 팔레트를 하드코딩합니다 (라이트 전용 확정, 테마 토큰 시스템은 제거됨).

| 용도 | 값 |
|------|-----|
| 배경 | `#f7f8fa` |
| 카드 | `#ffffff` |
| 강조 / 프라이머리 | `#3182f6` |
| 강조 배경 | `#edf6ff`, `#f5f9ff` |
| 제목 텍스트 | `#191f28` |
| 본문 텍스트 | `#333d4b`, `#4e5968` |
| 보조 텍스트 | `#6b7684`, `#8b95a1` |
| 입력/채움 배경 | `#f2f4f6` |
| 비활성 | `#b4c7e7`, `#b0b8c1`, `#d1d6db`, `#e5e8eb` |
| 성공 | `#20c997` |
| 오류 | `#e5484d`, 배경 `#fff5f5` |
| 카카오 브랜드 (버튼 배경 전용) | `#fee500` + 텍스트 `#191f28` |
| 라운드 | `8` (pill은 `999`) |
| 눌림 상태 | `opacity: 0.74` |

`#fee500`은 **카카오 로그인 버튼에만** 쓰는 브랜드 색입니다 (`app/auth.tsx`, 카카오 로그인 디자인 가이드). 다른 화면·다른 용도로 확장하지 않습니다.

새 화면은 이 팔레트를 따릅니다. **새로운 색상을 임의로 추가하지 마세요.** 토큰화가 필요하다고 판단되면 별도 작업으로 제안합니다.
