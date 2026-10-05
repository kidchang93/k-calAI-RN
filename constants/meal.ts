export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

export function isMealType(value: unknown): value is MealType {
  return (MEAL_TYPES as readonly unknown[]).includes(value);
}

// 시각 → 방금 먹은 끼니. 앨범 사진이면 **촬영 시각**, 그 외엔 지금 시각을 넣는다(KCAL-20).
// 기록 화면의 기본값과 식단 탭의 '지금' 칸이 같은 경계를 써야 한다 — 다르면 식단 탭에서 점심 칸을
// 눌렀는데 기록 화면이 저녁으로 열린다. 경계(11·16·22시)는 기준과 별개라 여기서 바꾸지 않는다.
export function mealTypeAt(time: Date): MealType {
  const hour = time.getHours();

  if (hour < 11) {
    return 'breakfast';
  }

  if (hour < 16) {
    return 'lunch';
  }

  if (hour < 22) {
    return 'dinner';
  }

  return 'snack';
}
