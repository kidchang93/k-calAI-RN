# App Store 심사 제출 자료

> 2026-10-05 작성. App Store Connect(ASC) 앱 '케어테이블'(ascAppId 6819191246)에 그대로 붙여 넣는 값과,
> 거부 사유별 대응 상태를 한 곳에 둔다. 근거 조항 해설은 서버 `docs/LEGAL_COMPLIANCE.md` §6.
> 빌드·업로드 절차는 `/kcal-release ios` 스킬.

## 0. 거부 사유별 상태

| 조항 | 내용 | 상태 |
|---|---|---|
| 4.8 | 소셜 로그인만 있으면 대안 로그인 필수 | ✅ Sign in with Apple 구현 · 운영 키 등록(2026-10-05). 빌드 6 TestFlight 실기기 확인(2026-10-06) — 버튼의 'Apple'만 로마자(상표라 정상) |
| 5.1.2(i) | 제3자 AI로 개인정보를 보내기 **전** 명시적 동의 (2025-11 개정) | ✅ 사진 분석 전 동의 · 거절 시 직접 입력 · 동의 관리에서 거두기 · 서버가 EXIF 제거. 빌드 6 TestFlight 실기기 확인(2026-10-06) |
| 2.1 / 2.3 | 자리표시자·미완성 화면 | ✅ 사업자 정보(`EXPO_PUBLIC_BUSINESS_*`)를 앱 `.env`·`eas env` production 에 등록, 시행일 2026-10-05. 빌드 6 번들에 `[[` 0건(2026-10-05) |
| 2.1(a) | 로그인이 필요한 앱은 **내용이 든** 데모 계정(아이디·비밀번호) | ✅ 2026-10-06 베타 심사 반려(빌드 6 — 베타 쪽 메모가 비어 있었다) → **이메일 가입으로 데모 계정을 만들었다**(운영 회원 13 '케어테이블 심사', 고객문의 이메일). 신장병 비투석+고혈압·민감정보 동의·최근 4일 끼니 12개(사진 인식 1)·체중 3·검사 수치 9·다음 진료일과 물어볼 것. 아이디·비밀번호는 저장소 밖 `keys/appstore-demo.env`(600). TestFlight 베타 심사 정보와 버전 1.0 앱 심사 정보 **두 곳 모두** ASC API 로 '로그인 필요'+계정+메모 입력 |
| 5.1.1(v) | 앱 안에서 계정 삭제 | ✅ 내 정보 › 회원 탈퇴 (Apple 토큰 폐기 포함) |
| 5.1.1(ix) | 규제 분야(의료)는 법인이 제출 | ⚠️ 개인 개발자 계정이다. 의료 서비스를 제공하지 않는 식단 기록 도구라는 점을 심사 메모에 밝힌다. 거부되면 §6 |
| 1.4.1 | 의료 앱 — 근거 공개·의사 상담 상기 | ⚠️ **2026-10-20 반려(버전 1.0·빌드 10)** — "건강·의료 계산, 참고 정보, 웰니스 리포트에 출처가 없다. 출처를 링크로 앱 안에 넣고 쉽게 찾을 수 있게 하라." 출처 **문장**(학회 지침 이름·쪽수)은 있었지만 누를 수 있는 링크가 아니었다. ✅ 2026-10-20 코드 대응(앱 미커밋·서버 34장 함께): 의료 수치가 나오는 자리마다 '출처'(`components/citation-links.tsx` — 누르면 원문)를 붙였다 — 소금 항아리·어제 카드·질환 영양 추이·질환 도감 축 카드·검사 입력칸과 페이지 끝·추천·기록 경고·목표 칼로리 계산(Mifflin-St Jeor)·식약처 DB 고지(식단·케어·지난 기록·기록 화면)·진료 리포트 문서 끝(주소까지 인쇄). 서버 근거의 링크는 응답 `citations`, 앱 근거는 `constants/citations.ts`. 전부 모아 보는 화면은 **내 정보 › 근거와 출처**(`app/sources.tsx`). 의료 고지(`MedicalDisclaimer`)는 그대로다. ⏳ 서버 배포 + 새 빌드 + 재제출, 심사 메모에 'Resubmission — Guideline 1.4.1'(출처 위치: 수치 옆 '출처', 내 정보 › 근거와 출처)를 넣는다 |
| 2.5.2 | 심사 후 동작을 바꿀 수 있는 코드(원격 리소스 + 동적 메서드 호출) | ⚠️ 2026-10-13 반려, **Extended Review 경고**(같은 문제로 다시 내면 심사가 길어진다). 반려된 바이너리는 빌드 6/7이다(둘 다 expo-iap 이전 — expo-iap·openiap 3.6.1 소스에도 dlopen/dlsym/performSelector 없음). **원인 추정: `expo-updates`**. 2026-08-03부터 들어 있고, `app.json` `updates.url` 때문에 실행할 때마다 u.expo.dev에 새 JS가 있는지 확인한다. 그런데 `eas update`로 올린 적은 한 번도 없다. `NSSelectorFromString`·`performSelector`·`method_exchangeImplementations`는 expo-modules-core·react-native-screens·expo-font 내부 코드라 모든 Expo 앱에 있다. ✅ 2026-10-13 코드 대응: `expo-updates` 제거(expo-iap 는 참조하지 않음) + `app.json` `updates`·`runtimeVersion`·`eas.json` `channel` 삭제. ✅ **2026-10-13 21:28 재제출**(빌드 10 + 플러스 구독 2개, WAITING_FOR_REVIEW). 회신 문구 "We removed the OTA update library (expo-updates). The app no longer downloads or executes any remote code; all functionality is contained in the reviewed binary."는 API 로 해결 센터에 쓸 수 없어 **심사 메모 맨 앞**('Resubmission — Guideline 2.5.2')에 넣었다 |
| 3.1.1 | 앱 기능 유료화는 IAP | ✅ 지금 제출본(빌드 6)은 결제 없음(무료 출시). ⏳ **플러스 출시 때**: 앱 코드는 2026-10-06 준비됨 — 판매는 App Store 인앱 구독(`expo-iap`, `com.kcalai.kcalairn.plus.monthly`·`.yearly`)뿐이고 **iOS 에서만** 구매 버튼, 웹은 'iPhone 앱에서', Android '준비 중'(다른 결제 수단 안내 없음). 3.1.2 고지(가격·갱신 주기·해지 방법·약관·처리방침·구매 복원)는 `/plus` 구매 버튼 아래. 새 네이티브 빌드·ASC 구독 상품·서버 verify(32장)가 함께 나가야 하고, 그때 아래 2장 메모의 'Payments'와 3장 '구매 내역'을 함께 고친다 |

## 1. URL

| ASC 칸 | 값 |
|---|---|
| 개인정보 처리방침 URL | `https://api.kcalai.link/legal/privacy` |
| 지원 URL | `https://api.kcalai.link/support` (로그인 없이 열린다 — `app/support.tsx`) |
| 마케팅 URL | 비워 둔다 |

## 2. 심사 메모 (App Review Information)

- **로그인 필요(Sign-in required)를 켜고** 데모 계정(이메일 가입 계정)의 아이디·비밀번호를 넣는다. ⚠️ **TestFlight › 테스트 정보 › 베타 앱 심사 정보**와 **버전 › 앱 심사 정보**는 서로 다른 칸이다 — 2026-10-06 반려는 베타 쪽 메모가 비어 있어서였다. 두 곳에 같은 값을 넣는다.
- 데모 계정에는 심사관이 기능을 다 볼 수 있게 내용을 채워 둔다: 민감정보 동의 + 질환(만성신장병), 최근 며칠 끼니(사진 분석 1건 포함), 검사 수치 2개 이상, 다음 진료일·물어볼 것, 진료 리포트가 비지 않을 만큼. 심사관이 탈퇴를 시험하면 계정이 사라지므로 **제출 전에 로그인되는지 다시 확인**한다.
- Notes 칸에 아래를 붙인다.

```
Sign-in
Please use the demo account in the Sign-in fields: enter that email and password in the login form at the top of the first screen and tap "로그인" (Log in). The account already has a condition (chronic kidney disease), consent to health information processing, several days of meals, lab results and a next visit, so every feature can be reviewed.
The app also offers Kakao Login, Sign in with Apple and email sign-up (a 6-digit code is emailed to confirm the address). New accounts confirm they are 14 or older, agree to the Terms and Privacy Policy, then complete a short onboarding.

What the app does
CareTable is a food diary for people who manage a chronic disease through diet (kidney disease, diabetes, hypertension, dyslipidemia). Users log meals by photo or by typing, see sodium/potassium/phosphorus totals calculated from the Korean MFDS food composition database, and prepare a summary report to show their doctor at their next visit.
It does not diagnose, treat, or give medical advice, and it does not measure anything — lab values are typed in by the user from their own lab results. It does not connect to, share data with, or book appointments at any hospital. Screens that show health numbers remind users to consult their care team. Nutrition guidance cites published guidelines (Korean Society of Nephrology, KDOQI, KDIGO).

Third-party AI
Food photo recognition uses Google Gemini. Before the first photo is sent, the app asks for explicit permission and names the provider and the data sent (the food photo; our server strips EXIF metadata such as location before forwarding it). Users who decline can still log meals by typing. Permission can be withdrawn in My Info > Consents. No account identifiers or health data are sent to Google.

Account deletion
My Info > Delete account. All personal data is deleted immediately; Sign in with Apple tokens are revoked.

Payments
CareTable Plus is an auto-renewable subscription (monthly / yearly), sold only via In-App Purchase on iOS. Purchase screen: 내 정보 (My Info) > 이용권 > 플러스 알아보기 — the demo account is on the free plan so the purchase screen can be reviewed. Restore Purchases is on the same screen. Purchases are verified on our server with the App Store Server API. The web version does not sell Plus and does not link to any other payment method.

Operator
Registered business in Korea: 미드나잇모찌 (Midnight Mochi), owner 이창규 (Business Registration No. 880-54-00995).
```

> 2026-10-13: 'Payments'를 플러스 기준으로, 'Operator'를 미드나잇모찌로 바꿨다(약관·처리방침 1.4, 빌드 10). ASC 버전 심사 메모와 TestFlight 베타 심사 메모 **두 곳 모두** 같은 값으로 맞춘다.

## 3. 앱 개인정보 (App Privacy)

추적(Tracking): **아니요** — 광고·분석 SDK가 없다(`package.json`에 없음 — 넣으면 이 표를 고친다).

| 데이터 유형 | 수집 | 사용자와 연결 | 목적 | 무엇 |
|---|---|---|---|---|
| 연락처 정보 › 이름 | 예 | 예 | 앱 기능 | 카카오 닉네임 · Apple이 준 이름 |
| 건강 및 피트니스 › 건강 | 예 | 예 | 앱 기능 | 식단 기록·키·몸무게, 질병·병기·알러지·혈액형, 검사 수치, 진료 메모 |
| 연락처 정보 › 이메일 주소 | 예 | 예 | 앱 기능 | **이메일로 가입한 회원만**(2026-10-06) — 로그인 식별자·인증 코드 메일. 카카오·Apple 회원에게는 받지 않는다 |
| 식별자 › 사용자 ID | 예 | 예 | 앱 기능 | 회원번호 · 카카오 회원번호 · Apple 사용자 식별자 |
| 사용자 콘텐츠 › 사진 또는 비디오 | 예 | 아니요 | 앱 기능 | 음식 사진 — 저장하지 않지만 Google이 남용 탐지 목적으로 제한된 기간 기록할 수 있어 보수적으로 신고한다 |
| 사용자 콘텐츠 › 기타 사용자 콘텐츠 | 예 | 예 | 앱 기능 | 함께 보기 그룹 이름(사용자가 직접 짓는다) — 경계선이지만 저장하므로 신고(2026-10-13) |
| 민감 정보 | 예 | 예 | 앱 기능 | 질환 선택지 **'임신 중'** — Apple 정의의 민감 정보에 "임신 또는 출산 정보"가 들어 있다(처리방침도 임신을 민감정보로 적는다, 2026-10-13) |
| 건강 및 피트니스 › 피트니스 | 예 | 예 | 앱 기능 | 프로필의 **활동량**(평소 활동 정도). 운동 기록 화면은 숨겨져 있어 받지 않는다 — 경계선이지만 신고(2026-10-13) |
| 구매 › 구매 내역 | 예 | 예 | 앱 기능 | 플러스 구독 상품·만료일을 회원에 붙여 둔다(서버 32-2). 매니페스트 `NSPrivacyCollectedDataTypePurchaseHistory`(빌드 9부터) |
| 전화·위치·연락처·검색·진단·기기 ID·오디오·지불 | 아니요 | — | — | 받지 않는다. 사진의 위치(EXIF)는 서버가 지우고 저장하지 않는다. 분석·크래시·푸시 SDK 없음(`package.json` — 넣으면 이 표를 고친다) |

**2026-10-13 ASC 게시 완료(위 9개, 추적 전부 아니요).** 게시 전 ASC 에는 35개 중 32개가 체크돼 있었다 — 손으로 다시 넣지 말고 이 표를 기준으로 맞춘다. 성별·출생연도는 칼로리 목표 계산용이라 '건강'에 포함한 것으로 본다.
⚠️ 앱 매니페스트(`app.json` `privacyManifests`)에는 아직 **피트니스·민감 정보·기타 사용자 콘텐츠**가 없다 — 다음 네이티브 빌드에서 `NSPrivacyCollectedDataTypeFitness`·`…SensitiveInfo`·`…OtherUserContent` 를 더한다.

## 4. 연령 등급

- '의료 또는 치료 정보'만 **드물게/경미**, 나머지는 모두 없음. 제한 없는 웹 접근: 아니요.
- 앱 안에서 만 14세 미만은 가입을 막는다(`app/onboarding/body.tsx`, 개인정보 보호법 제22조의2).

## 5. 그 밖의 ASC 항목

- 카테고리: 기본 **건강 및 피트니스**(의료 아님 — 의료 카테고리는 더 엄격하게 본다).
- 수출 규정 암호화: 없음(`app.json`의 `usesNonExemptEncryption: false`).
- 제3자 콘텐츠: 예 — 식약처 식품영양성분 DB(공공데이터), 학회 지침 인용.
- **대한민국 규정 준수 정보**(ASC › 비즈니스 › 계약 › 규정 준수 › 대한민국 법률): 개인 계정은 이메일과 사업자등록번호. 전화·이메일 인증이 필요해 계정 소유자가 직접 한다.
- **가격 및 사용 가능 여부**(2026-10-13 API): 앱 가격 **무료**(KOR 기준), 판매 국가 **대한민국만**(신규 국가 자동 추가 끔). 비어 있으면 심사 제출이 `APP_PRICING_REQUIRED` 로 막힌다 — 판매 국가는 `POST /v2/appAvailabilities` 에 **175개 국가 전부**를 available true/false 로 넣어야 한다.
- **첫 구독 제출은 API 로 안 된다**(`FIRST_SUBSCRIPTION_MUST_BE_SUBMITTED_ON_VERSION`). 버전 화면에 '앱 내 구입 및 구독' 칸도 없다(2026-10 ASC). **구독 그룹 화면과 구독마다 '심사에 추가' → 기존 iOS 제출 초안**을 고르면 버전과 한 초안에 묶이고, 초안 창의 '심사를 위해 제출'로 낸다. 두 번째 구독부터는 구독 목록에서 따로 낼 수 있다.
- 스크린샷: 6.9" 1290×2796(또는 1320×2868) 최소 1장. 로그인 화면만으로 채우지 않는다 — 앱을 쓰는 화면(식단 홈·기록·진료 리포트)을 담는다.

## 6. 거부되면

- **5.1.1(ix)**(개인 개발자의 건강 앱): 법인 계정으로 옮기는 길은 Apple이 개인사업자를 법인으로 받지 않을 수 있어 막힐 수 있다. 먼저 회신으로 "의료 서비스 제공이 아니라 식단 기록 도구"임을 다시 설명한다.
- **2.1 데모 계정 요구**: Apple로 가입하면 된다고 회신한다. 그래도 계정을 요구하면 운영에 심사용 계정을 만들어야 하는데, 비밀번호 로그인이 없어 별도 설계가 필요하다(인증 우회 경로를 운영에 두는 일이라 신중히).
