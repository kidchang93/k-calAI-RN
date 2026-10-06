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
| 2.1(a) | 로그인이 필요한 앱은 **내용이 든** 데모 계정(아이디·비밀번호) | ⏳ 2026-10-06 베타 심사에서 반려(빌드 6) — 베타 심사 정보에 메모가 비어 있었고, Apple 로 새로 가입하면 빈 계정이라 요건을 못 채운다. **이메일 가입(2026-10-06)으로 데모 계정을 만든다** — 운영 배포 후 심사용 계정을 만들어 기록·검사 수치·진료 일정을 채우고, TestFlight › 테스트 정보와 버전 › 앱 심사 정보 **두 곳 모두**에 '로그인 필요' + 아이디·비밀번호를 넣는다 |
| 5.1.1(v) | 앱 안에서 계정 삭제 | ✅ 내 정보 › 회원 탈퇴 (Apple 토큰 폐기 포함) |
| 5.1.1(ix) | 규제 분야(의료)는 법인이 제출 | ⚠️ 개인 개발자 계정이다. 의료 서비스를 제공하지 않는 식단 기록 도구라는 점을 심사 메모에 밝힌다. 거부되면 §6 |
| 1.4.1 | 의료 앱 — 근거 공개·의사 상담 상기 | ✅ 학회 지침 출처 표시, 수치 화면마다 의료 고지 |
| 3.1.1 | 앱 기능 유료화는 IAP | ✅ 결제 없음(무료 출시). 결제 진입점은 숨김 |

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
This version has no purchases.

Operator
Registered business in Korea: 호시이 스토어 (Business Registration No. 850-09-03410).
```

## 3. 앱 개인정보 (App Privacy)

추적(Tracking): **아니요** — 광고·분석 SDK가 없다(`package.json`에 없음 — 넣으면 이 표를 고친다).

| 데이터 유형 | 수집 | 사용자와 연결 | 목적 | 무엇 |
|---|---|---|---|---|
| 연락처 정보 › 이름 | 예 | 예 | 앱 기능 | 카카오 닉네임 · Apple이 준 이름 |
| 건강 및 피트니스 › 건강 | 예 | 예 | 앱 기능 | 식단 기록·키·몸무게, 질병·병기·알러지·혈액형, 검사 수치, 진료 메모 |
| 연락처 정보 › 이메일 주소 | 예 | 예 | 앱 기능 | **이메일로 가입한 회원만**(2026-10-06) — 로그인 식별자·인증 코드 메일. 카카오·Apple 회원에게는 받지 않는다 |
| 식별자 › 사용자 ID | 예 | 예 | 앱 기능 | 회원번호 · 카카오 회원번호 · Apple 사용자 식별자 |
| 사용자 콘텐츠 › 사진 또는 비디오 | 예 | 아니요 | 앱 기능 | 음식 사진 — 저장하지 않지만 Google이 남용 탐지 목적으로 제한된 기간 기록할 수 있어 보수적으로 신고한다 |
| 전화·위치·연락처·검색·구매·진단 | 아니요 | — | — | 받지 않는다(Apple·카카오는 이메일도 요청 안 함). ⚠️ 플러스(인앱 구독)를 넣으면 **구매 내역**을 추가한다 |

운동 기록(피트니스)은 진입점이 숨겨져 있어 지금은 수집하지 않는다 — 다시 열면 '피트니스'를 추가한다.

## 4. 연령 등급

- '의료 또는 치료 정보'만 **드물게/경미**, 나머지는 모두 없음. 제한 없는 웹 접근: 아니요.
- 앱 안에서 만 14세 미만은 가입을 막는다(`app/onboarding/body.tsx`, 개인정보 보호법 제22조의2).

## 5. 그 밖의 ASC 항목

- 카테고리: 기본 **건강 및 피트니스**(의료 아님 — 의료 카테고리는 더 엄격하게 본다).
- 수출 규정 암호화: 없음(`app.json`의 `usesNonExemptEncryption: false`).
- 제3자 콘텐츠: 예 — 식약처 식품영양성분 DB(공공데이터), 학회 지침 인용.
- **대한민국 규정 준수 정보**(ASC › 비즈니스 › 계약 › 규정 준수 › 대한민국 법률): 개인 계정은 이메일과 사업자등록번호. 전화·이메일 인증이 필요해 계정 소유자가 직접 한다.
- 스크린샷: 6.9" 1290×2796(또는 1320×2868) 최소 1장. 로그인 화면만으로 채우지 않는다 — 앱을 쓰는 화면(식단 홈·기록·진료 리포트)을 담는다.

## 6. 거부되면

- **5.1.1(ix)**(개인 개발자의 건강 앱): 법인 계정으로 옮기는 길은 Apple이 개인사업자를 법인으로 받지 않을 수 있어 막힐 수 있다. 먼저 회신으로 "의료 서비스 제공이 아니라 식단 기록 도구"임을 다시 설명한다.
- **2.1 데모 계정 요구**: Apple로 가입하면 된다고 회신한다. 그래도 계정을 요구하면 운영에 심사용 계정을 만들어야 하는데, 비밀번호 로그인이 없어 별도 설계가 필요하다(인증 우회 경로를 운영에 두는 일이라 신중히).
