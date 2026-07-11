import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { deleteMeal, formatDateParam, getMeals, MealLog, MealType } from '@/services/health-api';

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

const MEAL_TYPE_ICONS: Record<MealType, keyof typeof MaterialIcons.glyphMap> = {
  breakfast: 'wb-sunny',
  lunch: 'restaurant',
  dinner: 'dinner-dining',
  snack: 'cookie',
};

export default function MealListScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  // 홈이 넘긴 날짜(YYYY-MM-DD)만 신뢰한다. 형식이 다르면 오늘로 폴백.
  const date =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : formatDateParam(new Date());

  const [meals, setMeals] = useState<MealLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMeals = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await getMeals(date);

      // 서버 정렬을 신뢰하지 않는다 — 먹은 시각 순으로 보여준다.
      setMeals([...result].sort((a, b) => a.logged_at.localeCompare(b.logged_at)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  // 기록 탭에서 저장하고 돌아왔을 때 갱신되도록 포커스마다 다시 읽는다 (홈 화면 패턴).
  useFocusEffect(
    useCallback(() => {
      void loadMeals();
    }, [loadMeals])
  );

  const confirmDelete = (meal: MealLog) => {
    const label = MEAL_TYPE_LABELS[meal.meal_type];

    Alert.alert(
      '기록 삭제',
      `${label} 기록(${meal.total_kcal.toLocaleString()} kcal)을 삭제할까요? 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => void removeMeal(meal.id) },
      ],
    );
  };

  const removeMeal = async (mealId: number) => {
    setDeletingId(mealId);
    setErrorMessage(null);

    try {
      await deleteMeal(mealId);
      // 삭제 후 재조회. 홈 합계는 복귀 시 useFocusEffect가 갱신한다.
      await loadMeals();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalKcal = meals.reduce((sum, meal) => sum + meal.total_kcal, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>{formatDateTitle(date)}</Text>
            <Text style={styles.subtitle}>
              {meals.length === 0
                ? '이날 저장된 끼니 기록을 보여드려요.'
                : `총 ${totalKcal.toLocaleString()} kcal · ${meals.length}건`}
            </Text>
          </View>

          {errorMessage ? (
            <ErrorBanner message={errorMessage} onRetry={() => void loadMeals()} />
          ) : null}

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>끼니 기록을 불러오는 중입니다.</Text>
            </View>
          ) : meals.length === 0 ? (
            <View style={styles.stateBox}>
              <MaterialIcons color="#b0b8c1" name="no-meals" size={32} />
              <Text style={styles.stateText}>
                아직 기록이 없어요. 기록 탭에서 사진으로 남겨보세요.
              </Text>
            </View>
          ) : (
            <View style={styles.section}>
              {meals.map((meal) => (
                <View key={meal.id} style={styles.mealCard}>
                  <View style={styles.mealHeader}>
                    <View style={styles.mealIconWrap}>
                      <MaterialIcons
                        color="#3182f6"
                        name={MEAL_TYPE_ICONS[meal.meal_type]}
                        size={18}
                      />
                    </View>
                    <View style={styles.mealHeaderBody}>
                      <Text style={styles.mealTypeLabel}>{MEAL_TYPE_LABELS[meal.meal_type]}</Text>
                      <Text style={styles.mealTime}>{formatTime(meal.logged_at)}</Text>
                    </View>
                    <Text style={styles.mealKcal}>{`${meal.total_kcal.toLocaleString()} kcal`}</Text>
                    <Pressable
                      disabled={deletingId !== null}
                      hitSlop={8}
                      onPress={() => confirmDelete(meal)}
                      style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                      {deletingId === meal.id ? (
                        <ActivityIndicator color="#e5484d" size="small" />
                      ) : (
                        <MaterialIcons color="#e5484d" name="delete-outline" size={20} />
                      )}
                    </Pressable>
                  </View>

                  {meal.items.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <Text style={styles.itemLabel}>{item.food_label}</Text>
                      <Text style={styles.itemMeta}>
                        {`${item.serving_ratio}인분 · ${item.kcal.toLocaleString()} kcal`}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          <Text style={styles.disclaimer}>AI 추정값이며 실제와 다를 수 있습니다.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// YYYY-MM-DD → 'M월 D일 기록'
function formatDateTitle(date: string): string {
  const [, month, day] = date.split('-');

  return `${Number(month)}월 ${Number(day)}일 기록`;
}

// 서버의 UTC ISO 문자열을 기기 로컬 시각(HH:MM)으로 표시한다.
function formatTime(isoText: string): string {
  const parsed = new Date(isoText);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
  },
  disclaimer: {
    color: '#8b95a1',
    fontSize: 13,
    textAlign: 'center',
  },
  header: {
    gap: 4,
  },
  itemLabel: {
    color: '#333d4b',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  itemMeta: {
    color: '#6b7684',
    fontSize: 13,
  },
  itemRow: {
    alignItems: 'center',
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mealCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 16,
  },
  mealHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  mealHeaderBody: {
    flex: 1,
    gap: 2,
  },
  mealIconWrap: {
    alignItems: 'center',
    backgroundColor: '#edf6ff',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  mealKcal: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
  },
  mealTime: {
    color: '#8b95a1',
    fontSize: 12,
  },
  mealTypeLabel: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.74,
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    gap: 10,
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
    textAlign: 'center',
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
