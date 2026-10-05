import type { Href } from 'expo-router';

// 탭마다 색 하나 (2026-10-05 화면 재구성 — docs/DESIGN.md '탭 색·게임 톤'). 상세 화면도 들어온 탭의
// 색을 이어 쓴다: 한 번 더 들어가도 지금 어느 방(식단·케어·진료)인지 잃지 않게.
// fill 은 버튼 면(흰 글자 4.5:1 이상), shade 는 테두리·눌림 그림자, tint 는 옅은 배경, text 는
// 흰 배경·tint 위 글자색이다. 탭 화면(home·trends·visit)은 같은 hex 를 직접 쓴다.
export type TabTone = 'meal' | 'care' | 'visit';

export const TAB_TONES: Record<
  TabTone,
  { label: string; href: Href; fill: string; shade: string; tint: string; text: string }
> = {
  meal: { label: '식단', href: '/home', fill: '#c4561b', shade: '#8f3b0e', tint: '#ffebdd', text: '#8f3b0e' },
  care: { label: '케어', href: '/trends', fill: '#2a7d76', shade: '#1c5a55', tint: '#eef7f5', text: '#1c5a55' },
  visit: { label: '진료', href: '/visit', fill: '#2f5fc4', shade: '#1e4290', tint: '#e3ebfb', text: '#1e4290' },
};
