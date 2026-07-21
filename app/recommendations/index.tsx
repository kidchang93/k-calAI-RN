import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ChipGroup } from '@/components/chip-group';
import { formatDateParam, MealType } from '@/services/health-api';
import { ConsentRequiredError } from '@/services/onboarding-api';
import {
  DietRecommendation,
  ExcludedFiltered,
  ExcludedRule,
  getRecommendation,
  NutrientTier,
  RecommendationItem,
} from '@/services/recommendation-api';

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'snack', label: '간식' },
];

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

// 현재 시각 기준 "다음 끼니" 기본값. 기록 탭의 defaultMealType(방금 먹은 끼니)과 달리
// 앞으로 먹을 끼니를 고른다. 사용자가 칩에서 언제든 바꿀 수 있다.
function defaultNextMealType(): MealType {
  const hour = new Date().getHours();

  if (hour < 9) {
    return 'breakfast';
  }

  if (hour < 13) {
    return 'lunch';
  }

  if (hour < 19) {
    return 'dinner';
  }

  return 'snack';
}

export default function RecommendationsScreen() {
  const router = useRouter();
  const [mealType, setMealType] = useState<MealType>(() => defaultNextMealType());
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

        // 403(동의 없음/철회)은 세션 만료가 아니다. 동의 화면으로 되돌린다 (온보딩 화면 규칙).
        if (error instanceof ConsentRequiredError) {
          router.replace('/onboarding/consent');
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

  const selectMealType = (value: string) => {
    const option = MEAL_TYPE_OPTIONS.find((item) => item.value === value);

    if (option) {
      setMealType(option.value);
    }
  };

  const excludedRules =
    recommendation?.excluded.filter(
      (entry): entry is ExcludedRule => entry.type === 'allergen' || entry.type === 'condition'
    ) ?? [];
  const excludedFiltered =
    recommendation?.excluded.filter(
      (entry): entry is ExcludedFiltered => entry.type === 'filtered'
    ) ?? [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>{`${MEAL_TYPE_LABELS[mealType]} 추천`}</Text>
            <Text style={styles.subtitle}>남은 칼로리와 건강 정보에 맞춰 오늘의 메뉴를 골라드려요.</Text>
          </View>

          <ChipGroup
            onToggle={selectMealType}
            options={MEAL_TYPE_OPTIONS}
            selectedValues={[mealType]}
          />

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>추천 메뉴를 불러오는 중입니다.</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.errorBox}>
              <MaterialIcons color="#e5484d" name="error-outline" size={20} />
              <View style={styles.errorBody}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable
                  onPress={() => void loadRecommendation(mealType)}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                  <Text style={styles.retryButtonText}>다시 시도</Text>
                </Pressable>
              </View>
            </View>
          ) : recommendation === null ? null : (
            <>
              {excludedRules.length > 0 ? (
                <View style={styles.excludedBox}>
                  <MaterialIcons color="#3182f6" name="verified-user" size={18} />
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
                  <MaterialIcons color="#8b95a1" name="search-off" size={32} />
                  <Text style={styles.emptyTitle}>추천할 메뉴를 찾지 못했어요</Text>
                  <Text style={styles.emptyText}>
                    제외 조건과 남은 칼로리 안에서 고를 수 있는 메뉴가 없습니다. 다른 끼니를
                    선택해보세요.
                  </Text>
                </View>
              ) : (
                <View style={styles.itemSection}>
                  {recommendation.items.map((item) => (
                    <RecommendationCard key={`${item.name}-${item.kcal}`} item={item} />
                  ))}
                </View>
              )}

              {/* 질병 기반 식이 도움말 (신장병이면 칼륨 저감 조리법 등). 서버가 문구를 내려보낸다. */}
              {recommendation.tips.length > 0 || recommendation.tier_notice !== null ? (
                <View style={styles.tipsBox}>
                  <MaterialIcons color="#3182f6" name="lightbulb-outline" size={18} />
                  <View style={styles.tipsBody}>
                    <Text style={styles.tipsTitle}>식이 도움말</Text>
                    {recommendation.tips.map((tip) => (
                      <Text key={tip} style={styles.tipsText}>{`• ${tip}`}</Text>
                    ))}
                    {/* 등급(낮음·보통·높음)이 절대 기준이 아니라는 고지. 서버 문구를 그대로 쓴다. */}
                    {recommendation.tier_notice !== null ? (
                      <Text style={styles.tierNotice}>{recommendation.tier_notice}</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* 고지 문구는 서버가 내려보낸 문자열을 그대로 표시한다 — 앱 하드코딩 금지. */}
              <Text style={styles.disclaimer}>{recommendation.disclaimer}</Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 등급 표시 문구. '위험·금지'로 읽히지 않게 상대 표현만 쓴다 (CKD_NUTRITION.md 3-4 노출 원칙).
const TIER_LABELS: Record<NutrientTier, string> = {
  low: '낮음',
  mid: '보통',
  high: '높음',
};

type NutrientChip = {
  label: string;
  value: string;
  tier: NutrientTier | null;
};

function RecommendationCard({ item }: { item: RecommendationItem }) {
  const nutrients = buildNutrientChips(item);

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTopLine}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemKcal}>{`${item.kcal.toLocaleString()} kcal`}</Text>
      </View>
      <Text style={styles.itemReason}>{item.reason}</Text>
      {/* 실측 나트륨·칼륨·인·단백질 (신장병 등 질병 사용자용). 값 없는 항목은 숨긴다. */}
      {nutrients.length > 0 ? (
        <View style={styles.nutrientRow}>
          {nutrients.map((chip) => (
            <NutrientPill key={chip.label} chip={chip} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// 등급이 없으면(비대상 사용자·근거 없음) 기존 회색 칩 그대로 — 숫자만 담담하게 보여준다.
function NutrientPill({ chip }: { chip: NutrientChip }) {
  if (chip.tier === null) {
    return (
      <View style={styles.nutrientChip}>
        <Text style={styles.nutrientLabel}>{chip.label}</Text>
        <Text style={styles.nutrientValue}>{chip.value}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.nutrientChip, TIER_CHIP_STYLES[chip.tier]]}>
      <Text style={styles.nutrientLabel}>{chip.label}</Text>
      <Text style={[styles.nutrientValue, TIER_TEXT_STYLES[chip.tier]]}>{chip.value}</Text>
      <Text style={[styles.nutrientTier, TIER_TEXT_STYLES[chip.tier]]}>
        {TIER_LABELS[chip.tier]}
      </Text>
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
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  disclaimer: {
    color: '#8b95a1',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    padding: 24,
  },
  emptyText: {
    color: '#6b7684',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '800',
  },
  errorBody: {
    flex: 1,
    gap: 10,
  },
  errorBox: {
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  errorText: {
    color: '#e5484d',
    fontSize: 14,
  },
  excludedBody: {
    flex: 1,
    gap: 4,
  },
  excludedBox: {
    alignItems: 'flex-start',
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 14,
  },
  excludedSubText: {
    color: '#6b7684',
    fontSize: 12,
    lineHeight: 17,
  },
  excludedText: {
    color: '#4e5968',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  header: {
    gap: 4,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    padding: 16,
  },
  itemKcal: {
    color: '#3182f6',
    fontSize: 15,
    fontWeight: '900',
  },
  itemName: {
    color: '#191f28',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  itemReason: {
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 19,
  },
  itemSection: {
    gap: 10,
  },
  itemTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  nutrientChip: {
    alignItems: 'baseline',
    backgroundColor: '#f2f4f6',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nutrientLabel: {
    color: '#8b95a1',
    fontSize: 11,
    fontWeight: '700',
  },
  nutrientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  nutrientTier: {
    fontSize: 11,
    fontWeight: '800',
  },
  nutrientValue: {
    color: '#4e5968',
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.74,
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#e5484d',
    fontSize: 14,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  stateBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 32,
  },
  stateText: {
    color: '#6b7684',
    fontSize: 14,
  },
  subtitle: {
    color: '#6b7684',
    fontSize: 14,
  },
  tierChipHigh: {
    backgroundColor: '#fff1e9',
  },
  tierChipLow: {
    backgroundColor: '#e9f8f0',
  },
  tierChipMid: {
    backgroundColor: '#fff6e5',
  },
  tierNotice: {
    color: '#6b7684',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  tierTextHigh: {
    color: '#d4571a',
  },
  tierTextLow: {
    color: '#0f8a5f',
  },
  tierTextMid: {
    color: '#b8770c',
  },
  tipsBody: {
    flex: 1,
    gap: 4,
  },
  tipsBox: {
    alignItems: 'flex-start',
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 14,
  },
  tipsText: {
    color: '#4e5968',
    fontSize: 13,
    lineHeight: 19,
  },
  tipsTitle: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '800',
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
});

// 등급별 칩 배경·글자색. styles 를 참조하므로 선언 이후에 둔다.
const TIER_CHIP_STYLES: Record<NutrientTier, object> = {
  low: styles.tierChipLow,
  mid: styles.tierChipMid,
  high: styles.tierChipHigh,
};

const TIER_TEXT_STYLES: Record<NutrientTier, object> = {
  low: styles.tierTextLow,
  mid: styles.tierTextMid,
  high: styles.tierTextHigh,
};
