import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChunkyButton } from '@/components/chunky-button';
import { DetailHeader } from '@/components/detail-header';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { NutrientChip, NutrientChips } from '@/components/nutrient-chips';
import { Screen } from '@/components/screen';
import { MEAL_TYPE_LABELS, MEAL_TYPES, MealType, isMealType } from '@/constants/meal';
import { TAB_TONES } from '@/constants/tab-tone';
import { DISPLAY_FONT } from '@/constants/typography';
import { formatFoodLabel } from '@/services/food-label';
import { formatDateParam } from '@/services/health-api';
import { ConsentRequiredError } from '@/services/onboarding-api';
import {
  DietRecommendation,
  ExcludedFiltered,
  ExcludedRule,
  getRecommendation,
  nextMealType,
  RecommendationItem,
} from '@/services/recommendation-api';

function paramMealType(value: string | undefined): MealType {
  return isMealType(value) ? value : nextMealType();
}

export default function RecommendationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal_type?: string }>();
  // 홈 카드에서 넘어오면 그 카드가 보여준 끼니를 그대로 연다 — 화면이 바뀌면서 메뉴가
  // 달라지면 "방금 본 것"을 다시 찾아야 한다. 파라미터가 없으면 시각으로 정한다.
  const [mealType, setMealType] = useState<MealType>(() => paramMealType(params.meal_type));
  const [recommendation, setRecommendation] = useState<DietRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 칩을 연속으로 탭했을 때 늦게 도착한 이전 끼니 응답이 현재 선택을 덮어쓰지 않게 한다.
  const loadSeqRef = useRef(0);

  const loadRecommendation = useCallback(
    async (target: MealType) => {
      const seq = ++loadSeqRef.current;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await getRecommendation(target, formatDateParam(new Date()));

        if (loadSeqRef.current === seq) {
          setRecommendation(result);
        }
      } catch (error) {
        if (loadSeqRef.current !== seq) {
          return;
        }

        // 403(동의 없음/철회/이전 버전 동의)은 세션 만료가 아니다. 동의 관리로 보낸다.
        // 온보딩 동의 화면으로 보내면 안 된다(2026-09-13, KCAL-22): 동의 뒤 온보딩 질병·알러지·신체 화면이
        // 이어지는데 프리필 없는 전체 교체 PUT 이라, 이전 버전 동의자(데이터가 남아 있다)의 값을 덮어쓴다.
        if (error instanceof ConsentRequiredError) {
          router.replace('/me/consents');
          return;
        }

        setRecommendation(null);
        setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        if (loadSeqRef.current === seq) {
          setIsLoading(false);
        }
      }
    },
    [router]
  );

  useEffect(() => {
    void loadRecommendation(mealType);
  }, [mealType, loadRecommendation]);

  // '이걸로 먹었어요' — 오늘 이 끼니로 기록 화면을 연다. food_label 은 **원래 이름**(조회 키)이다.
  // 화면 표시용 formatFoodLabel 을 넘기면 estimate 가 다른 음식을 찾을 수 있다.
  const logRecommended = (item: RecommendationItem) =>
    router.push({
      pathname: '/meals/compose',
      params: { date: formatDateParam(new Date()), meal_type: mealType, food_label: item.name },
    });

  const excludedRules =
    recommendation?.excluded.filter(
      (entry): entry is ExcludedRule => entry.type === 'allergen' || entry.type === 'condition'
    ) ?? [];
  const excludedFiltered =
    recommendation?.excluded.filter(
      (entry): entry is ExcludedFiltered => entry.type === 'filtered'
    ) ?? [];

  return (
    <Screen gap={16}>
      <DetailHeader
        caption="남은 칼로리와 건강 정보에 맞춰 오늘의 메뉴를 골라드려요."
        title={`${MEAL_TYPE_LABELS[mealType]} 뭐 먹지?`}
        tone="meal"
      />

      <View accessibilityLabel="끼니" style={styles.pillRow}>
        {MEAL_TYPES.map((type) => {
          const isSelected = type === mealType;

          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setMealType(type)}
              style={({ pressed }) => [
                styles.pill,
                isSelected && styles.pillSelected,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                {MEAL_TYPE_LABELS[type]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <LoadingState label="메뉴를 불러오는 중입니다." />
      ) : errorMessage ? (
        <ErrorBanner message={errorMessage} onRetry={() => void loadRecommendation(mealType)} />
      ) : recommendation === null ? null : (
        <>
          {excludedRules.length > 0 ? (
            <View style={styles.excludedBox}>
              <MaterialIcons color="#2a7d76" name="verified-user" size={18} />
              <View style={styles.excludedBody}>
                <Text style={styles.excludedText}>
                  {`${excludedRules.map((entry) => entry.label).join(' · ')} 제외 반영`}
                </Text>
                {excludedFiltered.length > 0 ? (
                  <Text style={styles.excludedSubText}>
                    {`추가 제외: ${excludedFiltered.map((entry) => entry.name).join(', ')}`}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {recommendation.items.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialIcons color="#a9a6a1" name="search-off" size={32} />
              <Text style={styles.emptyTitle}>조건에 맞는 메뉴를 찾지 못했어요</Text>
              <Text style={styles.emptyText}>
                제외 조건과 남은 칼로리 안에서 고를 수 있는 메뉴가 없습니다. 다른 끼니를
                선택해보세요.
              </Text>
            </View>
          ) : (
            <View style={styles.itemSection}>
              {recommendation.items.map((item) => (
                <RecommendationCard
                  key={`${item.name}-${item.kcal}`}
                  item={item}
                  onLog={() => logRecommended(item)}
                />
              ))}
            </View>
          )}

          {/* 등급(낮음·보통·높음)이 절대 기준이 아니라는 고지. 서버 문구를 그대로 쓴다.
              등급 칩 바로 아래에 둔다 — 칩과 떨어지면 무엇에 대한 말인지 읽히지 않는다. */}
          {recommendation.tier_notice !== null ? (
            <Text style={styles.tierNotice}>{recommendation.tier_notice}</Text>
          ) : null}

          {/* 질병 기반 식이 도움말 (신장병이면 칼륨 저감 조리법 등). 서버가 문구를 내려보낸다. */}
          {recommendation.tips.length > 0 ? (
            <View style={styles.tipsBox}>
              <MaterialIcons color="#1c5a55" name="lightbulb-outline" size={20} />
              <View style={styles.tipsBody}>
                <Text style={styles.tipsTitle}>식이 도움말</Text>
                {recommendation.tips.map((tip) => (
                  <Text key={tip} style={styles.tipsText}>{`• ${tip}`}</Text>
                ))}
              </View>
            </View>
          ) : null}

          {/* 고지 문구는 서버가 내려보낸 문자열을 그대로 표시한다 — 앱 하드코딩 금지. */}
          <Text style={styles.disclaimer}>{recommendation.disclaimer}</Text>
        </>
      )}
    </Screen>
  );
}

function RecommendationCard({ item, onLog }: { item: RecommendationItem; onLog: () => void }) {
  const nutrients = buildNutrientChips(item);

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTopLine}>
        <Text style={styles.itemName}>{formatFoodLabel(item.name)}</Text>
        <Text style={styles.itemKcal}>{`${item.kcal.toLocaleString()} kcal`}</Text>
      </View>
      <Text style={styles.itemReason}>{item.reason}</Text>
      {/* 실측 나트륨·칼륨·인·단백질 (신장병 등 질병 사용자용). 값 없는 항목은 숨긴다. */}
      <NutrientChips chips={nutrients} />
      {/* 고른 메뉴를 바로 기록으로 — 추천이 막다른 화면이 되지 않게 한다(보조 동작이라 테두리 버튼). */}
      <ChunkyButton label="이걸로 먹었어요 · 남기기" onPress={onLog} tone="meal" variant="outline" />
    </View>
  );
}

// 실측값이 있는 영양소만 칩으로. mg 은 정수 반올림, g 은 소수 첫째 자리.
// 등급은 서버가 판정한 칼륨·인만 붙는다 — 나트륨·단백질은 1인분 기준 근거가 병기에 따라
// 갈려 등급을 매기지 않는다 (kcalAI-model/docs/CKD_NUTRITION.md 3-4).
function buildNutrientChips(item: RecommendationItem): NutrientChip[] {
  const chips: NutrientChip[] = [];

  if (item.sodium_mg !== null) {
    chips.push({ label: '나트륨', value: `${Math.round(item.sodium_mg)}mg`, tier: null });
  }
  if (item.potassium_mg !== null) {
    chips.push({
      label: '칼륨',
      value: `${Math.round(item.potassium_mg)}mg`,
      tier: item.potassium_tier,
    });
  }
  if (item.phosphorus_mg !== null) {
    chips.push({
      label: '인',
      value: `${Math.round(item.phosphorus_mg)}mg`,
      tier: item.phosphorus_tier,
    });
  }
  if (item.protein_g !== null) {
    chips.push({ label: '단백질', value: `${formatGram(item.protein_g)}g`, tier: null });
  }

  return chips;
}

function formatGram(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  disclaimer: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 8,
    padding: 24,
  },
  emptyText: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
    textAlign: 'center',
  },
  excludedBody: {
    flex: 1,
    gap: 4,
  },
  excludedBox: {
    alignItems: 'flex-start',
    backgroundColor: '#eef7f5',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    padding: 14,
  },
  excludedSubText: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 21,
  },
  excludedText: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 10,
    padding: 14,
  },
  itemKcal: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '800',
  },
  itemName: {
    color: '#22211f',
    flex: 1,
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
  },
  itemReason: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 22,
  },
  itemSection: {
    gap: 12,
  },
  itemTopLine: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  pill: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e4e2de',
    borderRadius: 999,
    borderWidth: 2,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillSelected: {
    backgroundColor: TAB_TONES.meal.fill,
    borderColor: TAB_TONES.meal.shade,
  },
  pillText: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '800',
  },
  pillTextSelected: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.74,
  },
  tierNotice: {
    color: '#5c5b57',
    fontSize: 14,
    lineHeight: 20,
  },
  tipsBody: {
    flex: 1,
    gap: 4,
  },
  tipsBox: {
    alignItems: 'flex-start',
    backgroundColor: '#eef7f5',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    padding: 14,
  },
  tipsText: {
    color: '#22211f',
    fontSize: 15,
    lineHeight: 22,
  },
  tipsTitle: {
    color: '#1c5a55',
    fontFamily: DISPLAY_FONT,
    fontSize: 17,
  },
});
