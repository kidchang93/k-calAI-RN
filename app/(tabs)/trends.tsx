import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { KcalCalendar } from '@/components/kcal-calendar';
import { LoadingState } from '@/components/loading-state';
import { NutrientTrends } from '@/components/nutrient-trends';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { INTAKE_ESTIMATE_NOTICE } from '@/constants/ai-notice';
import { MEAL_TYPE_LABELS } from '@/constants/meal';
import { confirmDialog } from '@/services/dialog';
import { formatFoodLabel } from '@/services/food-label';
import { formatFullDate, formatShortDate } from '@/services/format';
import { clearNextVisit, daysUntil, getNextVisit, setNextVisit } from '@/services/visit-api';
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

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'chart', label: '그래프' },
  { value: 'calendar', label: '캘린더' },
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

export default function TrendsScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [period, setPeriod] = useState<TrendPeriod>('month');
  // 캘린더가 보고 있는 달 (해당 달 1일). 그래프 모드에서는 쓰지 않는다.
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMeals, setSelectedMeals] = useState<MealLog[] | null>(null);
  const [isLoadingMeals, setIsLoadingMeals] = useState(false);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [weights, setWeights] = useState<WeightLog[] | null>(null);
  // 다음 진료일. 2026-09-16(KCAL-34)부터 **맨 아래** '진료 갈 때 가져가기'에 있다 —
  // 지난 4주를 먼저 보고, 그 끝에서 진료에 무엇을 가져갈지 정하는 순서다.
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [visitOutcome, setVisitOutcome] = useState<string | null>(null);
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

  const loadVisit = useCallback(async () => {
    try {
      const { scheduled_on, outcome } = await getNextVisit();

      setVisitDate(scheduled_on);
      setVisitOutcome(outcome);
    } catch {
      // 진료일 조회 실패로 추이 화면을 막지 않는다 — 없는 것과 같이 취급한다.
      setVisitDate(null);
      setVisitOutcome(null);
    }
  }, []);

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

  // 마운트 시 1회가 아니라 탭이 포커스될 때마다 다시 읽는다 (홈 화면 패턴).
  // 기록 탭에서 끼니를 저장하고 돌아왔을 때 그래프를 갱신하기 위함이다.
  //
  // **선택한 날짜의 끼니 목록도 함께 다시 읽는다.** 예전에는 `loadData()`(격자·요약)만 갱신해서,
  // 캘린더에서 날짜를 고르고 → 기록관리에서 항목을 추가하고 → 돌아오면 아래 끼니 목록만 옛
  // 데이터로 남아 "추가한 항목이 반영되지 않은" 것처럼 보였다. `selectedMeals` 는 날짜를 탭할
  // 때만 채워지기 때문이다.
  useFocusEffect(
    useCallback(() => {
      void loadData();
      void loadVisit();

      if (selectedDate !== null) {
        void loadMealsFor(selectedDate);
      }
    }, [loadData, loadMealsFor, loadVisit, selectedDate])
  );

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

  return (
    <Screen gap={14} contentStyle={styles.content}>
      <Text style={styles.title}>돌아보기</Text>

      {isLoading ? (
        <LoadingState label="기록을 불러오는 중입니다." />
      ) : errorMessage ? (
        <ErrorBanner message={errorMessage} onRetry={() => void loadData()} />
      ) : (
        <>
          {/* **4주 식탁**(2026-09-16, KCAL-35). 예전 이름은 '식단과 검사 수치'였는데
              검사 수치 카드를 이 탭에서 뺐다(KCAL-36 — 라우트 `/labs`·서버 API 는 그대로다). */}
          <SectionLabel
            first
            title="4주 식탁"
            right={<Segmented onChange={setViewMode} options={VIEW_OPTIONS} value={viewMode} />}
          />

          {trends === null || summary === null ? null : viewMode === 'calendar' ? (
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
            </>
          ) : (
            <>
              {summary.recordedDays === 0 ? (
                <View style={styles.emptyCard}>
                  {/* 기간 토글은 평소 그래프 카드 안에 있다. 빈 기간에도 주↔월 전환은
                      할 수 있어야 하므로 여기서도 노출한다. */}
                  <Segmented compact onChange={setPeriod} options={PERIOD_OPTIONS} value={period} />
                  <MaterialIcons color="#a9a6a1" name="show-chart" size={32} />
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

              {/* 질환 축 추이. kcal 그래프 바로 아래에 둔다 — 이 앱의 대상 사용자에게는
                  칼로리보다 이쪽이 중요하고, 만성질환 관리는 하루가 아니라 추세로 본다.
                  해당 질환이 없으면 서버가 null 을 주고 컴포넌트가 스스로 사라진다. */}
              <NutrientTrends trends={trends.nutrients} />
            </>
          )}

          {/* 체중은 그래프·캘린더 두 모드 모두에 보인다 — 한쪽에만 있으면 "있는지 없는지"
              모르게 된다(캘린더 모드에서는 보고 있는 달의 기록).
              **기록만 둔다**(2026-09-16, KCAL-36·37): BMI 카드·주당 권장 운동량·이번 주 조언을
              화면에서 뺐다. 셋 다 우리가 대신 내리는 판정이라 이 탭의 성격과 어긋난다
              (서버 `docs/PRODUCT_STRATEGY.md` §0-1 — 판단 대행을 하지 않는다).
              컴포넌트(`components/body-metrics`·`weekly-coaching`)와 서버 API 는 그대로 둔다. */}
          <SectionLabel title="몸과 활동" />

          <WeightSection logs={periodWeights} onPressManage={() => router.push('/me/weights')} />

          {/* 이 탭의 결론. **맨 아래**다(2026-09-16, KCAL-34·38) — 4주 식탁과 몸·활동을
              본 다음에야 "그래서 무엇을 가져갈까"가 온다. 2026-08-19~09-15 에는 맨 위였다. */}
          <SectionLabel title="진료 갈 때 가져가기" />

          <VisitCard
            scheduledOn={visitDate}
            outcome={visitOutcome}
            onChange={(date, note) => {
              setVisitDate(date);
              setVisitOutcome(note);
            }}
          />

          {/* **검사 수치 진입점**(2026-09-16, KCAL-36). 값이 보이던 카드는 뺐지만 길까지 막으면
              케어 루프의 결과 축이 화면에서 사라진다(서버 `docs/CARE_LOOP.md` §4) — 여기 한 줄로
              남긴다. 진료에서 받아 오는 값이고 리포트에 실리므로 이 묶음이 제자리다.
              수치도 판정도 이 줄에는 없다: 들어가서 보는 것이라 '진료 준비'의 할 일로만 읽힌다. */}
          <Pressable
            onPress={() => router.push('/labs')}
            style={({ pressed }) => [styles.labLinkRow, pressed && styles.pressed]}>
            <MaterialIcons color="#2a7d76" name="science" size={20} />
            <View style={styles.labLinkBody}>
              <Text style={styles.labLinkTitle}>검사 수치</Text>
              <Text style={styles.labLinkHint}>병원에서 받은 결과를 적어 두면 리포트에 함께 실려요.</Text>
            </View>
            <MaterialIcons color="#a9a6a1" name="chevron-right" size={20} />
          </Pressable>

          <ReportCard
            startDate={trends?.start_date ?? null}
            endDate={trends?.end_date ?? null}
            recordedDays={summary?.recordedDays ?? 0}
            totalDays={summary?.totalDays ?? 0}
            onPress={() => {
              // **보고 있는 기간을 그대로 리포트에 넘긴다.** 리포트 화면은 파라미터가 없으면
              // 자체 기본 기간을 쓰는데, 그러면 카드에 적힌 '14/30일'과 리포트 안의 기록
              // 일수가 서로 달라진다. 화면·서버 변경 없이 기존 파라미터를 쓰기만 하면 된다.
              // 이 카드는 로딩 성공 뒤에만 보이므로(위 게이트) trends 는 항상 값이 있다.
              router.push({
                pathname: '/report',
                params: { start_date: trends?.start_date, end_date: trends?.end_date },
              });
            }}
          />

          {/* 이 탭의 수치는 AI 가 만든 것이 아니다 — 섭취량은 식약처 DB, 체성분·조언은 입력값으로
              계산한다. 예전 "AI 추정값" 문구는 사실과 달랐다(KCAL-17). */}
          <Text style={styles.disclaimer}>{INTAKE_ESTIMATE_NOTICE}</Text>
        </>
      )}
    </Screen>
  );
}

// 진료 탭의 묶음 제목. 안쪽 소제목("질환 영양 추이" 등, 잉크 17pt)보다 한 단계 위라 더 크고,
// 강조색과 위쪽 구분선으로 가른다. 첫 묶음은 페이지 제목 바로 아래라 구분선을 긋지 않는다.
function SectionLabel({
  title,
  right,
  first = false,
}: {
  title: string;
  right?: ReactNode;
  first?: boolean;
}) {
  return (
    <View style={[styles.sectionLabelRow, first ? null : styles.sectionLabelDivider]}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {right}
    </View>
  );
}

// 다음 진료일 — **케어 루프의 시작과 끝**(서버 `docs/CARE_LOOP.md` §1·§9의 열린 결정 4번).
// 진료일을 모르면 리포트를 언제 뽑아야 하는지도, 오늘 기록해야 할 이유도 말할 수 없다.
//
// ⚠️ **예약이 아니다.** 사용자가 적어 두는 메모이고 병원과 아무것도 주고받지 않는다 — 문구가
// '예약'으로 읽히면 의료법 제27조 제3항(소개·알선)의 경계에 닿는다(§3). 그래서 버튼도
// '등록'이지 '예약'이 아니다.
//
// 날짜 입력은 검사 수치 화면과 같은 방식(YYYY-MM-DD 직접 입력)이다. 날짜 선택 패키지를
// 새로 들이지 않는 이유는 웹·네이티브 양쪽을 같은 코드로 유지하기 위해서다.
function VisitCard({
  scheduledOn,
  outcome,
  onChange,
}: {
  scheduledOn: string | null;
  outcome: string | null;
  onChange: (date: string | null, note: string | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = scheduledOn !== null ? daysUntil(scheduledOn) : null;

  const startEdit = () => {
    setDraft(scheduledOn ?? formatDateParam(new Date()));
    setNoteDraft(outcome ?? '');
    setError(null);
    setIsEditing(true);
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const saved = await setNextVisit(draft.trim(), noteDraft);

      onChange(saved.scheduled_on, saved.outcome);
      setIsEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    const confirmed = await confirmDialog({
      title: '진료 일정 삭제',
      message: '등록한 다음 진료일을 지울까요?',
      confirmLabel: '삭제',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      await clearNextVisit();
      onChange(null, null);
      setIsEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '삭제하지 못했습니다.');
    }
  };

  if (isEditing) {
    return (
      <View style={styles.visitCard}>
        <Text style={styles.visitTitle}>다음 진료일</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          onChangeText={setDraft}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#a9a6a1"
          style={styles.visitInput}
          value={draft}
        />
        {/* 진료에서 들은 것. **처방을 대신 적는 곳이 아니라 옮겨 적는 곳**이라 서식을 주지
            않는다 — 사용자가 들은 말 그대로가 가장 정확하다. 미동의(403)면 서버가 막고
            그 문장을 그대로 보여 준다. */}
        <TextInput
          multiline
          onChangeText={setNoteDraft}
          placeholder="진료에서 들은 것 (예: 짜게 먹지 말 것, 칼륨 주의)"
          placeholderTextColor="#a9a6a1"
          style={[styles.visitInput, styles.visitNoteInput]}
          value={noteDraft}
        />
        {error !== null ? <Text style={styles.visitError}>{error}</Text> : null}
        <View style={styles.visitActions}>
          <Pressable
            disabled={isSaving}
            onPress={() => void save()}
            style={({ pressed }) => [styles.visitPrimary, pressed && styles.pressed]}>
            <Text style={styles.visitPrimaryText}>{isSaving ? '저장 중…' : '저장'}</Text>
          </Pressable>
          <Pressable
            onPress={() => setIsEditing(false)}
            style={({ pressed }) => [styles.visitGhost, pressed && styles.pressed]}>
            <Text style={styles.visitGhostText}>취소</Text>
          </Pressable>
          {scheduledOn !== null ? (
            <Pressable
              onPress={() => void remove()}
              style={({ pressed }) => [styles.visitGhost, pressed && styles.pressed]}>
              <Text style={styles.visitDangerText}>삭제</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={startEdit}
      style={({ pressed }) => [styles.visitCard, pressed && styles.pressed]}>
      <View style={styles.visitRow}>
        <MaterialIcons color="#2a7d76" name="event" size={20} />
        <View style={styles.visitBody}>
          <Text style={styles.visitTitle}>다음 진료일</Text>
          <Text style={styles.visitText}>
            {scheduledOn === null
              ? '등록해 두면 남은 날짜를 홈에서도 알려드려요.'
              : scheduledOn}
          </Text>
        </View>
        {scheduledOn !== null && remaining !== null ? (
          <Text style={styles.visitDday}>
            {remaining > 0 ? `D-${remaining}` : remaining === 0 ? '오늘' : '지남'}
          </Text>
        ) : (
          <Text style={styles.visitAdd}>등록</Text>
        )}
      </View>

      {outcome !== null && outcome !== '' ? (
        <View style={styles.visitNote}>
          <Text style={styles.visitNoteLabel}>진료에서 들은 것</Text>
          <Text style={styles.visitNoteText}>{outcome}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// 이 탭이 무엇을 위한 곳인지 맨 위에서 말한다 — 기록을 쌓는 목적은 진료에서 꺼내 보이는
// 것이다(서버 `PRODUCT_STRATEGY.md` §0-2의 첫 번째 목표 지표). 숫자 두 개를 함께 보여주는
// 이유는 **리포트의 무게를 미리 알리기 위해서**다: 3일 기록으로 만든 리포트와 30일로 만든
// 리포트는 같은 문서가 아니다.
function ReportCard({
  startDate,
  endDate,
  recordedDays,
  totalDays,
  onPress,
}: {
  startDate: string | null;
  endDate: string | null;
  recordedDays: number;
  totalDays: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.reportCard, pressed && styles.pressed]}>
      <View style={styles.reportCardHead}>
        <MaterialIcons color="#2a7d76" name="description" size={20} />
        <View style={styles.reportCardHeadText}>
          <Text style={styles.reportCardTitle}>진료에 가져갈 기록</Text>
          {startDate !== null && endDate !== null ? (
            <Text style={styles.reportCardPeriod}>
              {`${formatShortDate(startDate)} ~ ${formatShortDate(endDate)}`}
            </Text>
          ) : null}
        </View>
        <MaterialIcons color="#2a7d76" name="chevron-right" size={20} />
      </View>

      <View style={styles.reportCardStats}>
        <View style={styles.reportCardStat}>
          <Text style={styles.reportCardStatValue}>
            {recordedDays}
            <Text style={styles.reportCardStatUnit}>{` / ${totalDays}일`}</Text>
          </Text>
          <Text style={styles.reportCardStatLabel}>식단 기록</Text>
        </View>
      </View>

      <Text style={styles.reportCardHint}>
        {recordedDays === 0
          ? '기록이 쌓이면 진료에 가져갈 수 있게 정리해 드려요.'
          : '식단 기록을 한 장으로 정리해 인쇄하거나 저장할 수 있어요.'}
      </Text>
    </Pressable>
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
        <MaterialIcons color="#a9a6a1" name="touch-app" size={20} />
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
          <MaterialIcons color="#22211f" name="add" size={18} />
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
    color: '#5c5b57',
    fontSize: 13,
    fontWeight: '700',
  },
  chartTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  content: {
    padding: 16,
  },
  disclaimer: {
    color: '#a9a6a1',
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
    color: '#a9a6a1',
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
    color: '#a9a6a1',
    fontSize: 13,
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
    backgroundColor: '#60beb8',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dayAddButtonText: {
    color: '#22211f',
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
    color: '#2a7d76',
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
  visitCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    gap: 10,
    padding: 18,
  },
  visitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  visitBody: {
    flex: 1,
    gap: 1,
  },
  visitTitle: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '800',
  },
  visitText: {
    color: '#5c5b57',
    fontSize: 13,
  },
  visitDday: {
    color: '#2a7d76',
    fontSize: 18,
    fontWeight: '900',
  },
  visitAdd: {
    color: '#2a7d76',
    fontSize: 14,
    fontWeight: '800',
  },
  visitInput: {
    backgroundColor: '#f7f6f4',
    borderRadius: 8,
    color: '#22211f',
    fontSize: 15,
    padding: 12,
  },
  visitNoteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  visitNote: {
    backgroundColor: '#f7f6f4',
    borderRadius: 8,
    gap: 3,
    padding: 12,
  },
  visitNoteLabel: {
    color: '#8b857c',
    fontSize: 11,
    fontWeight: '700',
  },
  visitNoteText: {
    color: '#22211f',
    fontSize: 14,
    lineHeight: 20,
  },
  visitError: {
    color: '#b8524e',
    fontSize: 12.5,
  },
  visitActions: {
    flexDirection: 'row',
    gap: 8,
  },
  visitPrimary: {
    backgroundColor: '#60beb8',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  visitPrimaryText: {
    color: '#22211f',
    fontSize: 14,
    fontWeight: '800',
  },
  visitGhost: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  visitGhostText: {
    color: '#5c5b57',
    fontSize: 14,
    fontWeight: '700',
  },
  visitDangerText: {
    color: '#b8524e',
    fontSize: 14,
    fontWeight: '700',
  },
  reportCard: {
    backgroundColor: '#ffffff',
    borderColor: '#60beb8',
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  reportCardHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  reportCardHeadText: {
    flex: 1,
  },
  reportCardTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  reportCardPeriod: {
    color: '#a9a6a1',
    fontSize: 12,
  },
  reportCardStats: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  reportCardStat: {
    flex: 1,
    gap: 2,
  },
  reportCardStatValue: {
    color: '#2a7d76',
    fontSize: 22,
    fontWeight: '900',
  },
  reportCardStatUnit: {
    color: '#5c5b57',
    fontSize: 13,
    fontWeight: '700',
  },
  reportCardStatLabel: {
    color: '#5c5b57',
    fontSize: 12,
  },
  reportCardHint: {
    color: '#5c5b57',
    fontSize: 12.5,
    lineHeight: 18,
  },
  labLinkBody: {
    flex: 1,
    gap: 2,
  },
  labLinkHint: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 18,
  },
  labLinkRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  labLinkTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.74,
  },
  rangeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: '#2a7d76',
    fontSize: 19,
    fontWeight: '900',
  },
  sectionLabelDivider: {
    borderTopColor: '#e4e2de',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 18,
  },
  sectionLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 32,
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
  title: {
    color: '#22211f',
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
