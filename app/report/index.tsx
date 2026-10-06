import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { ChunkyButton } from '@/components/chunky-button';
import { DetailHeader } from '@/components/detail-header';
import { ErrorBanner } from '@/components/error-banner';
import { MedicalDisclaimer } from '@/components/medical-disclaimer';
import { ReportFreeCard } from '@/components/report-free';
import { ReportCompareCard, ReportLabOverlay } from '@/components/report-plus';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { MEAL_TYPE_LABELS } from '@/constants/meal';
import { DISPLAY_FONT } from '@/constants/typography';
import { formatFoodLabel } from '@/services/food-label';
import { formatDaySpan, formatGeneratedAt, formatMonthDay } from '@/services/format';
import {
  daysBetween,
  formatDateParam,
  getMedicalReport,
  getReportCompare,
  getTrendDays,
  MedicalReport,
  recentDateRange,
  ReportCompare,
  ReportMeal,
  TrendDay,
} from '@/services/health-api';
import { PlanLimitError } from '@/services/http';
import { getConsents, isSensitiveConsentOutdated } from '@/services/onboarding-api';

// 진료·영양상담에 가져가는 기록. 목표 지표의 첫 항목("진료에서 실제로 열어 보였는가",
// 서버 PRODUCT_STRATEGY §0-2)을 가능하게 하는 화면이다.
//
// **웹에서는 인쇄(PDF 저장)가 되고 네이티브에서는 안 된다.** 결제와 같은 이유로 주 무대가
// 웹이라(FastAPI 가 webapp 을 서빙) 우선 웹에 맞춘다. 네이티브에는 버튼 대신 안내를 둔다 —
// 누를 수 없는 버튼을 그려 놓고 눌렀을 때 실패시키지 않는다 (docs/DESIGN.md 의 결제 선례).
//
// '진료실에서 크게 보기'(2026-10-05)는 화면을 의사에게 그대로 내밀 때를 위한 것이다. 글자 1.3배·
// 숫자 1.5배로 키우기만 하고 내용은 그대로다. 인쇄물은 늘 보통 크기다.
//
// **기간은 서버가 정한다**(2026-10-06, 서버 DATA_MODEL 32-5). 무료는 최근 14일로
// 고정이고 '지난 진료부터 보기'(P-01)가 붙는다. 플러스는 지난 진료일부터 오늘이 기본이고 기간
// 바꾸기·지난 구간과 나란히·검사 수치와 식단 겹쳐 보기(P-03)가 붙는다. 앱만 막으면 웹 인쇄로
// 새므로 제한은 서버가 걸고, 화면은 응답의 range.plan 으로 갈라 그리기만 한다.

const TEXT_ZOOM = 1.3;
const NUMBER_ZOOM = 1.5;

type PeriodChoice = 'visit' | '3m' | '6m' | '1y';

// 플러스 상한은 365일이다(32-1).
const CHOICE_DAYS: Record<Exclude<PeriodChoice, 'visit'>, number> = { '3m': 90, '6m': 180, '1y': 365 };

function isPrintSupported(): boolean {
  return Platform.OS === 'web';
}

// 플러스는 **iOS 에서만 판다**(32-7). 판매 경로가 없는 웹·Android 에서 결제를 권하면 App Store
// 3.1.1·Play 결제 정책에 걸린다 — 그곳에서는 버튼을 그리지 않는다.
function isPlusSaleSupported(): boolean {
  return Platform.OS === 'ios';
}

export default function MedicalReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ start_date?: string; end_date?: string }>();
  const [report, setReport] = useState<MedicalReport | null>(null);
  // 이전 문구의 건강 정보 동의만 있으면 서버가 질환·검사 수치를 싣지 않는다 — "등록 질환: 없음"으로
  // 읽히지 않게 가른다. 동의 조회가 실패해도 리포트는 그린다(false 로 둔다).
  const [isHealthConsentOutdated, setIsHealthConsentOutdated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLarge, setIsLarge] = useState(false);
  // 플러스의 기간 바꾸기. null 이면 서버 기본 기간(딥링크 파라미터가 있으면 그것)이다.
  const [choice, setChoice] = useState<PeriodChoice | null>(null);
  const [compare, setCompare] = useState<ReportCompare | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  // 무료의 '지난 진료부터 남긴 날' — 리포트 기간 밖이라 일별 기록을 따로 읽는다.
  const [sinceVisitDays, setSinceVisitDays] = useState<TrendDay[] | null>(null);
  // 기간을 연달아 바꿀 때 늦게 온 이전 응답이 지금 선택을 덮어쓰지 않게 한다.
  const loadSeqRef = useRef(0);

  const range = report?.range ?? null;
  const plan = range?.plan ?? null;
  const lastVisitOn = range?.last_visit_on ?? null;

  const requested =
    choice === null
      ? params.start_date !== undefined && params.end_date !== undefined
        ? { start_date: params.start_date, end_date: params.end_date }
        : null
      : choice === 'visit'
        ? lastVisitOn === null
          ? null
          : { start_date: lastVisitOn, end_date: formatDateParam(new Date()) }
        : recentDateRange(CHOICE_DAYS[choice]);
  const requestStart = requested?.start_date ?? null;
  const requestEnd = requested?.end_date ?? null;

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [reportResult, consents] = await Promise.all([
        getMedicalReport(
          requestStart !== null && requestEnd !== null
            ? { start_date: requestStart, end_date: requestEnd }
            : null
        ),
        getConsents().catch(() => null),
      ]);

      if (loadSeqRef.current === seq) {
        setReport(reportResult);
        setIsHealthConsentOutdated(consents !== null && isSensitiveConsentOutdated(consents));
      }
    } catch (error) {
      if (loadSeqRef.current === seq) {
        setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      if (loadSeqRef.current === seq) {
        setIsLoading(false);
      }
    }
  }, [requestStart, requestEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  // 구간 비교는 기간 바꾸기와 무관하다(지난 진료 구간 ↔ 이번 구간 고정) — 플러스일 때 한 번 읽는다.
  useEffect(() => {
    if (plan !== 'plus') {
      return;
    }

    void getReportCompare()
      .then((result) => {
        setCompare(result);
        setCompareError(null);
      })
      .catch((error: unknown) => {
        setCompare(null);
        // 402 = 서버가 이제 플러스가 아니라고 본다(구독이 막 끝났다). 표만 빼고 나머지는 그대로 둔다.
        setCompareError(
          error instanceof PlanLimitError
            ? null
            : error instanceof Error
              ? error.message
              : '지난 구간을 불러오지 못했어요.'
        );
      });
  }, [plan]);

  useEffect(() => {
    if (plan !== 'free' || lastVisitOn === null) {
      return;
    }

    void getTrendDays(lastVisitOn, formatDateParam(new Date()))
      .then(setSinceVisitDays)
      // 세지 못하면 카드가 숫자만 빼고 그린다 — 리포트를 막을 일이 아니다.
      .catch(() => setSinceVisitDays(null));
  }, [plan, lastVisitOn]);

  const print = () => {
    if (!isLarge) {
      window.print();
      return;
    }

    // 인쇄물은 기존 크기여야 한다. 크게 보기를 끈 렌더가 커밋된 뒤(눌림 이벤트의 상태 갱신은
    // 다음 매크로태스크 전에 반영된다) 인쇄 창을 연다.
    setIsLarge(false);
    setTimeout(() => window.print(), 0);
  };

  return (
    <Screen
      gap={16}
      footer={
        <View style={styles.footerRow}>
          <View style={styles.footerMain}>
            <ChunkyButton
              disabled={report === null}
              label={isLarge ? '보통 크기로' : '진료실에서 크게 보기'}
              onPress={() => setIsLarge((current) => !current)}
              tone="visit"
            />
          </View>
          {isPrintSupported() ? (
            <View style={styles.footerSide}>
              <ChunkyButton label="인쇄 · PDF" onPress={print} tone="visit" variant="outline" />
            </View>
          ) : null}
        </View>
      }>
      <DetailHeader caption={report === null ? null : periodCaption(report)} title="진료 리포트" tone="visit" />

      {/* 다시 불러오는 동안에도 남겨 둔다 — 고르는 도중에 줄이 사라졌다 나타나면 손이 헛돈다. */}
      {report !== null && plan === 'plus' ? (
        <View style={styles.periodRow}>
          <Text style={styles.periodLabel}>기간 바꾸기</Text>
          <Segmented
            compact
            onChange={setChoice}
            options={periodOptions(lastVisitOn !== null)}
            value={choice ?? (lastVisitOn !== null && report.start_date === lastVisitOn ? 'visit' : '3m')}
          />
        </View>
      ) : null}

      {range !== null && range.clamped ? (
        <Text style={styles.clampNote}>{`고른 기간이 길어 최근 ${range.max_days}일까지만 담았어요.`}</Text>
      ) : null}

      {isLoading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color="#2f5fc4" />
        </View>
      ) : errorMessage !== null ? (
        <ErrorBanner message={errorMessage} onRetry={() => void load()} />
      ) : report === null ? null : (
        <>
          {range !== null && range.plan === 'free' ? (
            <ReportFreeCard
              lastVisitOn={range.last_visit_on}
              maxDays={range.max_days}
              onPressPlus={isPlusSaleSupported() ? () => router.push('/plus') : null}
              onPressVisit={() => router.push('/visit')}
              sinceVisitDays={sinceVisitDays}
              visibleEnd={report.end_date}
              visibleStart={report.start_date}
            />
          ) : null}

          {range !== null && range.plan === 'plus' ? (
            <>
              {compare !== null ? (
                <ReportCompareCard compare={compare} />
              ) : compareError !== null ? (
                <Text style={styles.nativeHint}>{compareError}</Text>
              ) : null}
              {/* 데이터는 리포트에 이미 있다(일별 영양·검사 수치) — 무료에서 막는 것은 화면뿐이다(32-1). */}
              {report.nutrients !== null ? (
                <ReportLabOverlay
                  axes={report.nutrients.axes}
                  endDate={report.end_date}
                  labs={report.labs}
                  lastVisitOn={range.last_visit_on}
                  startDate={report.start_date}
                />
              ) : null}
            </>
          ) : null}

          <ReportBody
            report={report}
            isHealthConsentOutdated={isHealthConsentOutdated}
            zoom={isLarge ? TEXT_ZOOM : 1}
            numberZoom={isLarge ? NUMBER_ZOOM : 1}
          />
        </>
      )}

      {!isPrintSupported() ? (
        <Text style={styles.nativeHint}>
          인쇄와 PDF 저장은 웹에서 할 수 있어요. 브라우저로 접속해 이 화면을 열어주세요.
        </Text>
      ) : null}
    </Screen>
  );
}

function periodOptions(hasLastVisit: boolean): { value: PeriodChoice; label: string }[] {
  const fixed: { value: PeriodChoice; label: string }[] = [
    { value: '3m', label: '3개월' },
    { value: '6m', label: '6개월' },
    { value: '1y', label: '1년' },
  ];

  return hasLastVisit ? [{ value: 'visit', label: '지난 진료부터' }, ...fixed] : fixed;
}

type SizedStyle = { fontSize?: number; lineHeight?: number; width?: number };

function ReportBody({
  report,
  isHealthConsentOutdated,
  zoom,
  numberZoom,
}: {
  report: MedicalReport;
  isHealthConsentOutdated: boolean;
  zoom: number;
  numberZoom: number;
}) {
  const byDate = groupByDate(report.meals);
  const t = (style: SizedStyle) => [style, zoomed(style, zoom)];
  const n = (style: SizedStyle) => [style, zoomed(style, numberZoom)];

  return (
    <View style={styles.sheet}>
      <View style={styles.docHead}>
        <Text style={t(styles.docTitle)}>식단 기록 요약</Text>
        <Text style={t(styles.docPeriod)}>
          {`${report.start_date} ~ ${report.end_date} · ${formatGeneratedAt(report.generated_at)} 기준`}
        </Text>
      </View>

      {/* **질환·병기가 수치보다 먼저다.** 읽는 사람이 어떤 기준으로 볼지를 먼저 알아야 한다. */}
      <View style={styles.metaBox}>
        {/* 진료 문서 맨 위라 "없음"이 가장 먼저 읽힌다. 이전 동의만 있으면 서버가 질환을 싣지 않으므로
            없는 것이 아니라 싣지 않았다고 적는다(이유는 문서 아래 notice 에 서버가 남긴다). */}
        <MetaRow
          label="등록 질환"
          zoom={zoom}
          value={
            isHealthConsentOutdated
              ? '건강 정보 동의가 바뀌어 싣지 않음'
              : report.conditions.length > 0
                ? report.conditions.join(' · ')
                : '없음'
          }
        />
        {report.ckd_stage_label !== null ? (
          <MetaRow label="신장질환 병기" value={report.ckd_stage_label} zoom={zoom} />
        ) : null}
        {/* 기록 없는 날을 **숫자로 따로** 적는다. "13일 / 44일"은 비율로 읽혀 빈 31일이 눈에 안 띈다 —
            3일 기록한 리포트와 30일 기록한 리포트가 같은 무게로 보이면 진료에 가져갈 근거로 정직하지
            않다 (서버 `CARE_LOOP.md` §6). */}
        <MetaRow
          label="기록"
          zoom={zoom}
          value={`${report.kcal.recorded_days}일 기록 · 기록 없는 날 ${
            report.kcal.total_days - report.kcal.recorded_days
          }일 (전체 ${report.kcal.total_days}일)`}
        />
        <MetaRow
          label="일평균 섭취"
          zoom={zoom}
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
          <Text style={t(styles.blockTitle)}>영양소 요약</Text>
          {report.nutrients.axes.map((axis) => (
            <View key={axis.nutrient} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={t(styles.rowName)}>{axis.label}</Text>
                <Text style={n(styles.rowValue)}>
                  {axis.average_mg !== null
                    ? `기록일 평균 ${Math.round(axis.average_mg).toLocaleString()} mg`
                    : '기록 없음'}
                </Text>
              </View>
              {/* 의료진이 보는 종이라 **누가 그은 선인지**를 같은 줄에 적는다. "N일 초과"만
                  남기면 앱이 환자를 판정한 기록으로 읽힌다 (KCAL-16). */}
              <Text style={t(styles.rowNote)}>
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
          <Text style={t(styles.blockNotice)}>{report.nutrients.notice}</Text>
        </View>
      ) : null}

      {/* 검사 수치 — **식단 요약 바로 다음**이다. "무엇을 먹었나"와 "그래서 수치가 어떻게
          됐나"가 나란히 놓여야 진료에서 되짚을 근거가 된다 (서버 `docs/CARE_LOOP.md` §4).
          기간에 검사가 없으면 서버가 직전 값을 실어 주고, 그 사실을 여기서 밝힌다 —
          검사 주기(3개월)가 리포트 기간보다 길기 때문이다. 값에 색을 칠하지 않는다(판정 금지). */}
      {report.labs.length > 0 ? (
        <View style={styles.block}>
          <Text style={t(styles.blockTitle)}>검사 수치</Text>
          {report.labs.map((lab) => (
            <View key={`${lab.measured_on}-${lab.panel}`} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={t(styles.rowName)}>{lab.label}</Text>
                <Text style={n(styles.rowValue)}>{`${lab.value} ${lab.unit}`}</Text>
              </View>
              <Text style={t(styles.rowNote)}>
                {lab.is_before_period
                  ? `${lab.measured_on} 검사 (조회 기간 이전)`
                  : `${lab.measured_on} 검사`}
                {lab.reference !== null ? ` · ${lab.reference}` : ''}
              </Text>
            </View>
          ))}
          <Text style={t(styles.blockNotice)}>
            사용자가 검사 결과지를 보고 직접 입력한 값입니다. 앱이 측정하거나 정상 여부를
            판단하지 않습니다.
          </Text>
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={t(styles.blockTitle)}>식단 기록</Text>
        {byDate.length === 0 ? (
          <Text style={t(styles.emptyText)}>이 기간에 기록이 없습니다.</Text>
        ) : (
          byDate.map(([date, meals]) => (
            <View key={date} style={styles.dayBlock}>
              <Text style={t(styles.dayTitle)}>{date}</Text>
              {meals.map((meal, index) => (
                <View key={`${meal.logged_at}-${index}`} style={styles.mealRow}>
                  <Text style={t(styles.mealType)}>{MEAL_TYPE_LABELS[meal.meal_type]}</Text>
                  <View style={styles.mealItems}>
                    {meal.items.map((item, itemIndex) => (
                      <Text key={itemIndex} style={t(styles.itemText)}>
                        {`${formatFoodLabel(item.food_label)} · ${item.kcal.toLocaleString()} kcal`}
                        {/* 실측이 없던 항목은 비워 둔다 — 0으로 적으면 "안 먹었다"가 된다. */}
                        {item.sodium_mg !== null
                          ? `  (나트륨 ${Math.round(item.sodium_mg).toLocaleString()} mg)`
                          : '  (영양 정보 없음)'}
                      </Text>
                    ))}
                  </View>
                  <Text style={n(styles.mealKcal)}>{`${meal.total_kcal.toLocaleString()} kcal`}</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      <Text style={t(styles.docNotice)}>{report.notice}</Text>
      {/* 인쇄·PDF 로 **앱 밖에 나가는 결과물**이라 AI 가 관여한 부분을 종이에도 남긴다(AI기본법 제31조②,
          KCAL-17). 음식명은 사용자가 확인했더라도 출발점이 AI 인식이다. */}
      <Text style={t(styles.docNotice)}>
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

function MetaRow({ label, value, zoom }: { label: string; value: string; zoom: number }) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, zoomed(styles.metaLabel, zoom)]}>{label}</Text>
      <Text style={[styles.metaValue, zoomed(styles.metaValue, zoom)]}>{value}</Text>
    </View>
  );
}

// 크게 보기 — 글자와 함께 줄 간격·고정 너비도 키워야 잘리거나 겹치지 않는다.
function zoomed(style: SizedStyle, factor: number): SizedStyle | null {
  if (factor === 1) {
    return null;
  }

  const result: SizedStyle = {};

  if (style.fontSize !== undefined) result.fontSize = Math.round(style.fontSize * factor);
  if (style.lineHeight !== undefined) result.lineHeight = Math.round(style.lineHeight * factor);
  if (style.width !== undefined) result.width = Math.round(style.width * factor);

  return result;
}

// '9월 22일 ~ 10월 5일 · 최근 2주'(무료) · '8월 13일 진료 ~ 10월 5일 · 54일'(지난 진료부터).
function periodCaption(report: MedicalReport): string {
  const { start_date: start, end_date: end, range } = report;
  const days = daysBetween(start, end) + 1;
  const from =
    range !== null && range.last_visit_on === start ? `${formatMonthDay(start)} 진료` : formatMonthDay(start);
  const length = !Number.isFinite(days)
    ? ''
    : ` · ${range !== null && range.plan === 'free' ? '최근 ' : ''}${formatDaySpan(days)}`;

  return `${from} ~ ${formatMonthDay(end)}${length}`;
}

function groupByDate(meals: ReportMeal[]): [string, ReportMeal[]][] {
  const map = new Map<string, ReportMeal[]>();

  for (const meal of meals) {
    map.set(meal.date, [...(map.get(meal.date) ?? []), meal]);
  }

  return [...map.entries()];
}

const styles = StyleSheet.create({
  block: {
    borderTopColor: '#e4e2de',
    borderTopWidth: 2,
    gap: 10,
    paddingTop: 14,
  },
  blockNotice: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  blockTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
    lineHeight: 25,
  },
  clampNote: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  dayBlock: {
    gap: 4,
  },
  dayTitle: {
    color: '#1e4290',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 6,
  },
  docHead: {
    gap: 4,
  },
  docNotice: {
    borderTopColor: '#e4e2de',
    borderTopWidth: 2,
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
    paddingTop: 12,
  },
  docPeriod: {
    color: '#5c5b57',
    fontSize: 14,
    lineHeight: 20,
  },
  docTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 24,
    lineHeight: 31,
  },
  emptyText: {
    color: '#5c5b57',
    fontSize: 15,
  },
  footerMain: {
    flex: 2,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footerSide: {
    flex: 1,
  },
  itemText: {
    color: '#5c5b57',
    fontSize: 14,
    lineHeight: 20,
  },
  mealItems: {
    flex: 1,
  },
  mealKcal: {
    color: '#22211f',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  mealRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  mealType: {
    color: '#5c5b57',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    width: 36,
  },
  metaBox: {
    backgroundColor: '#e3ebfb',
    borderRadius: 14,
    gap: 6,
    padding: 14,
  },
  metaLabel: {
    color: '#5c5b57',
    fontSize: 14,
    lineHeight: 21,
    width: 100,
  },
  metaRow: {
    flexDirection: 'row',
  },
  metaValue: {
    color: '#22211f',
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  nativeHint: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  periodLabel: {
    color: '#1e4290',
    fontSize: 14,
    fontWeight: '800',
  },
  periodRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  row: {
    gap: 2,
  },
  rowHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  rowName: {
    color: '#22211f',
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  rowNote: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  rowValue: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '900',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#c9d6f2',
    borderRadius: 20,
    borderWidth: 2,
    gap: 14,
    padding: 18,
  },
  stateBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
});
