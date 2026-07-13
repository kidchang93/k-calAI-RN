import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TrendDay } from '@/services/health-api';

// 달력 한 칸. days 에 없는 날(범위 밖·다음달)은 null 로 채워 7열 그리드를 맞춘다.
type Cell = { date: string; day: number; kcal: number; hasMeal: boolean } | null;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type Props = {
  // 표시할 달의 1일 (로컬 기준).
  month: Date;
  days: TrendDay[];
  targetKcal: number | null;
  selectedDate: string | null;
  todayDate: string;
  onSelectDate: (date: string) => void;
  onChangeMonth: (delta: number) => void;
  // 다음 달로 못 넘어가게 막는다 (미래엔 기록이 없다).
  canGoNext: boolean;
};

export function KcalCalendar({
  month,
  days,
  targetKcal,
  selectedDate,
  todayDate,
  onSelectDate,
  onChangeMonth,
  canGoNext,
}: Props) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  // 1일의 요일만큼 앞을 비우고, 말일까지 채운다.
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();

  const byDate = new Map(days.map((d) => [d.date, d]));

  const cells: Cell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entry = byDate.get(date);
    cells.push({
      date,
      day,
      kcal: entry?.consumed_kcal ?? 0,
      // meal_count 로 판단한다 — 0kcal 기록(물·차)도 '기록한 날'이다.
      hasMeal: (entry?.meal_count ?? 0) > 0,
    });
  }
  // 마지막 주를 7칸으로 맞춘다.
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <View style={styles.card}>
      <View style={styles.monthRow}>
        <Pressable
          hitSlop={10}
          onPress={() => onChangeMonth(-1)}
          style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
          <MaterialIcons color="#4e5968" name="chevron-left" size={22} />
        </Pressable>
        <Text style={styles.monthTitle}>{`${year}년 ${monthIndex + 1}월`}</Text>
        <Pressable
          disabled={!canGoNext}
          hitSlop={10}
          onPress={() => onChangeMonth(1)}
          style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
          <MaterialIcons color={canGoNext ? '#4e5968' : '#d1d6db'} name="chevron-right" size={22} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((cell, cellIndex) => {
            if (cell === null) {
              return <View key={`empty-${cellIndex}`} style={styles.cell} />;
            }

            const isSelected = cell.date === selectedDate;
            const isToday = cell.date === todayDate;
            const isFuture = cell.date > todayDate;
            // 목표가 있으면 초과분을 빨강으로 — 리포트 탭 막대 차트와 같은 규칙.
            const isOver = targetKcal !== null && cell.kcal > targetKcal;

            return (
              <Pressable
                key={cell.date}
                disabled={isFuture}
                onPress={() => onSelectDate(cell.date)}
                style={({ pressed }) => [
                  styles.cell,
                  isSelected && styles.cellSelected,
                  pressed && !isSelected && styles.pressed,
                ]}>
                <Text
                  style={[
                    styles.cellDay,
                    isToday && styles.cellDayToday,
                    isSelected && styles.cellDaySelected,
                    isFuture && styles.cellDayFuture,
                  ]}>
                  {cell.day}
                </Text>
                {cell.hasMeal ? (
                  <Text
                    style={[
                      styles.cellKcal,
                      isOver && styles.cellKcalOver,
                      isSelected && styles.cellKcalSelected,
                    ]}
                    numberOfLines={1}>
                    {cell.kcal.toLocaleString()}
                  </Text>
                ) : (
                  <Text style={styles.cellEmptyDot}>·</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3182f6' }]} />
          <Text style={styles.legendText}>목표 이내</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#e5484d' }]} />
          <Text style={styles.legendText}>목표 초과</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendMuted}>· 기록 없음</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 4,
    padding: 12,
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  monthButton: {
    borderRadius: 6,
    padding: 4,
  },
  monthTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingBottom: 4,
  },
  weekdayLabel: {
    color: '#8b95a1',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
  },
  cell: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    gap: 1,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  cellSelected: {
    backgroundColor: '#3182f6',
  },
  cellDay: {
    color: '#333d4b',
    fontSize: 13,
    fontWeight: '700',
  },
  cellDayToday: {
    color: '#3182f6',
    fontWeight: '900',
  },
  cellDaySelected: {
    color: '#ffffff',
    fontWeight: '900',
  },
  cellDayFuture: {
    color: '#d1d6db',
  },
  cellKcal: {
    color: '#3182f6',
    fontSize: 10,
    fontWeight: '800',
  },
  cellKcalOver: {
    color: '#e5484d',
  },
  cellKcalSelected: {
    color: '#ffffff',
  },
  cellEmptyDot: {
    color: '#d1d6db',
    fontSize: 10,
    fontWeight: '800',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingTop: 8,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  legendDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  legendText: {
    color: '#8b95a1',
    fontSize: 11,
    fontWeight: '700',
  },
  legendMuted: {
    color: '#8b95a1',
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
});
