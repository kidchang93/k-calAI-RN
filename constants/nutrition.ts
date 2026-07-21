// 영양 수치 표기 규약. 추천 화면과 끼니 구성 화면이 **같은 말**을 쓰도록 한 곳에 둔다.
// 판정 자체는 서버가 한다 (kcalAI-model/docs/CKD_NUTRITION.md 3-4).

import { NutrientTier } from '@/services/recommendation-api';

// '위험·금지'로 읽히는 표현을 쓰지 않는다 — 상대 안내이지 처방이 아니다.
export const NUTRIENT_TIER_LABELS: Record<NutrientTier, string> = {
  low: '낮음',
  mid: '보통',
  high: '높음',
};

export const NUTRIENT_LABELS = {
  sodium: '나트륨',
  potassium: '칼륨',
  phosphorus: '인',
} as const;
