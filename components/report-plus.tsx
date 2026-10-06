import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Segmented } from '@/components/segmented';
import { DISPLAY_FONT } from '@/constants/typography';
import { formatShortDate } from '@/services/format';
import {
  daysBetween,
  shiftDate,
  type NutrientTrendAxis,
  type ReportCompare,
  type ReportInterval,
  type ReportLabResult,
} from '@/services/health-api';

// 플러스 리포트의 두 장 (화면 기획서 P-03, 서버 DATA_MODEL 32-5).
// ⚠️ **판정하지 않는다** — 좋아졌다·나빠졌다를 색·화살표·문구로 말하지 않는다. 숫자만 나란히 둔다.
// ⚠️ **상한 점선은 나트륨에만** 긋는다. 칼륨·인은 지침이 혈청 수치 기반 개인화라 하루 상한이 없다
// (KDOQI 2020) — 투석 참고치를 선으로 그으면 없는 기준을 만든다(CLAUDE.md '절대 하지 말 것').

// ── 지난 구간과 나란히 ──────────────────────────────────────────────────────

export function ReportCompareCard({ compare }: { compare: ReportCompare }) {
  const { current, previous } = compare;

  // 진료가 처음이라 지난 구간이 없으면 표를 숨긴다.
  if (previous === null) {
    return null;
  }

  const rows = [
    { key: 'days', label: '기록한 날', before: dayRatio(previous), now: dayRatio(current) },
    {
      key: 'kcal',
      label: '일평균 섭취',
      before: amount(previous.kcal_daily_avg, 'kcal'),
      now: amount(current.kcal_daily_avg, 'kcal'),
    },
    ...current.nutrients.map((nutrient) => {
      const match = previous.nutrients.find((item) => item.nutrient === nutrient.nutrient);

      return {
        key: nutrient.nutrient,
        label: `${nutrient.label} 일평균`,
        before: match === undefined ? '기록 없음' : amount(match.daily_avg, match.unit),
        now: amount(nutrient.daily_avg, nutrient.unit),
      };
    }),
  ];

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        지난 구간과 나란히
      </Text>

      <View>
        <View style={[styles.tableRow, styles.tableHead]}>
          <Text style={styles.labelCell} />
          <Text style={[styles.valueCell, styles.headCell]}>{`지난 구간\n${period(previous)}`}</Text>
          <Text style={[styles.valueCell, styles.headCell, styles.headCellNow]}>
            {`이번 구간\n${period(current)}`}
          </Text>
        </View>
        {rows.map((row) => (
          <View key={row.key} style={styles.tableRow}>
            <Text style={styles.labelCell}>{row.label}</Text>
            <Text style={styles.valueCell}>{row.before}</Text>
            <Text style={[styles.valueCell, styles.valueCellNow]}>{row.now}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.note}>숫자만 나란히 놓습니다. 좋아졌는지는 담당 의료진과 함께 보세요.</Text>
    </View>
  );
}

function dayRatio(interval: ReportInterval): string {
  return `${interval.recorded_days} / ${interval.total_days}일`;
}

function amount(value: number | null, unit: string): string {
  return value === null ? '기록 없음' : `${Math.round(value).toLocaleString()} ${unit}`;
}

function period(interval: ReportInterval): string {
  return `${formatShortDate(interval.start_date)} ~ ${formatShortDate(interval.end_date)}`;
}

// ── 검사 수치와 식단 겹쳐 보기 ─────────────────────────────────────────────

const CHART_HEIGHT = 150;
// 이보다 주가 많으면(6개월·1년) 칸이 좁아 주마다 날짜·태그를 적을 수 없다 — 날짜는 처음·가운데·끝만,
// 검사 표시는 점으로 줄인다.
const DENSE_WEEKS = 10;

export function ReportLabOverlay({
  axes,
  labs,
  startDate,
  endDate,
  lastVisitOn,
}: {
  axes: NutrientTrendAxis[];
  labs: ReportLabResult[];
  startDate: string;
  endDate: string;
  lastVisitOn: string | null;
}) {
  const [selected, setSelected] = useState<NutrientTrendAxis['nutrient'] | null>(null);
  const axis = axes.find((item) => item.nutrient === selected) ?? axes[0];

  if (axis === undefined) {
    return null;
  }

  const weekCount = Math.floor(daysBetween(startDate, endDate) / 7) + 1;
  const weekOf = (date: string) => Math.floor(daysBetween(startDate, date) / 7);
  const averages = weeklyAverages(axis, weekOf, weekCount);
  const limit = axis.nutrient === 'sodium' ? axis.limit_mg : null;
  const top = niceCeil(Math.max(1, limit ?? 0, ...averages.map((value) => value ?? 0)));
  const isDense = weekCount > DENSE_WEEKS;

  // 기간 밖의 직전 검사(is_before_period)는 겹칠 주가 없다 — 리포트 본문의 검사 수치 칸이 싣는다.
  const inRange = labs.filter(
    (lab) => !lab.is_before_period && lab.measured_on >= startDate && lab.measured_on <= endDate
  );
  const marks: ('진료' | '검사' | null)[] = Array.from({ length: weekCount }, () => null);

  for (const lab of inRange) {
    marks[weekOf(lab.measured_on)] = '검사';
  }

  if (lastVisitOn !== null && lastVisitOn >= startDate && lastVisitOn <= endDate) {
    marks[weekOf(lastVisitOn)] = '진료';
  }

  const labDays = [...new Set(inRange.map((lab) => lab.measured_on))].sort();
  const weekStarts = Array.from({ length: weekCount }, (_, index) => shiftDate(startDate, index * 7));

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        검사 수치와 식단
      </Text>

      {axes.length > 1 ? (
        <View style={styles.picker}>
          <Segmented
            compact
            onChange={setSelected}
            options={axes.map((item) => ({ value: item.nutrient, label: item.label }))}
            value={axis.nutrient}
          />
        </View>
      ) : null}

      <Text style={styles.caption}>
        {limit !== null
          ? `주별 일평균 (mg) · 점선은 하루 상한 ${limit.toLocaleString()}`
          : '주별 일평균 (mg) · 하루 상한 없음 — 혈액검사 수치에 따라 개인별로 정함'}
      </Text>

      <View style={styles.gridRow}>
        <View style={styles.yAxis}>
          <Text style={styles.axisText}>{top.toLocaleString()}</Text>
          <Text style={styles.axisText}>0</Text>
        </View>
        <View style={styles.plot}>
          {limit !== null ? (
            <View pointerEvents="none" style={[styles.limitLine, { top: CHART_HEIGHT * (1 - limit / top) }]}>
              {/* 한쪽 dashed 테두리는 Android 에서 실선으로 그려진다 — 짧은 막대를 늘어놓는다. */}
              {Array.from({ length: 60 }, (_, index) => (
                <View key={`dash-${index}`} style={styles.dash} />
              ))}
            </View>
          ) : null}
          <View style={[styles.bars, isDense && styles.barsDense]}>
            {averages.map((value, index) => (
              <View
                key={weekStarts[index]}
                accessible
                accessibilityLabel={`${formatShortDate(weekStarts[index])} 주 ${
                  value === null ? '기록 없음' : `일평균 ${Math.round(value).toLocaleString()} mg`
                }`}
                style={[styles.bar, { height: value === null ? 0 : Math.max(2, (CHART_HEIGHT * value) / top) }]}
              />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.gridRow}>
        <View style={styles.yAxis} />
        {isDense ? (
          <View style={styles.spreadLabels}>
            {[0, Math.floor(weekCount / 2), weekCount - 1].map((index) => (
              <Text key={`label-${index}`} style={styles.axisText}>
                {formatShortDate(weekStarts[index])}
              </Text>
            ))}
          </View>
        ) : (
          <View style={styles.cells}>
            {weekStarts.map((start) => (
              <Text key={start} numberOfLines={1} style={[styles.cellText, styles.axisText]}>
                {formatShortDate(start)}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.gridRow}>
        <View style={styles.yAxis}>
          <Text style={styles.markLabel}>검사</Text>
        </View>
        <View style={[styles.cells, isDense && styles.barsDense]}>
          {marks.map((mark, index) => (
            <View key={weekStarts[index]} style={styles.cell}>
              {mark === null ? null : isDense ? (
                <View style={styles.markDot} />
              ) : (
                <Text style={styles.markTag}>{mark}</Text>
              )}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.labList}>
        {labDays.length === 0 ? (
          <Text style={styles.note}>이 기간에 옮겨 적은 검사 결과가 없어요.</Text>
        ) : (
          labDays.map((day) => (
            <Text key={day} style={styles.labLine}>
              <Text style={styles.labDay}>{`${formatShortDate(day)} ${day === lastVisitOn ? '진료' : '검사'}`}</Text>
              {`  ${inRange
                .filter((lab) => lab.measured_on === day)
                .map((lab) => `${lab.label} ${lab.value} ${lab.unit}`)
                .join(' · ')}`}
            </Text>
          ))
        )}
      </View>

      {/* 기준선을 그었으면 누가 그은 선인지 함께 적는다(CODE_STYLE '판정으로 읽히는 표현'). */}
      {limit !== null && axis.basis !== null ? <Text style={styles.note}>{axis.basis}</Text> : null}
    </View>
  );
}

// 주마다 **실측이 있던 날만** 나눈 일평균. 기록 없는 날을 0으로 넣으면 "적게 먹었다"로 읽힌다.
function weeklyAverages(
  axis: NutrientTrendAxis,
  weekOf: (date: string) => number,
  weekCount: number
): (number | null)[] {
  const sums = Array.from({ length: weekCount }, () => ({ total: 0, days: 0 }));

  for (const day of axis.days) {
    const week = sums[weekOf(day.date)];

    if (week !== undefined && day.measured_items > 0) {
      week.total += day.consumed_mg;
      week.days += 1;
    }
  }

  return sums.map((week) => (week.days === 0 ? null : week.total / week.days));
}

// 2,210 → 2,500 · 760 → 800. 눈금 끝을 읽기 좋은 수로 올린다.
function niceCeil(value: number): number {
  const step = 10 ** Math.floor(Math.log10(value)) / 2;

  return Math.ceil(value / step) * step;
}

const styles = StyleSheet.create({
  axisText: {
    color: '#5c5b57',
    fontSize: 11,
  },
  bar: {
    backgroundColor: '#2f5fc4',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    flex: 1,
  },
  bars: {
    alignItems: 'flex-end',
    bottom: 0,
    flexDirection: 'row',
    gap: 6,
    left: 0,
    paddingHorizontal: 2,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  barsDense: {
    gap: 2,
  },
  caption: {
    color: '#5c5b57',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  card: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#c9d6f2',
    borderRadius: 20,
    borderWidth: 2,
    gap: 10,
    padding: 18,
  },
  cell: {
    alignItems: 'center',
    flex: 1,
  },
  cellText: {
    flex: 1,
    textAlign: 'center',
  },
  cells: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
  },
  dash: {
    backgroundColor: '#8f3b0e',
    height: 2,
    width: 6,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  headCell: {
    color: '#5c5b57',
    fontWeight: '800',
  },
  headCellNow: {
    color: '#1e4290',
  },
  labDay: {
    color: '#22211f',
    fontWeight: '800',
  },
  labelCell: {
    color: '#22211f',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  labLine: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  labList: {
    gap: 4,
  },
  limitLine: {
    flexDirection: 'row',
    gap: 4,
    height: 2,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },
  markDot: {
    backgroundColor: '#2f5fc4',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  markLabel: {
    color: '#5c5b57',
    fontSize: 11,
    fontWeight: '800',
  },
  markTag: {
    backgroundColor: '#e3ebfb',
    borderRadius: 6,
    color: '#1e4290',
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  note: {
    color: '#5c5b57',
    fontSize: 12,
    lineHeight: 18,
  },
  picker: {
    alignSelf: 'flex-start',
  },
  plot: {
    borderBottomColor: '#22211f',
    borderBottomWidth: 2,
    flex: 1,
    height: CHART_HEIGHT,
  },
  spreadLabels: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tableHead: {
    borderBottomColor: '#e4e2de',
    borderBottomWidth: 2,
  },
  tableRow: {
    alignItems: 'center',
    borderBottomColor: '#e4e2de',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  title: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
    lineHeight: 28,
  },
  valueCell: {
    color: '#22211f',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'right',
    width: 96,
  },
  valueCellNow: {
    fontWeight: '800',
  },
  yAxis: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: 40,
  },
});
