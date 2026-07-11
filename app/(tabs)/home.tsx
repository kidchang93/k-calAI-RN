import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MealTypeCard } from '@/components/meal-type-card';
import { ProgressRing } from '@/components/progress-ring';
import { DaySummary, formatDateParam, getSummary, MealBreakdown, MealType } from '@/services/health-api';

const MEAL_ORDER: {
  meal_type: MealType;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { meal_type: 'breakfast', label: '아침', icon: 'wb-sunny' },
  { meal_type: 'lunch', label: '점심', icon: 'restaurant' },
  { meal_type: 'dinner', label: '저녁', icon: 'dinner-dining' },
  { meal_type: 'snack', label: '간식', icon: 'cookie' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const today = formatDateParam(new Date());
      setSummary(await getSummary(today));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 마운트 시 1회가 아니라 탭이 포커스될 때마다 다시 읽는다.
  // 기록 탭에서 끼니를 저장하고 돌아왔을 때 합계를 갱신하기 위함이다.
  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>오늘</Text>
            <Text style={styles.subtitle}>오늘의 섭취량과 목표를 확인하세요.</Text>
          </View>

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>오늘 기록을 불러오는 중입니다.</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.errorBox}>
              <MaterialIcons color="#e5484d" name="error-outline" size={20} />
              <View style={styles.errorBody}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable
                  onPress={() => void loadSummary()}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                  <Text style={styles.retryButtonText}>다시 시도</Text>
                </Pressable>
              </View>
            </View>
          ) : summary === null ? null : summary.target_kcal === null || summary.target_kcal === 0 ? (
            <View style={styles.emptyGoalCard}>
              <MaterialIcons color="#3182f6" name="flag" size={28} />
              <Text style={styles.emptyGoalTitle}>목표를 설정해주세요</Text>
              <Text style={styles.emptyGoalText}>
                하루 목표 칼로리를 정하면 진행률을 볼 수 있습니다.
              </Text>
              <Pressable
                onPress={() => router.push('/me/goal')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>목표 설정하기</Text>
              </Pressable>
            </View>
          ) : (
            <SummaryContent
              targetKcal={summary.target_kcal}
              consumedKcal={summary.consumed_kcal}
              meals={summary.meals}
              onPressMeal={() =>
                router.push({ pathname: '/meals', params: { date: summary.date } })
              }
            />
          )}

          {/* 식단 추천도 홈에서 진입한다 — 다음 끼니를 정하는 곳은 오늘 요약 옆이다. */}
          <Pressable
            onPress={() => router.push('/recommendations')}
            style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}>
            <MaterialIcons color="#3182f6" name="restaurant-menu" size={24} />
            <View style={styles.groupRowBody}>
              <Text style={styles.groupRowTitle}>식단 추천</Text>
              <Text style={styles.groupRowText}>남은 칼로리에 맞춰 골라드려요</Text>
            </View>
            <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
          </Pressable>

          {/* 그룹은 내 정보가 아니라 홈에서 진입한다 — 매일 보는 곳이라야 모임이 굴러간다. */}
          <Pressable
            onPress={() => router.push('/groups')}
            style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}>
            <MaterialIcons color="#3182f6" name="groups" size={24} />
            <View style={styles.groupRowBody}>
              <Text style={styles.groupRowTitle}>내 그룹</Text>
              <Text style={styles.groupRowText}>가족·친구와 함께 기록해요</Text>
            </View>
            <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
          </Pressable>

          <Text style={styles.disclaimer}>AI 추정값이며 실제와 다를 수 있습니다.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryContent({
  targetKcal,
  consumedKcal,
  meals,
  onPressMeal,
}: {
  targetKcal: number;
  consumedKcal: number;
  meals: MealBreakdown;
  onPressMeal: () => void;
}) {
  const target = targetKcal;
  const consumed = consumedKcal;
  const remaining = target - consumed;
  const isOver = remaining < 0;

  return (
    <>
      <View style={styles.ringCard}>
        <ProgressRing progress={target > 0 ? consumed / target : 0} size={220} strokeWidth={18}>
          <Text style={styles.ringValue}>{Math.abs(remaining).toLocaleString()}</Text>
          <Text style={styles.ringLabel}>{isOver ? '초과 kcal' : '남은 kcal'}</Text>
        </ProgressRing>
        <Text style={styles.ringSummary}>
          {`오늘 ${consumed.toLocaleString()} / ${target.toLocaleString()} kcal`}
        </Text>
      </View>

      <View style={styles.mealSection}>
        {MEAL_ORDER.map((meal) => (
          <MealTypeCard
            key={meal.meal_type}
            icon={meal.icon}
            label={meal.label}
            kcal={meals[meal.meal_type]}
            onPress={onPressMeal}
          />
        ))}
      </View>
    </>
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
  emptyGoalCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    padding: 24,
  },
  emptyGoalText: {
    color: '#6b7684',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyGoalTitle: {
    color: '#191f28',
    fontSize: 19,
    fontWeight: '900',
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
  groupRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  groupRowBody: {
    flex: 1,
    gap: 2,
  },
  groupRowText: {
    color: '#6b7684',
    fontSize: 13,
  },
  groupRowTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '800',
  },
  header: {
    gap: 4,
  },
  mealSection: {
    gap: 10,
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
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
  ringCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 16,
    padding: 24,
  },
  ringLabel: {
    color: '#8b95a1',
    fontSize: 15,
    fontWeight: '700',
  },
  ringSummary: {
    color: '#4e5968',
    fontSize: 16,
    fontWeight: '800',
  },
  ringValue: {
    color: '#191f28',
    fontSize: 40,
    fontWeight: '900',
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
