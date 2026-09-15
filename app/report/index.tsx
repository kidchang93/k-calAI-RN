import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { MedicalDisclaimer } from '@/components/medical-disclaimer';
import { MEAL_TYPE_LABELS } from '@/constants/meal';
import { formatFoodLabel } from '@/services/food-label';
import { formatGeneratedAt } from '@/services/format';
import { getMedicalReport, MedicalReport, recentDateRange, ReportMeal } from '@/services/health-api';
import { getConsents, isSensitiveConsentOutdated } from '@/services/onboarding-api';

// 진료·영양상담에 가져가는 기록. 목표 지표의 첫 항목("진료에서 실제로 열어 보였는가",
// 서버 PRODUCT_STRATEGY §0-2)을 가능하게 하는 화면이다.
//
// **웹에서는 인쇄(PDF 저장)가 되고 네이티브에서는 안 된다.** 결제와 같은 이유로 주 무대가
// 웹이라(FastAPI 가 webapp 을 서빙) 우선 웹에 맞춘다. 네이티브에는 버튼 대신 안내를 둔다 —
// 누를 수 없는 버튼을 그려 놓고 눌렀을 때 실패시키지 않는다 (docs/DESIGN.md 의 결제 선례).

const PERIOD_DAYS = 30;

function isPrintSupported(): boolean {
  return Platform.OS === 'web';
}

export default function MedicalReportScreen() {
  const params = useLocalSearchParams<{ start_date?: string; end_date?: string }>();
  const [report, setReport] = useState<MedicalReport | null>(null);
  // 이전 문구의 건강 정보 동의만 있으면 서버가 질환·검사 수치를 싣지 않는다 — "등록 질환: 없음"으로
  // 읽히지 않게 가른다. 동의 조회가 실패해도 리포트는 그린다(false 로 둔다).
  const [isHealthConsentOutdated, setIsHealthConsentOutdated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const range = recentDateRange(PERIOD_DAYS);
  const startDate = params.start_date ?? range.start_date;
  const endDate = params.end_date ?? range.end_date;

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [reportResult, consents] = await Promise.all([
        getMedicalReport(startDate, endDate),
        getConsents().catch(() => null),
      ]);

      setReport(reportResult);
      setIsHealthConsentOutdated(consents !== null && isSensitiveConsentOutdated(consents));
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
                <MaterialIcons color="#22211f" name="print" size={18} />
                <Text style={styles.printButtonText}>인쇄 · PDF 저장</Text>
              </Pressable>
            ) : null}
          </View>

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#2a7d76" />
            </View>
          ) : errorMessage !== null ? (
            <ErrorBanner message={errorMessage} onRetry={() => void load()} />
          ) : report === null ? null : (
            <ReportBody report={report} isHealthConsentOutdated={isHealthConsentOutdated} />
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

function ReportBody({
  report,
  isHealthConsentOutdated,
}: {
  report: MedicalReport;
  isHealthConsentOutdated: boolean;
}) {
  const byDate = groupByDate(report.meals);

  return (
    <View style={styles.sheet}>
      <Text style={styles.docTitle}>식단 기록 요약</Text>
      <Text style={styles.docPeriod}>
        {`${report.start_date} ~ ${report.end_date} · ${formatGeneratedAt(report.generated_at)} 기준`}
      </Text>

      {/* **질환·병기가 수치보다 먼저다.** 읽는 사람이 어떤 기준으로 볼지를 먼저 알아야 한다. */}
      <View style={styles.metaBox}>
        {/* 진료 문서 맨 위라 "없음"이 가장 먼저 읽힌다. 이전 동의만 있으면 서버가 질환을 싣지 않으므로
            없는 것이 아니라 싣지 않았다고 적는다(이유는 문서 아래 notice 에 서버가 남긴다). */}
        <MetaRow
          label="등록 질환"
          value={
            isHealthConsentOutdated
              ? '건강 정보 동의가 바뀌어 싣지 않음'
              : report.conditions.length > 0
                ? report.conditions.join(' · ')
                : '없음'
          }
        />
        {report.ckd_stage_label !== null ? (
          <MetaRow label="신장질환 병기" value={report.ckd_stage_label} />
        ) : null}
        {/* 기록 없는 날을 **숫자로 따로** 적는다. "13일 / 44일"은 비율로 읽혀 빈 31일이 눈에 안 띈다 —
            3일 기록한 리포트와 30일 기록한 리포트가 같은 무게로 보이면 진료에 가져갈 근거로 정직하지
            않다 (서버 `CARE_LOOP.md` §6). */}
        <MetaRow
          label="기록"
          value={`${report.kcal.recorded_days}일 기록 · 기록 없는 날 ${
            report.kcal.total_days - report.kcal.recorded_days
          }일 (전체 ${report.kcal.total_days}일)`}
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
              {/* 의료진이 보는 종이라 **누가 그은 선인지**를 같은 줄에 적는다. "N일 초과"만
                  남기면 앱이 환자를 판정한 기록으로 읽힌다 (KCAL-16). */}
              <Text style={styles.axisNote}>
                {axis.limit_mg !== null && axis.days_over_limit !== null
                  ? `${axis.basis ?? `기준 ${axis.limit_mg.toLocaleString()} mg`} · 기준보다 많았던 날 ${axis.days_over_limit}일`
                  : axis.reference_mg !== null
                    ? (axis.basis ?? `참고치 ${axis.reference_mg.toLocaleString()} mg`)
                    : // "기준 없음"은 기준이 없는 것으로 읽힌다. 실제로는 지침이 하루 상한 대신 혈액검사
                      // 기반 개인화를 권한다(서버 CKD_NUTRITION 3-6) — 그 사실을 적는다.
                      '하루 상한 없음 · 혈액검사 수치에 따라 개인별로 정함'}
              </Text>
            </View>
          ))}
          <Text style={styles.blockNotice}>{report.nutrients.notice}</Text>
        </View>
      ) : null}

      {/* 검사 수치 — **식단 요약 바로 다음**이다. "무엇을 먹었나"와 "그래서 수치가 어떻게
          됐나"가 나란히 놓여야 진료에서 되짚을 근거가 된다 (서버 `docs/CARE_LOOP.md` §4).
          기간에 검사가 없으면 서버가 직전 값을 실어 주고, 그 사실을 여기서 밝힌다 —
          검사 주기(3개월)가 리포트 기간보다 길기 때문이다. */}
      {report.labs.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>검사 수치</Text>
          {report.labs.map((lab) => (
            <View key={`${lab.measured_on}-${lab.panel}`} style={styles.axisRow}>
              <Text style={styles.axisName}>{lab.label}</Text>
              <Text style={styles.axisValue}>{`${lab.value} ${lab.unit}`}</Text>
              <Text style={styles.axisNote}>
                {lab.is_before_period
                  ? `${lab.measured_on} 검사 (조회 기간 이전)`
                  : `${lab.measured_on} 검사`}
                {lab.reference !== null ? ` · ${lab.reference}` : ''}
              </Text>
            </View>
          ))}
          <Text style={styles.blockNotice}>
            사용자가 검사 결과지를 보고 직접 입력한 값입니다. 앱이 측정하거나 정상 여부를
            판단하지 않습니다.
          </Text>
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
      {/* 인쇄·PDF 로 **앱 밖에 나가는 결과물**이라 AI 가 관여한 부분을 종이에도 남긴다(AI기본법 제31조②,
          KCAL-17). 음식명은 사용자가 확인했더라도 출발점이 AI 인식이다. */}
      <Text style={styles.docNotice}>
        사진으로 기록한 음식명은 생성형 AI(Google Gemini)가 인식한 뒤 사용자가 확인한 것이며, 식약처 DB에
        없는 일부 음식의 칼로리는 생성형 AI가 추정한 값입니다.
      </Text>

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

const styles = StyleSheet.create({
  axisName: {
    color: '#22211f',
    fontSize: 14,
    fontWeight: '800',
    width: 60,
  },
  axisNote: {
    color: '#5c5b57',
    fontSize: 13,
  },
  axisRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  axisValue: {
    color: '#22211f',
    flex: 1,
    fontSize: 14,
  },
  block: {
    borderTopColor: '#e4e2de',
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 16,
  },
  blockNotice: {
    color: '#a9a6a1',
    fontSize: 11,
    lineHeight: 16,
  },
  blockTitle: {
    color: '#22211f',
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
    color: '#5c5b57',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  docNotice: {
    borderTopColor: '#e4e2de',
    borderTopWidth: 1,
    color: '#5c5b57',
    fontSize: 11,
    lineHeight: 16,
    paddingTop: 12,
  },
  docPeriod: {
    color: '#5c5b57',
    fontSize: 13,
  },
  docTitle: {
    color: '#22211f',
    fontSize: 22,
    fontWeight: '900',
  },
  emptyText: {
    color: '#a9a6a1',
    fontSize: 14,
  },
  itemText: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  mealItems: {
    flex: 1,
  },
  mealKcal: {
    color: '#22211f',
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
    color: '#5c5b57',
    fontSize: 13,
    width: 34,
  },
  metaBox: {
    backgroundColor: '#f7f6f4',
    borderRadius: 8,
    gap: 6,
    padding: 14,
  },
  metaLabel: {
    color: '#5c5b57',
    fontSize: 13,
    width: 96,
  },
  metaRow: {
    flexDirection: 'row',
  },
  metaValue: {
    color: '#22211f',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  nativeHint: {
    color: '#a9a6a1',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.74,
  },
  printButton: {
    alignItems: 'center',
    backgroundColor: '#60beb8',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  printButtonText: {
    color: '#22211f',
    fontSize: 14,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: '#f7f6f4',
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
