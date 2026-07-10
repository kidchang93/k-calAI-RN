import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackButton } from '@/components/back-button';
import { ChipGroup } from '@/components/chip-group';
import { formatDateParam, MealType } from '@/services/health-api';
import { ConsentRequiredError } from '@/services/onboarding-api';
import {
  DietRecommendation,
  ExcludedFiltered,
  ExcludedRule,
  getRecommendation,
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

              {/* 고지 문구는 서버가 내려보낸 문자열을 그대로 표시한다 — 앱 하드코딩 금지. */}
              <Text style={styles.disclaimer}>{recommendation.disclaimer}</Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RecommendationCard({ item }: { item: RecommendationItem }) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTopLine}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemKcal}>{`${item.kcal.toLocaleString()} kcal`}</Text>
      </View>
      <Text style={styles.itemReason}>{item.reason}</Text>
    </View>
  );
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
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
});
