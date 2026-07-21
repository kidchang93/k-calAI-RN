// 민감정보(건강 정보) 동의 버전. 동의 화면의 **문구를 고치면 이 값을 올린다** — 서버는 재동의마다
// 새 행을 쌓으므로(services/consent_service.py) 누가 어느 버전에 동의했는지가 이력으로 남는다.
//
// 온보딩(app/onboarding/consent.tsx)과 동의 관리(app/me/consents.tsx)가 **같은 값**을 보내야 한다.
// 라우트 파일에 두면 한쪽만 고쳐져 버전이 갈리므로 여기 둔다.
//
// ⚠️ 서버가 가입 시 기록하는 terms·privacy 는 `1.0`(v 없음)이고 이 값은 `v1.0`이라 포맷이 다르다
// (services/consent_service.py 의 TERMS_VERSION·PRIVACY_VERSION). 같은 컬럼에 두 포맷이 섞여 있다 —
// 통일하려면 서버·앱을 같은 작업 단위에서 바꾸고 기존 행 마이그레이션까지 정해야 한다.
export const CONSENT_VERSION = 'v1.0';

// 그룹 활동 공유 동의 버전. 서버 consent_service.GROUP_ACTIVITY_SHARE_VERSION 과 **같아야** 한다.
// 이 동의는 sensitive_health 와 성격이 다르다 — 우리가 수집·이용하는 것이 아니라
// **같은 그룹의 다른 사람에게 내 활동량을 보이는 것**(제3자 노출)이라 따로 받는다.
export const GROUP_ACTIVITY_SHARE_VERSION = 'v1.0';
