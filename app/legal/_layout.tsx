import { Stack } from 'expo-router';

// 약관·개인정보 처리방침은 **로그인 전에도** 볼 수 있어야 한다 — 가입 화면의 동의 체크박스에서
// 여는 문서라, 동의하기 전에 읽을 수 없으면 동의를 받는 의미가 없다. 그래서 payments·pets
// 레이아웃과 달리 인증 가드를 두지 않는다.
export default function LegalLayout() {
  return (
    <>
      {/* 루트 Stack의 'legal' 엔트리 헤더를 숨긴다. 뒤로가기는 BackButton (탭 밖 스택 공통 규칙). */}
      <Stack.Screen options={{ headerShown: false }} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
