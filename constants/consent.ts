// 민감정보(건강 정보) 동의 버전. 동의 화면의 **문구를 고치면 이 값을 올린다** — 서버는 재동의마다
// 새 행을 쌓으므로(services/consent_service.py) 누가 어느 버전에 동의했는지가 이력으로 남는다.
//
// 온보딩(app/onboarding/consent.tsx)과 동의 관리(app/me/consents.tsx)가 **같은 값**을 보내야 한다.
// 라우트 파일에 두면 한쪽만 고쳐져 버전이 갈리므로 여기 둔다. 아래 고지 문구도 같은 이유로 여기 있다 —
// 문구와 버전이 한 파일에 있어야 문구만 고치고 버전을 안 올리는 일이 줄어든다.
//
// ⚠️ 서버 consent_service.SENSITIVE_HEALTH_VERSION 과 **문자 단위로 같아야** 한다. 다르면 서버가 400 을 준다.
// 가입 시 기록하는 terms·privacy 는 `1.1`(v 없음)이고 이 값은 `v1.1`이라 포맷이 다르다
// (constants/legal.ts 의 TERMS.version·PRIVACY_POLICY.version). 같은 컬럼에 두 포맷이 섞여 있다 —
// 통일하려면 서버·앱을 같은 작업 단위에서 바꾸고 기존 행 마이그레이션까지 정해야 한다.
//
// v1.1 (2026-09-13, KCAL-22): v1.0 문구는 혈액형·질병·알러지를 "식단 추천에서 거르는 데만" 쓴다고 했지만,
// 실제로는 검사 수치·진료 메모도 같은 동의로 받고 경고·주간 조언·진료 리포트에도 썼다(개인정보 보호법 제23조 —
// 알린 범위에서만 처리). 서버는 v1.0 동의를 무효로 보고 403 을 준다.
export const CONSENT_VERSION = 'v1.1';

// 그룹 활동 공유 동의 버전. 서버 consent_service.GROUP_ACTIVITY_SHARE_VERSION 과 **같아야** 한다.
// 이 동의는 sensitive_health 와 성격이 다르다 — 우리가 수집·이용하는 것이 아니라
// **같은 그룹의 다른 사람에게 내 활동량을 보이는 것**(제3자 노출)이라 따로 받는다.
export const GROUP_ACTIVITY_SHARE_VERSION = 'v1.0';

export type ConsentNoticeRow = {
  label: string;
  text: string;
};

// ── 민감정보 동의 고지 (v1.1) ────────────────────────────────────────────────
// 개인정보 보호법 제23조①1호가 제15조②를 준용해 동의를 받을 때 알리게 한 것: 이용 목적, 수집 항목,
// 보유·이용 기간, 동의를 거부할 권리와 거부 시 불이익. 처리방침 3항(constants/legal.ts)과 같은 내용이다.
// **여기 문구를 고치면 CONSENT_VERSION 을 올린다.**

export const SENSITIVE_HEALTH_SUMMARY = '혈액형·질병·알러지·검사 수치는 법이 정한 민감정보입니다.';

export const SENSITIVE_HEALTH_NOTICE_ROWS: ConsentNoticeRow[] = [
  {
    // 근거(서버): models/consent_model.py — user_health_profiles(blood_type·rh·ckd_stage)·user_conditions·
    // user_allergies, models/health_model.py — lab_results(검사 항목·수치·검사일·메모), care_visits.outcome.
    // 검사 항목에 혈압이 있다(services/lab_panels.py bp_systolic·bp_diastolic) — 결과지만이 아니라 가정용
    // 혈압계 값도 들어오므로 "결과지 등"이라 쓴다.
    label: '수집 항목',
    text: '혈액형·Rh, 질병(신장질환 병기 포함), 알러지, 검사 수치(결과지 등을 보고 직접 입력한 값, 혈압 포함), 진료에서 들은 내용 메모',
  },
  {
    // 근거(서버): api/nutrition_api.read_record_warnings(경고), services/day_nutrition.py(질환 축 합계),
    // api/coaching_api(주간 조언), services/recommendation_service(추천 제외), api/lab_api(검사 수치),
    // api/visit_api.put_next_visit(진료 메모), services/medical_report_service.build_report(리포트의 질환·병기·검사 수치).
    label: '이용 목적',
    text: '기록할 때 주의가 필요한 음식 경고, 질환 기준의 영양 합계·주간 조언, 식단 추천에서 피할 음식 제외, 검사 수치·진료 메모 기록과 진료에 가져갈 리포트',
  },
  {
    // 근거(서버): consent_service.revoke_consent → _destroy_sensitive_data(철회), account_service.delete_account(탈퇴).
    label: '보유 기간',
    text: '동의를 철회하거나 탈퇴할 때까지 (그때 즉시 파기)',
  },
  {
    label: '제3자 제공',
    text: '제3자에게 제공하지 않습니다.',
  },
];

// 거부권과 불이익. **실제로 막히는 것만** 적는다.
// - 403: require_sensitive_consent 를 거는 서버 라우트 — 건강 프로필·질병·알러지(consent_api),
//   /nutrition/warnings, /recommendations, /me/coaching, /me/lab-panels·/me/labs. 진료 메모는
//   visit_api.put_next_visit 이 내용이 있을 때만 403(날짜만은 동의 없이 저장된다).
// - 403 은 아니지만 비는 것: 질환 기준 영양 합계 — 질병을 입력할 수 없어 services/day_nutrition.py 가 null 을 준다.
// 2026-09-13 전 문구의 "식단 추천은 개인 맞춤 없이 일반 가이드로 제공"은 사실이 아니었다 — 추천은 동의 없이 403 이고
// 화면(app/recommendations/index.tsx)이 동의 화면으로 되돌린다.
export const SENSITIVE_HEALTH_REFUSAL =
  '동의하지 않을 수 있어요. 동의하지 않아도 사진 기록·칼로리 계산, 체중·운동 기록, 진료 일정은 쓸 수 있어요. 다만 질병·알러지를 입력할 수 없어 기록할 때 음식 경고와 질환 기준 영양 합계가 나오지 않고, 식단 추천·주간 조언과 검사 수치·진료 메모 기록도 쓸 수 없어요. 진료 리포트에도 질환·검사 수치가 실리지 않아요.';

// 이전 버전(v1.0)에 동의한 사람에게 무엇이 바뀌었는지 한 줄로 알린다(app/me/consents.tsx).
// **버전을 다시 올리면 이 문구도 새 차이로 고쳐 쓴다.**
export const SENSITIVE_HEALTH_CHANGE_SUMMARY =
  '검사 수치·진료 메모가 수집 항목에, 기록 경고·질환 기준 영양 합계·주간 조언·진료 리포트가 이용 목적에 들어갔어요.';
