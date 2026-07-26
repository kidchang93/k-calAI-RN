import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { MedicalDisclaimer } from '@/components/medical-disclaimer';
import { formatFoodLabel } from '@/services/food-label';
import {
  getMedicalReport,
  MealType,
  MedicalReport,
  recentDateRange,
  ReportMeal,
} from '@/services/health-api';

// 진료·영양상담에 가져가는 기록. 목표 지표의 첫 항목("진료에서 실제로 열어 보였는가",
// 서버 PRODUCT_STRATEGY §0-2)을 가능하게 하는 화면이다.
//
// **웹에서는 인쇄(PDF 저장)가 되고 네이티브에서는 안 된다.** 결제와 같은 이유로 주 무대가
// 웹이라(FastAPI 가 webapp 을 서빙) 우선 웹에 맞춘다. 네이티브에는 버튼 대신 안내를 둔다 —
// 누를 수 없는 버튼을 그려 놓고 눌렀을 때 실패시키지 않는다 (docs/DESIGN.md 의 결제 선례).

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

const PERIOD_DAYS = 30;

function isPrintSupported(): boolean {
  return Platform.OS === 'web';
}

export default function MedicalReportScreen() {
  const params = useLocalSearchParams<{ start_date?: string; end_date?: string }>();
  const [report, setReport] = useState<MedicalReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const range = recentDateRange(PERIOD_DAYS);
  const startDate = params.start_date ?? range.start_date;
  const endDate = params.end_date ?? range.end_date;

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setReport(await getMedicalReport(startDate, endDate));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.topRow}>
            <BackButton />
            {isPrintSupported() ? (
              <Pressable
                onPress={() => window.print()}
                style={({ pressed }) => [styles.printButton, pressed && styles.pressed]}>
                <MaterialIcons color="#ffffff" name="print" size={18} />
                <Text style={styles.printButtonText}>인쇄 · PDF 저장</Text>
              </Pressable>
            ) : null}
          </View>

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
            </View>
          ) : errorMessage !== null ? (
            <ErrorBanner message={errorMessage} onRetry={() => void load()} />
          ) : report === null ? null : (
            <ReportBody report={report} />
          )}

          {!isPrintSupported() ? (
            <Text style={styles.nativeHint}>
              인쇄와 PDF 저장은 웹에서 할 수 있어요. 브라우저로 접속해 이 화면을 열어주세요.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportBody({ report }: { report: MedicalReport }) {
  const byDate = groupByDate(report.meals);

  return (
    <View style={styles.sheet}>
      <Text style={styles.docTitle}>식단 기록 요약</Text>
      <Text style={styles.docPeriod}>
        {`${report.start_date} ~ ${report.end_date} · ${formatGeneratedAt(report.generated_at)} 기준`}
      </Text>

      {/* **질환·병기가 수치보다 먼저다.** 읽는 사람이 어떤 기준으로 볼지를 먼저 알아야 한다. */}
      <View style={styles.metaBox}>
        <MetaRow
          label="등록 질환"
          value={report.conditions.length > 0 ? report.conditions.join(' · ') : '없음'}
        />
        {report.ckd_stage_label !== null ? (
          <MetaRow label="신장질환 병기" value={report.ckd_stage_label} />
        ) : null}
        <MetaRow
          label="기록"
          value={`${report.kcal.recorded_days}일 / ${report.kcal.total_days}일`}
        />
        <MetaRow
          label="일평균 섭취"
          value={
            report.kcal.average !== null
              ? `${report.kcal.average.toLocaleString()} kcal${
                  report.kcal.target !== null ? ` (목표 ${report.kcal.target.toLocaleString()})` : ''
                }`
              : '기록 없음'
          }
        />
      </View>

      {report.nutrients !== null ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>영양소 요약</Text>
          {report.nutrients.axes.map((axis) => (
            <View key={axis.nutrient} style={styles.axisRow}>
              <Text style={styles.axisName}>{axis.label}</Text>
              <Text style={styles.axisValue}>
                {axis.average_mg !== null
                  ? `기록일 평균 ${Math.round(axis.average_mg).toLocaleString()} mg`
                  : '기록 없음'}
              </Text>
              <Text style={styles.axisNote}>
                {axis.limit_mg !== null && axis.days_over_limit !== null
                  ? `기준 ${axis.limit_mg.toLocaleString()} mg · ${axis.days_over_limit}일 초과`
                  : axis.reference_mg !== null
                    ? `참고치 ${axis.reference_mg.toLocaleString()} mg`
                    : '기준 없음'}
              </Text>
            </View>
          ))}
          <Text style={styles.blockNotice}>{report.nutrients.notice}</Text>
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.blockTitle}>식단 기록</Text>
        {byDate.length === 0 ? (
          <Text style={styles.emptyText}>이 기간에 기록이 없습니다.</Text>
        ) : (
          byDate.map(([date, meals]) => (
            <View key={date} style={styles.dayBlock}>
              <Text style={styles.dayTitle}>{date}</Text>
              {meals.map((meal, index) => (
                <View key={`${meal.logged_at}-${index}`} style={styles.mealRow}>
                  <Text style={styles.mealType}>{MEAL_TYPE_LABELS[meal.meal_type]}</Text>
                  <View style={styles.mealItems}>
                    {meal.items.map((item, itemIndex) => (
                      <Text key={itemIndex} style={styles.itemText}>
                        {`${formatFoodLabel(item.food_label)} · ${item.kcal.toLocaleString()} kcal`}
                        {/* 실측이 없던 항목은 비워 둔다 — 0으로 적으면 "안 먹었다"가 된다. */}
                        {item.sodium_mg !== null
                          ? `  (나트륨 ${Math.round(item.sodium_mg).toLocaleString()} mg)`
                          : '  (영양 정보 없음)'}
                      </Text>
                    ))}
                  </View>
                  <Text style={styles.mealKcal}>{`${meal.total_kcal.toLocaleString()} kcal`}</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      <Text style={styles.docNotice}>{report.notice}</Text>

      {/* 이 문서는 **진료실에서 의료진이 보는 종이**가 된다. 인쇄물에 최종 판단자가 누구인지
          적혀 있지 않으면, 우리가 낸 수치가 판단처럼 읽힐 여지가 남는다 (Apple 1.4.1 이
          요구하는 상기도 이것이다 — `kcalAI-model/docs/LEGAL_COMPLIANCE.md` §6-1). */}
      <MedicalDisclaimer tone="strong" />
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function groupByDate(meals: ReportMeal[]): [string, ReportMeal[]][] {
  const map = new Map<string, ReportMeal[]>();

  for (const meal of meals) {
    map.set(meal.date, [...(map.get(meal.date) ?? []), meal]);
  }

  return [...map.entries()];
}

// ISO → '2026-07-25 10:34'
function formatGeneratedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const styles = StyleSheet.create({
  axisName: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '800',
    width: 60,
  },
  axisNote: {
    color: '#6b7684',
    fontSize: 13,
  },
  axisRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  axisValue: {
    color: '#333d4b',
    flex: 1,
    fontSize: 14,
  },
  block: {
    borderTopColor: '#e5e8eb',
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 16,
  },
  blockNotice: {
    color: '#8b95a1',
    fontSize: 11,
    lineHeight: 16,
  },
  blockTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  container: {
    gap: 16,
    padding: 20,
    paddingBottom: 40,
  },
  dayBlock: {
    gap: 4,
  },
  dayTitle: {
    color: '#4e5968',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  docNotice: {
    borderTopColor: '#e5e8eb',
    borderTopWidth: 1,
    color: '#6b7684',
    fontSize: 11,
    lineHeight: 16,
    paddingTop: 12,
  },
  docPeriod: {
    color: '#6b7684',
    fontSize: 13,
  },
  docTitle: {
    color: '#191f28',
    fontSize: 22,
    fontWeight: '900',
  },
  emptyText: {
    color: '#8b95a1',
    fontSize: 14,
  },
  itemText: {
    color: '#4e5968',
    fontSize: 13,
    lineHeight: 19,
  },
  mealItems: {
    flex: 1,
  },
  mealKcal: {
    color: '#333d4b',
    fontSize: 13,
    fontWeight: '800',
  },
  mealRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  mealType: {
    color: '#6b7684',
    fontSize: 13,
    width: 34,
  },
  metaBox: {
    backgroundColor: '#f7f8fa',
    borderRadius: 8,
    gap: 6,
    padding: 14,
  },
  metaLabel: {
    color: '#6b7684',
    fontSize: 13,
    width: 96,
  },
  metaRow: {
    flexDirection: 'row',
  },
  metaValue: {
    color: '#191f28',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  nativeHint: {
    color: '#8b95a1',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.74,
  },
  printButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  printButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 24,
  },
  stateBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
