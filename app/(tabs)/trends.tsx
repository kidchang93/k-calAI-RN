import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KcalCalendar } from '@/components/kcal-calendar';
import { Segmented } from '@/components/segmented';
import {
  formatDateParam,
  getMeals,
  getTrends,
  getWeights,
  MealLog,
  MealType,
  recentDateRange,
  TrendDay,
  TrendsResponse,
  WeightLog,
} from '@/services/health-api';

type TrendPeriod = 'week' | 'month';
type ViewMode = 'chart' | 'calendar';

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'chart', label: '그래프' },
  { value: 'calendar', label: '캘린더' },
];

const PERIOD_OPTIONS: { value: TrendPeriod; label: string }[] = [
  { value: 'week', label: '7일' },
  { value: 'month', label: '30일' },
];

const PERIOD_DAYS: Record<TrendPeriod, number> = {
  week: 7,
  month: 30,
};

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

const CHART_HEIGHT = 160;

// 'YYYY-MM-DD' → '7.5' (표시 전용. Date 파싱 없이 문자열에서 바로 뽑는다)
function formatShortDate(date: string): string {
  return `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
}

// 해당 달의 1일~말일. 캘린더 모드의 조회 범위다 (최대 31일 — trends의 92일 상한 이내).
function monthRange(month: Date): { start_date: string; end_date: string } {
  const year = month.getFullYear();
  const index = month.getMonth();

  return {
    start_date: formatDateParam(new Date(year, index, 1)),
    end_date: formatDateParam(new Date(year, index + 1, 0)),
  };
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function TrendsScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [period, setPeriod] = useState<TrendPeriod>('week');
  // 캘린더가 보고 있는 달 (해당 달 1일). 그래프 모드에서는 쓰지 않는다.
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMeals, setSelectedMeals] = useState<MealLog[] | null>(null);
  const [isLoadingMeals, setIsLoadingMeals] = useState(false);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [weights, setWeights] = useState<WeightLog[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const todayDate = formatDateParam(new Date());

  // 칩을 연속으로 탭했을 때 늦게 도착한 이전 기간 응답이 현재 선택을 덮어쓰지 않게 한다.
  const loadSeqRef = useRef(0);
  // 날짜를 빠르게 옮길 때 늦게 온 끼니 응답이 현재 선택을 덮어쓰지 않게 한다.
  const mealsSeqRef = useRef(0);

  const loadData = useCallback(async () => {
    const seq = ++loadSeqRef.current;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 캘린더는 보고 있는 '달' 전체가 조회 범위다. 그래프는 오늘 기준 최근 N일.
      const { start_date, end_date } =
        viewMode === 'calendar' ? monthRange(month) : recentDateRange(PERIOD_DAYS[period]);
      const [trendsResult, weightsResult] = await Promise.all([
        getTrends(start_date, end_date),
        getWeights(),
      ]);

      if (loadSeqRef.current === seq) {
        setTrends(trendsResult);
        setWeights(weightsResult);
      }
    } catch (error) {
      if (loadSeqRef.current !== seq) {
        return;
      }

      setTrends(null);
      setWeights(null);
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      if (loadSeqRef.current === seq) {
        setIsLoading(false);
      }
    }
  }, [month, period, viewMode]);

  // 마운트 시 1회가 아니라 탭이 포커스될 때마다 다시 읽는다 (홈 화면 패턴).
  // 기록 탭에서 끼니를 저장하고 돌아왔을 때 그래프를 갱신하기 위함이다.
  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const loadMealsFor = useCallback(async (date: string) => {
    const seq = ++mealsSeqRef.current;

    setIsLoadingMeals(true);
    try {
      const meals = await getMeals(date);

      if (mealsSeqRef.current === seq) {
        setSelectedMeals(meals);
      }
    } catch {
      // 끼니 상세 실패는 캘린더 전체를 막지 않는다 — 빈 목록으로 두고 안내만 한다.
      if (mealsSeqRef.current === seq) {
        setSelectedMeals([]);
      }
    } finally {
      if (mealsSeqRef.current === seq) {
        setIsLoadingMeals(false);
      }
    }
  }, []);

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedMeals(null);
    void loadMealsFor(date);
  };

  const changeMonth = (delta: number) => {
    // 달을 옮기면 이전 달의 선택·끼니는 무효다.
    mealsSeqRef.current += 1;
    setSelectedDate(null);
    setSelectedMeals(null);
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  // 이번 달을 넘어서는 달로는 못 간다 (미래엔 기록이 없다).
  const canGoNextMonth = month < startOfMonth(new Date());

  const summary = useMemo(() => {
    if (trends === null) {
      return null;
    }

    const target = trends.target_kcal;
    const recorded = trends.days.filter((day) => day.meal_count > 0);
    const totalKcal = recorded.reduce((acc, day) => acc + day.consumed_kcal, 0);

    return {
      totalKcal,
      avgKcal: recorded.length > 0 ? Math.round(totalKcal / recorded.length) : 0,
      recordedDays: recorded.length,
      totalDays: trends.days.length,
      // 목표 미설정(null)이면 달성일도 계산하지 않는다. 0으로 취급하면 전 일수가 "달성"이 된다.
      achievedDays:
        target !== null
          ? recorded.filter((day) => day.consumed_kcal <= target).length
          : null,
    };
  }, [trends]);

  // 체중은 별도 API(GET /api/weights) 전체 응답을 조회 기간으로 잘라 쓴다 (DATA_MODEL.md 15장).
  const periodWeights = useMemo(() => {
    if (trends === null || weights === null) {
      return [];
    }

    return weights
      .filter((log) => {
        const localDate = formatDateParam(new Date(log.measured_at));

        return localDate >= trends.start_date && localDate <= trends.end_date;
      })
      .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  }, [trends, weights]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* 제목과 뷰 토글을 한 줄에 둔다 — 칩 두 줄이 세로 공간을 먹어 체중 섹션이
              첫 화면 밖으로 밀려나 있었다. 기간(주/월) 토글은 그래프 카드 안으로 옮겼다. */}
          <View style={styles.header}>
            <Text style={styles.title}>리포트</Text>
            <Segmented onChange={setViewMode} options={VIEW_OPTIONS} value={viewMode} />
          </View>

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>기록을 불러오는 중입니다.</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.errorBox}>
              <MaterialIcons color="#e5484d" name="error-outline" size={20} />
              <View style={styles.errorBody}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable
                  onPress={() => void loadData()}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                  <Text style={styles.retryButtonText}>다시 시도</Text>
                </Pressable>
              </View>
            </View>
          ) : trends === null || summary === null ? null : viewMode === 'calendar' ? (
            <>
              <KcalCalendar
                canGoNext={canGoNextMonth}
                days={trends.days}
                month={month}
                onChangeMonth={changeMonth}
                onSelectDate={selectDate}
                selectedDate={selectedDate}
                targetKcal={trends.target_kcal}
                todayDate={todayDate}
              />

              <DayDetail
                date={selectedDate}
                isLoading={isLoadingMeals}
                meals={selectedMeals}
                onPressAdd={() => {
                  if (selectedDate) {
                    router.push({ pathname: '/meals/compose', params: { date: selectedDate } });
                  }
                }}
                onPressManage={() => {
                  if (selectedDate) {
                    router.push({ pathname: '/meals', params: { date: selectedDate } });
                  }
                }}
              />

              {/* 체중은 두 모드 모두에 둔다 — 한쪽에만 있으면 "있는지 없는지" 모르게 된다.
                  캘린더 모드에서는 보고 있는 달의 기록을 보여준다. */}
              <WeightSection
                logs={periodWeights}
                onPressManage={() => router.push('/me/weights')}
              />

              <Text style={styles.disclaimer}>AI 추정값이며 실제와 다를 수 있습니다.</Text>
            </>
          ) : (
            <>
              {summary.recordedDays === 0 ? (
                <View style={styles.emptyCard}>
                  {/* 기간 토글은 평소 그래프 카드 안에 있다. 빈 기간에도 주↔월 전환은
                      할 수 있어야 하므로 여기서도 노출한다. */}
                  <Segmented
                    compact
                    onChange={setPeriod}
                    options={PERIOD_OPTIONS}
                    value={period}
                  />
                  <MaterialIcons color="#8b95a1" name="show-chart" size={32} />
                  <Text style={styles.emptyTitle}>이 기간에 식단 기록이 없어요</Text>
                  <Text style={styles.emptyText}>
                    기록 탭에서 사진으로 식사를 남기면 여기에서 확인할 수 있습니다.
                  </Text>
                </View>
              ) : (
                <>
                  <KcalBarChart
                    days={trends.days}
                    onChangePeriod={setPeriod}
                    period={period}
                    targetKcal={trends.target_kcal}
                  />

                  <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                      <SummaryStat
                        label="총 섭취"
                        value={`${summary.totalKcal.toLocaleString()} kcal`}
                      />
                      <SummaryStat
                        label="일평균 (기록일)"
                        value={`${summary.avgKcal.toLocaleString()} kcal`}
                      />
                    </View>
                    <View style={styles.summaryRow}>
                      <SummaryStat
                        label="기록한 날"
                        value={`${summary.recordedDays} / ${summary.totalDays}일`}
                      />
                      {summary.achievedDays !== null ? (
                        <SummaryStat
                          label="목표 달성"
                          value={`${summary.achievedDays} / ${summary.recordedDays}일`}
                        />
                      ) : (
                        <SummaryStat label="목표" value="미설정" />
                      )}
                    </View>
                  </View>
                </>
              )}

              <WeightSection
                logs={periodWeights}
                onPressManage={() => router.push('/me/weights')}
              />

              <Text style={styles.disclaimer}>AI 추정값이며 실제와 다를 수 있습니다.</Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 캘린더에서 고른 날의 끼니 상세. 날짜를 안 고른 상태가 기본이다 (달력만 보여준다).
function DayDetail({
  date,
  meals,
  isLoading,
  onPressManage,
  onPressAdd,
}: {
  date: string | null;
  meals: MealLog[] | null;
  isLoading: boolean;
  onPressManage: () => void;
  onPressAdd: () => void;
}) {
  if (date === null) {
    return (
      <View style={styles.dayHintCard}>
        <MaterialIcons color="#8b95a1" name="touch-app" size={20} />
        <Text style={styles.dayHintText}>날짜를 누르면 그날 먹은 음식을 볼 수 있어요.</Text>
      </View>
    );
  }

  const hasMeals = meals !== null && meals.length > 0;
  const totalKcal = (meals ?? []).reduce((acc, meal) => acc + meal.total_kcal, 0);

  return (
    <View style={styles.dayCard}>
      <View style={styles.dayHeadRow}>
        <Text style={styles.dayTitle}>{formatFullDate(date)}</Text>
        {hasMeals ? <Text style={styles.dayTotal}>{`${totalKcal.toLocaleString()} kcal`}</Text> : null}
      </View>

      {isLoading ? (
        <View style={styles.dayLoadingBox}>
          <ActivityIndicator color="#3182f6" />
        </View>
      ) : !hasMeals ? (
        <Text style={styles.dayEmptyText}>이 날은 기록이 없어요. 아래에서 추가할 수 있어요.</Text>
      ) : (
        (meals ?? []).map((meal) => (
          <View key={meal.id} style={styles.mealRow}>
            <View style={styles.mealTypeChip}>
              <Text style={styles.mealTypeChipText}>{MEAL_TYPE_LABELS[meal.meal_type]}</Text>
            </View>
            <View style={styles.mealBody}>
              <Text style={styles.mealFoods} numberOfLines={2}>
                {meal.items.map((item) => item.food_label).join(', ')}
              </Text>
            </View>
            <Text style={styles.mealKcal}>{`${meal.total_kcal.toLocaleString()} kcal`}</Text>
          </View>
        ))
      )}

      {/* 빈 날짜에도 항상 추가 진입점을 준다 — 막다른 길을 없앤다. 관리는 기록이 있을 때만. */}
      <View style={styles.dayActionRow}>
        <Pressable
          onPress={onPressAdd}
          style={({ pressed }) => [styles.dayAddButton, pressed && styles.pressed]}>
          <MaterialIcons color="#ffffff" name="add" size={18} />
          <Text style={styles.dayAddButtonText}>이 날짜에 기록 추가</Text>
        </Pressable>
        {hasMeals ? (
          <Pressable
            onPress={onPressManage}
            style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}>
            <Text style={styles.manageButtonText}>기록 관리</Text>
            <MaterialIcons color="#3182f6" name="chevron-right" size={18} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// 'YYYY-MM-DD' → '7월 13일 (월)'
function formatFullDate(date: string): string {
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][
    new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))).getDay()
  ];

  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 (${weekday})`;
}

function KcalBarChart({
  days,
  targetKcal,
  period,
  onChangePeriod,
}: {
  days: TrendDay[];
  targetKcal: number | null;
  period: TrendPeriod;
  onChangePeriod: (value: TrendPeriod) => void;
}) {
  // 목표선까지 축에 포함해 "목표 대비 어디쯤인지"가 바로 보이게 한다. 목표 null이면 섭취 최대값 기준.
  const maxValue = Math.max(...days.map((day) => day.consumed_kcal), targetKcal ?? 0, 1);
  const showDayLabels = days.length <= 7;

  return (
    <View style={styles.chartCard}>
      {/* 기간 토글을 카드 헤더 우측에 둔다 — 화면 상단의 칩 한 줄을 통째로 없앤다. */}
      <View style={styles.chartHeadRow}>
        <View style={styles.chartHeadTitles}>
          <Text style={styles.chartTitle}>일별 섭취 kcal</Text>
          {targetKcal !== null ? (
            <Text style={styles.chartTarget}>{`목표 ${targetKcal.toLocaleString()} kcal`}</Text>
          ) : null}
        </View>
        <Segmented compact onChange={onChangePeriod} options={PERIOD_OPTIONS} value={period} />
      </View>

      <View style={styles.chartArea}>
        {targetKcal !== null ? (
          <View
            style={[
              styles.targetLine,
              { bottom: Math.round((targetKcal / maxValue) * CHART_HEIGHT) },
            ]}
          />
        ) : null}
        <View style={styles.barRow}>
          {days.map((day) => {
            const isOver = targetKcal !== null && day.consumed_kcal > targetKcal;
            const heightPx =
              day.consumed_kcal > 0
                ? Math.max(Math.round((day.consumed_kcal / maxValue) * CHART_HEIGHT), 3)
                : 2;

            return (
              <View key={day.date} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    isOver && styles.barOver,
                    day.consumed_kcal === 0 && styles.barEmpty,
                    { height: heightPx },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>

      {showDayLabels ? (
        <View style={styles.barLabelRow}>
          {days.map((day) => (
            <Text key={day.date} style={styles.barLabel}>
              {formatShortDate(day.date)}
            </Text>
          ))}
        </View>
      ) : (
        <View style={styles.rangeLabelRow}>
          <Text style={styles.barLabel}>{formatShortDate(days[0].date)}</Text>
          <Text style={styles.barLabel}>{formatShortDate(days[days.length - 1].date)}</Text>
        </View>
      )}

      {targetKcal !== null ? (
        <View style={styles.legendRow}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>목표 이내</Text>
          <View style={styles.legendDotOver} />
          <Text style={styles.legendText}>목표 초과</Text>
        </View>
      ) : null}
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryStatLabel}>{label}</Text>
      <Text style={styles.summaryStatValue}>{value}</Text>
    </View>
  );
}

function WeightSection({ logs, onPressManage }: { logs: WeightLog[]; onPressManage: () => void }) {
  // logs는 measured_at 오름차순. 변화량은 기간 첫 기록 → 마지막 기록.
  const delta =
    logs.length >= 2 ? logs[logs.length - 1].weight_kg - logs[0].weight_kg : null;
  const recentLogs = logs.slice(-5).reverse();

  return (
    <View style={styles.weightCard}>
      <View style={styles.weightHeadRow}>
        <Text style={styles.chartTitle}>체중</Text>
        <Pressable
          onPress={onPressManage}
          style={({ pressed }) => [styles.weightManageButton, pressed && styles.pressed]}>
          <Text style={styles.weightManageText}>관리</Text>
          <MaterialIcons color="#3182f6" name="chevron-right" size={16} />
        </Pressable>
      </View>

      {logs.length === 0 ? (
        <View style={styles.weightEmptyBody}>
          <Text style={styles.emptyText}>이 기간에 체중 기록이 없습니다.</Text>
          <Pressable
            onPress={onPressManage}
            style={({ pressed }) => [styles.weightRecordButton, pressed && styles.pressed]}>
            <Text style={styles.weightRecordButtonText}>체중 기록하기</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {delta !== null ? (
            <Text style={styles.weightDelta}>
              {`기간 변화 ${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`}
            </Text>
          ) : null}
          <View style={styles.weightList}>
            {recentLogs.map((log) => (
              <View key={log.id} style={styles.weightRow}>
                <Text style={styles.weightRowDate}>
                  {formatShortDate(formatDateParam(new Date(log.measured_at)))}
                </Text>
                <Text style={styles.weightRowValue}>{`${log.weight_kg.toFixed(1)} kg`}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#3182f6',
    borderRadius: 3,
    width: '100%',
  },
  barEmpty: {
    backgroundColor: '#e5e8eb',
  },
  barLabel: {
    color: '#8b95a1',
    flex: 1,
    fontSize: 11,
    textAlign: 'center',
  },
  barLabelRow: {
    flexDirection: 'row',
    gap: 4,
  },
  barOver: {
    backgroundColor: '#e5484d',
  },
  barRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    height: CHART_HEIGHT,
  },
  barSlot: {
    flex: 1,
  },
  chartArea: {
    position: 'relative',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 16,
  },
  chartHeadRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartHeadTitles: {
    gap: 2,
  },
  chartTarget: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  chartTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '800',
  },
  container: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 720,
    width: '100%',
  },
  disclaimer: {
    color: '#8b95a1',
    fontSize: 13,
    textAlign: 'center',
  },
  // 캘린더 모드 — 날짜 선택 안내 / 선택한 날의 끼니 상세
  dayHintCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 16,
  },
  dayHintText: {
    color: '#8b95a1',
    fontSize: 13,
    fontWeight: '700',
  },
  dayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 16,
  },
  dayHeadRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  dayTotal: {
    color: '#3182f6',
    fontSize: 15,
    fontWeight: '900',
  },
  dayLoadingBox: {
    paddingVertical: 12,
  },
  dayEmptyText: {
    color: '#8b95a1',
    fontSize: 13,
    paddingVertical: 4,
  },
  mealRow: {
    alignItems: 'center',
    borderTopColor: '#f2f4f6',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  mealTypeChip: {
    backgroundColor: '#f2f4f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mealTypeChipText: {
    color: '#4e5968',
    fontSize: 12,
    fontWeight: '800',
  },
  mealBody: {
    flex: 1,
  },
  mealFoods: {
    color: '#333d4b',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  mealKcal: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
  },
  dayActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  dayAddButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dayAddButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  manageButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
  },
  manageButtonText: {
    color: '#3182f6',
    fontSize: 13,
    fontWeight: '800',
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendDot: {
    backgroundColor: '#3182f6',
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  legendDotOver: {
    backgroundColor: '#e5484d',
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  legendText: {
    color: '#6b7684',
    fontSize: 12,
    marginRight: 8,
  },
  pressed: {
    opacity: 0.74,
  },
  rangeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    padding: 16,
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
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    padding: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryStat: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  summaryStatLabel: {
    color: '#6b7684',
    fontSize: 13,
  },
  summaryStatValue: {
    color: '#191f28',
    fontSize: 17,
    fontWeight: '800',
  },
  targetLine: {
    backgroundColor: '#8b95a1',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  title: {
    color: '#191f28',
    fontSize: 24,
    fontWeight: '900',
  },
  weightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 16,
  },
  weightDelta: {
    color: '#4e5968',
    fontSize: 14,
    fontWeight: '700',
  },
  weightEmptyBody: {
    alignItems: 'center',
    gap: 12,
  },
  weightHeadRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weightList: {
    gap: 8,
  },
  weightManageButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  weightManageText: {
    color: '#3182f6',
    fontSize: 14,
    fontWeight: '700',
  },
  weightRecordButton: {
    alignItems: 'center',
    backgroundColor: '#edf6ff',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  weightRecordButtonText: {
    color: '#3182f6',
    fontSize: 14,
    fontWeight: '800',
  },
  weightRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weightRowDate: {
    color: '#6b7684',
    fontSize: 14,
  },
  weightRowValue: {
    color: '#333d4b',
    fontSize: 15,
    fontWeight: '700',
  },
});
