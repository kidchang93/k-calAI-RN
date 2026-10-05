import { Redirect } from 'expo-router';

// `/`(웹 첫 화면·`/(tabs)`)는 식단 탭으로 보낸다. 예전엔 여기가 기록 탭이라 웹 주소만 치고 들어온
// 사람이 '오늘'이 아니라 사진 런처부터 봤다. 런처는 `record.tsx`로 옮겨 숨겼다(2026-10-05).
export default function TabsIndex() {
  return <Redirect href="/home" />;
}
