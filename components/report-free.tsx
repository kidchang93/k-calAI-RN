import { StyleSheet, Text, View } from 'react-native';

import { ChunkyButton } from '@/components/chunky-button';
import { DISPLAY_FONT } from '@/constants/typography';
import { formatDaySpan, formatMonthDay } from '@/services/format';
import type { TrendDay } from '@/services/health-api';

// 무료 리포트의 '지난 진료부터 보기' (화면 기획서 P-01, 서버 DATA_MODEL 32-1).
// 막는 것은 **리포트 기간뿐**이다. 기록은 지워지지 않고 그날의 식탁에서 언제든 보인다 — 그 사실을
// 먼저 밝히고, 지난 진료부터 남긴 날 수는 숫자로 그대로 알려 준다(기록은 볼모가 아니다).
// 기간 숫자는 서버의 max_days 를 쓴다(지금은 14일) — 앱에 숫자를 두지 않는다.

const RANGE_HEIGHT = 44;

export function ReportFreeCard({
  maxDays,
  lastVisitOn,
  sinceVisitDays,
  visibleStart,
  visibleEnd,
  onPressPlus,
  onPressVisit,
}: {
  maxDays: number;
  lastVisitOn: string | null;
  // 지난 진료일~오늘의 일별 기록(오름차순, 빈 날 포함). 못 불러왔으면 null — 숫자만 빼고 그린다.
  sinceVisitDays: TrendDay[] | null;
  visibleStart: string;
  visibleEnd: string;
  // 판매 경로가 없는 플랫폼(웹·Android)에서는 null 이라 버튼을 그리지 않는다.
  onPressPlus: (() => void) | null;
  onPressVisit: () => void;
}) {
  const span = formatDaySpan(maxDays);
  const freeSentence = `무료에서는 최근 ${span}${span.endsWith('주') ? '를' : '을'} 한 장으로 묶어 드려요.`;
  const weeks = sinceVisitDays === null ? [] : toWeeks(sinceVisitDays, visibleStart, visibleEnd);
  const recorded = sinceVisitDays?.filter((day) => day.meal_count > 0).length ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text accessibilityRole="header" style={styles.title}>
          지난 진료부터 보기
        </Text>
        <Text style={styles.badge}>플러스</Text>
      </View>

      {lastVisitOn === null ? (
        <>
          <Text style={styles.body}>
            {`${freeSentence} 다녀온 진료일을 적어 두면 그날부터 남긴 날을 세어 드려요.`}
          </Text>
          <ChunkyButton label="진료일 적기" onPress={onPressVisit} tone="visit" variant="outline" />
        </>
      ) : sinceVisitDays === null ? (
        <Text style={styles.body}>
          {`${formatMonthDay(lastVisitOn)} 진료 이후의 기록도 모두 남아 있어요. ${freeSentence}`}
        </Text>
      ) : (
        <>
          <Text style={styles.body}>
            {`${formatMonthDay(lastVisitOn)} 진료부터 오늘까지 `}
            <Text style={styles.strong}>{`${sinceVisitDays.length}일 중 ${recorded}일`}</Text>
            {`을 남기셨어요. ${freeSentence}`}
          </Text>

          {/* 범위 그림 — 지난 진료 이후 주마다 막대 하나, 지금 리포트에 담긴 주만 파랗게. 높이는 그 주에
              남긴 날이다(빈 주도 보이게 바닥을 둔다). 아래 문장이 같은 말을 하므로 낭독에서는 뺀다. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.range, weeks.length > 12 && styles.rangeDense]}>
            {weeks.map((week) => (
              <View
                key={week.start}
                style={[
                  styles.rangeBar,
                  week.visible && styles.rangeBarVisible,
                  { height: RANGE_HEIGHT * (0.3 + (0.7 * week.recorded) / 7) },
                ]}
              />
            ))}
          </View>
          <Text style={styles.caption}>
            {`지난 진료 이후 ${weeks.length}주 중 파란 막대가 지금 보이는 범위예요 · 높이는 그 주에 남긴 날`}
          </Text>
        </>
      )}

      <Text style={styles.reassure}>
        기록은 하나도 지워지지 않아요. 지난 날짜는 언제든 그날의 식탁에서 볼 수 있어요.
      </Text>

      {onPressPlus !== null ? (
        <ChunkyButton label="플러스 알아보기" onPress={onPressPlus} tone="visit" />
      ) : null}
    </View>
  );
}

// 일별 기록은 빈 날까지 오름차순으로 채워져 온다(DATA_MODEL 15장) — 7개씩 끊으면 주다.
function toWeeks(
  days: TrendDay[],
  visibleStart: string,
  visibleEnd: string
): { start: string; recorded: number; visible: boolean }[] {
  const weeks: { start: string; recorded: number; visible: boolean }[] = [];

  for (let index = 0; index < days.length; index += 7) {
    const week = days.slice(index, index + 7);

    weeks.push({
      start: week[0].date,
      recorded: week.filter((day) => day.meal_count > 0).length,
      visible: week[0].date <= visibleEnd && week[week.length - 1].date >= visibleStart,
    });
  }

  return weeks;
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#e3ebfb',
    borderRadius: 999,
    color: '#1e4290',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  body: {
    color: '#22211f',
    fontSize: 15,
    lineHeight: 23,
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
    borderRadius: 18,
    borderWidth: 2,
    gap: 10,
    padding: 16,
  },
  headRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  range: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
    height: RANGE_HEIGHT,
  },
  rangeBar: {
    backgroundColor: '#e4e2de',
    borderRadius: 4,
    flex: 1,
  },
  rangeBarVisible: {
    backgroundColor: '#2f5fc4',
  },
  rangeDense: {
    gap: 2,
  },
  reassure: {
    backgroundColor: '#f7f6f4',
    borderRadius: 10,
    color: '#22211f',
    fontSize: 13,
    lineHeight: 19,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  strong: {
    fontWeight: '800',
  },
  title: {
    color: '#22211f',
    flexShrink: 1,
    fontFamily: DISPLAY_FONT,
    fontSize: 21,
    lineHeight: 27,
  },
});
