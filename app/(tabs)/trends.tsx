import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ConditionGuideCard } from '@/components/condition-guide-card';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { NutrientTrends } from '@/components/nutrient-trends';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { StampCalendar } from '@/components/stamp-calendar';
import { TabHeader } from '@/components/tab-header';
import { INTAKE_ESTIMATE_NOTICE } from '@/constants/ai-notice';
import { MEAL_TYPE_LABELS } from '@/constants/meal';
import { DISPLAY_FONT } from '@/constants/typography';
import { formatFoodLabel } from '@/services/food-label';
import { formatFullDate, formatShortDate } from '@/services/format';
import { GuideSummary, listGuides } from '@/services/guide-api';
import {
  formatDateParam,
  getMeals,
  getTrends,
  getWeights,
  MealLog,
  recentDateRange,
  TrendDay,
  TrendsResponse,
  WeightLog,
} from '@/services/health-api';

type TrendPeriod = 'week' | 'month';
type ViewMode = 'chart' | 'calendar';

// 도장판이 먼저다(2026-10-05). 그래프는 kcal 막대라 숫자 잔액처럼 읽혀서 두 번째로 내렸다 —
// 지우지 않는 이유는 '목표 대비 어디쯤'을 보고 싶은 사람도 있어서다.
const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'calendar', label: '도장판' },
  { value: 'chart', label: '그래프' },
];

// 기본은 **4주**다(2026-09-16, KCAL-35). 만성질환의 단위는 하루가 아니라 진료와 진료 사이라
// (서버 `docs/CARE_LOOP.md`) 7일은 너무 짧다. 28일로 세는 이유는 '4주'라는 이름과 숫자가
// 어긋나지 않게 하기 위함이다(예전 'month'는 30일이었다). 키(`month`)는 그대로 둔다.
const PERIOD_OPTIONS: { value: TrendPeriod; label: string }[] = [
  { value: 'month', label: '4주' },
  { value: 'week', label: '7일' },
];

const PERIOD_DAYS: Record<TrendPeriod, number> = {
  week: 7,
  month: 28,
};

const CHART_HEIGHT = 160;

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

// 케어 탭 (2026-10-05 화면 재구성 — 옛 '돌아보기'). 라우트 이름 `trends`는 그대로다: URL 이 바뀌면
// 저장해 둔 링크가 깨진다.
//
// 담는 것: 도장판(남긴 날) → 질환 영양 추이(근거) → 내 질환 도감(가이드) → 몸 기록.
// '진료 갈 때 가져가기' 묶음은 **진료 탭**으로 독립했다(app/(tabs)/visit.tsx).
// ⚠️ 이번 주 조언·BMI·주당 권장 운동량은 **여전히 넣지 않는다**(2026-09-16, KCAL-36·37) — 우리가
// 대신 내리는 판정이라서다(서버 `docs/PRODUCT_STRATEGY.md` §0-1). 컴포넌트·API 는 그대로 있다.
export default function TrendsScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [period, setPeriod] = useState<TrendPeriod>('month');
  // 캘린더가 보고 있는 달 (해당 달 1일). 그래프 모드에서는 쓰지 않는다.
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMeals, setSelectedMeals] = useState<MealLog[] | null>(null);
  const [isLoadingMeals, setIsLoadingMeals] = useState(false);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [weights, setWeights] = useState<WeightLog[] | null>(null);
  // 질환 가이드(도감). 콘텐츠는 지침이 바뀔 때만 바뀌므로 마운트 1회만 읽는다.
  const [guides, setGuides] = useState<GuideSummary[]>([]);
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

  // 마운트 시 1회가 아니라 탭이 포커스될 때마다 다시 읽는다.
  // 식단 탭에서 끼니를 저장하고 돌아왔을 때 도장판을 갱신하기 위함이다.
  //
  // **선택한 날짜의 끼니 목록도 함께 다시 읽는다.** 예전에는 `loadData()`(격자·요약)만 갱신해서,
  // 캘린더에서 날짜를 고르고 → 기록관리에서 항목을 추가하고 → 돌아오면 아래 끼니 목록만 옛
  // 데이터로 남아 "추가한 항목이 반영되지 않은" 것처럼 보였다. `selectedMeals` 는 날짜를 탭할
  // 때만 채워지기 때문이다.
  useFocusEffect(
    useCallback(() => {
      void loadData();

      if (selectedDate !== null) {
        void loadMealsFor(selectedDate);
      }
    }, [loadData, loadMealsFor, selectedDate])
  );

  // 가이드 목록은 있으면 좋은 것이다 — 실패해도 조용히 넘어간다(도감이 안 그려질 뿐).
  useEffect(() => {
    let isCancelled = false;

    listGuides()
      .then((result) => {
        if (!isCancelled) {
          setGuides(result);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
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
      // 목표 미설정(null)이면 세지 않는다. 0으로 취급하면 전 일수가 목표 이내로 잡힌다.
      withinTargetDays:
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

  // 머리 아래 한 줄은 내 질환이다 — 이 탭의 모든 숫자가 그 질환의 눈으로 보는 것이라서다.
  const myConditions = guides
    .filter((guide) => guide.is_mine)
    .map((guide) => guide.label)
    .join(' · ');

  return (
    <Screen gap={16}>
      <TabHeader caption={myConditions} title="내 몸 케어" />

      <SectionLabel
        title="돌아보기"
        right={<Segmented onChange={setViewMode} options={VIEW_OPTIONS} value={viewMode} />}
      />

      {isLoading ? (
        <LoadingState label="기록을 불러오는 중입니다." />
      ) : errorMessage ? (
        <ErrorBanner message={errorMessage} onRetry={() => void loadData()} />
      ) : trends === null || summary === null ? null : (
        <>
          {viewMode === 'calendar' ? (
            <>
              <StampCalendar
                canGoNext={canGoNextMonth}
                days={trends.days}
                month={month}
                onChangeMonth={changeMonth}
                onSelectDate={selectDate}
                selectedDate={selectedDate}
                todayDate={todayDate}
              />

              <DayDetail
                date={selectedDate}
                isLoading={isLoadingMeals}
                meals={selectedMeals}
                onPressAdd={() => {
                  if (selectedDate) {
                    router.push({
                      pathname: '/meals/compose',
                      params: { date: selectedDate, from: 'care' },
                    });
                  }
                }}
                onPressManage={() => {
                  if (selectedDate) {
                    // 그날의 식탁은 식단 탭과 같이 쓰는 화면이다 — 여기서 열면 뒤로가기가 '← 케어'다.
                    router.push({ pathname: '/meals', params: { date: selectedDate, from: 'care' } });
                  }
                }}
              />
            </>
          ) : summary.recordedDays === 0 ? (
            <View style={styles.emptyCard}>
              {/* 기간 토글은 평소 그래프 카드 안에 있다. 빈 기간에도 주↔월 전환은
                  할 수 있어야 하므로 여기서도 노출한다. */}
              <Segmented compact onChange={setPeriod} options={PERIOD_OPTIONS} value={period} />
              <MaterialIcons color="#5c5b57" name="show-chart" size={32} />
              <Text style={styles.emptyTitle}>이 기간에 식단 기록이 없어요</Text>
              <Text style={styles.emptyText}>
                식단 탭에서 끼니 칸에 사진을 남기면 여기에서 확인할 수 있어요.
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
                  {summary.withinTargetDays !== null ? (
                    <SummaryStat
                      label="목표 이내"
                      value={`${summary.withinTargetDays} / ${summary.recordedDays}일`}
                    />
                  ) : (
                    <SummaryStat label="목표" value="미설정" />
                  )}
                </View>
              </View>
            </>
          )}

          {/* 질환 축 추이. 도장판·그래프 두 모드 모두에 둔다 — 이 앱의 대상 사용자에게는
              칼로리보다 이쪽이 중요하고, 만성질환 관리는 하루가 아니라 추세로 본다.
              범위는 지금 보고 있는 기간(도장판이면 그 달)이다. 해당 질환이 없으면 서버가 null 을
              주고 컴포넌트가 스스로 사라진다. */}
          <NutrientTrends trends={trends.nutrients} />
        </>
      )}

      {/* 수치 **바로 다음**이 "이게 무슨 뜻이지"가 이어지는 자리다 (서버 `docs/CARE_LOOP.md` §5-2). */}
      <ConditionGuideCard guides={guides} />

      {/* **기록만 둔다**(2026-09-16, KCAL-36·37): BMI 카드·주당 권장 운동량을 빼고 체중 기록만.
          보고 있는 기간(도장판이면 그 달)의 기록이다. */}
      {isLoading || errorMessage ? null : (
        <>
          <SectionLabel title="몸 기록" />
          <WeightSection logs={periodWeights} onPressManage={() => router.push('/me/weights')} />
        </>
      )}

      {/* 이 탭의 수치는 AI 가 만든 것이 아니다 — 섭취량은 식약처 DB 로 계산한다(KCAL-17). */}
      <Text style={styles.disclaimer}>{INTAKE_ESTIMATE_NOTICE}</Text>
    </Screen>
  );
}

// 케어 탭의 묶음 제목. 탭 제목(32) 아래 단계라 같은 둥근 글꼴로 한 단계 작게 쓴다.
function SectionLabel({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text accessibilityRole="header" style={styles.sectionLabel}>
        {title}
      </Text>
      {right}
    </View>
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
        <MaterialIcons color="#1c5a55" name="touch-app" size={20} />
        <Text style={styles.dayHintText}>도장판의 날짜를 누르면 그날 먹은 것을 볼 수 있어요.</Text>
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
          <ActivityIndicator color="#2a7d76" />
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
                {meal.items.map((item) => formatFoodLabel(item.food_label)).join(', ')}
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
          <MaterialIcons color="#ffffff" name="add" size={20} />
          <Text style={styles.dayAddButtonText}>이 날짜에 기록 추가</Text>
        </Pressable>
        {hasMeals ? (
          <Pressable
            onPress={onPressManage}
            style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}>
            <Text style={styles.manageButtonText}>기록 관리</Text>
            <MaterialIcons color="#2a7d76" name="chevron-right" size={18} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
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
          <Text style={styles.legendText}>목표 위</Text>
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
          <MaterialIcons color="#2a7d76" name="chevron-right" size={16} />
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
    backgroundColor: '#60beb8',
    borderRadius: 3,
    width: '100%',
  },
  barEmpty: {
    backgroundColor: '#e4e2de',
  },
  barLabel: {
    color: '#a9a6a1',
    flex: 1,
    fontSize: 11,
    textAlign: 'center',
  },
  barLabelRow: {
    flexDirection: 'row',
    gap: 4,
  },
  barOver: {
    backgroundColor: '#ea8989',
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
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
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
    color: '#5c5b57',
    fontSize: 13,
    fontWeight: '700',
  },
  chartTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  disclaimer: {
    color: '#5c5b57',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  // 캘린더 모드 — 날짜 선택 안내 / 선택한 날의 끼니 상세
  dayHintCard: {
    alignItems: 'center',
    backgroundColor: '#eef7f5',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    padding: 14,
  },
  dayHintText: {
    color: '#1c5a55',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  dayCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 10,
    padding: 16,
  },
  dayHeadRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayTitle: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '900',
  },
  dayTotal: {
    color: '#2a7d76',
    fontSize: 15,
    fontWeight: '900',
  },
  dayLoadingBox: {
    paddingVertical: 12,
  },
  dayEmptyText: {
    color: '#5c5b57',
    fontSize: 14,
    paddingVertical: 4,
  },
  mealRow: {
    alignItems: 'center',
    borderTopColor: '#e4e2de',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  mealTypeChip: {
    backgroundColor: '#e4e2de',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mealTypeChipText: {
    color: '#5c5b57',
    fontSize: 12,
    fontWeight: '800',
  },
  mealBody: {
    flex: 1,
  },
  mealFoods: {
    color: '#22211f',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  mealKcal: {
    color: '#22211f',
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
    backgroundColor: '#2a7d76',
    borderBottomWidth: 4,
    borderColor: '#1c5a55',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  dayAddButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  manageButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
  },
  manageButtonText: {
    color: '#2a7d76',
    fontSize: 13,
    fontWeight: '800',
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
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#22211f',
    fontSize: 18,
    fontWeight: '800',
  },
  legendDot: {
    backgroundColor: '#60beb8',
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  legendDotOver: {
    backgroundColor: '#ea8989',
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
    color: '#5c5b57',
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
  sectionLabel: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
  },
  sectionLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 40,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 8,
    padding: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryStat: {
    backgroundColor: '#e4e2de',
    borderRadius: 8,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  summaryStatLabel: {
    color: '#5c5b57',
    fontSize: 13,
  },
  summaryStatValue: {
    color: '#22211f',
    fontSize: 17,
    fontWeight: '800',
  },
  targetLine: {
    backgroundColor: '#a9a6a1',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  weightCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 12,
    padding: 16,
  },
  weightDelta: {
    color: '#5c5b57',
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
    color: '#2a7d76',
    fontSize: 14,
    fontWeight: '700',
  },
  weightRecordButton: {
    alignItems: 'center',
    backgroundColor: '#bee2dd',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  weightRecordButtonText: {
    color: '#2a7d76',
    fontSize: 14,
    fontWeight: '800',
  },
  weightRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weightRowDate: {
    color: '#5c5b57',
    fontSize: 14,
  },
  weightRowValue: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '700',
  },
});
