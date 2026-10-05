import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DISPLAY_FONT } from '@/constants/typography';
import { TrendDay } from '@/services/health-api';

// 케어 탭의 **도장판** (2026-10-05, 옛 kcal 캘린더).
//
// 도장은 **잘 먹어서가 아니라 남겨서** 받는다. 예전 칸에는 kcal 과 '목표 위' 코랄이 찍혀 기록이
// 성적표처럼 읽혔다 — 챌린지를 숨긴 이유(KCAL-18)와 같다. 이제 칸은 '남겼는가'만 말하고, 무엇을
// 얼마나 먹었는지는 날짜를 눌러 본다. 기록 없는 날은 빈 칸일 뿐 벌이 아니다(점선, 코랄 아님).

// 달력 한 칸. days 에 없는 날(범위 밖·다음달)은 null 로 채워 7열 그리드를 맞춘다.
type Cell = { date: string; day: number; hasMeal: boolean } | null;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function StampCalendar({
  month,
  days,
  selectedDate,
  todayDate,
  onSelectDate,
  onChangeMonth,
  canGoNext,
}: {
  // 표시할 달의 1일 (로컬 기준).
  month: Date;
  days: TrendDay[];
  selectedDate: string | null;
  todayDate: string;
  onSelectDate: (date: string) => void;
  onChangeMonth: (delta: number) => void;
  // 다음 달로 못 넘어가게 막는다 (미래엔 기록이 없다).
  canGoNext: boolean;
}) {
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
    // meal_count 로 판단한다 — 0kcal 기록(물·차)도 '남긴 날'이다.
    cells.push({ date, day, hasMeal: (byDate.get(date)?.meal_count ?? 0) > 0 });
  }
  // 마지막 주를 7칸으로 맞춘다.
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  // 지난 날(오늘 포함)만 센다 — 아직 오지 않은 날을 분모에 넣으면 이번 달이 늘 비어 보인다.
  const elapsed = cells.filter((cell) => cell !== null && cell.date <= todayDate);
  const stamped = elapsed.filter((cell) => cell?.hasMeal).length;

  return (
    <View style={styles.card}>
      <View style={styles.monthRow}>
        <Pressable
          accessibilityLabel="이전 달"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => onChangeMonth(-1)}
          style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
          <MaterialIcons color="#5c5b57" name="chevron-left" size={24} />
        </Pressable>
        <View style={styles.monthTitles}>
          <Text style={styles.monthTitle}>{`${monthIndex + 1}월 도장판`}</Text>
          <Text style={styles.monthCount}>{`${stamped} / ${elapsed.length}일 남김`}</Text>
        </View>
        <Pressable
          accessibilityLabel="다음 달"
          accessibilityRole="button"
          disabled={!canGoNext}
          hitSlop={10}
          onPress={() => onChangeMonth(1)}
          style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
          <MaterialIcons color={canGoNext ? '#5c5b57' : '#e4e2de'} name="chevron-right" size={24} />
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

            return (
              <Pressable
                key={cell.date}
                accessibilityLabel={`${cell.day}일 ${cell.hasMeal ? '남김' : isFuture ? '' : '기록 없음'}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: isFuture }}
                disabled={isFuture}
                onPress={() => onSelectDate(cell.date)}
                style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
                <View style={[styles.ring, isSelected && styles.ringSelected]}>
                  <View
                    style={[
                      styles.stamp,
                      cell.hasMeal
                        ? styles.stampDone
                        : isFuture
                          ? styles.stampFuture
                          : styles.stampEmpty,
                      isToday && styles.stampToday,
                    ]}>
                    <Text
                      style={[
                        styles.stampDay,
                        cell.hasMeal && styles.stampDayDone,
                        isFuture && styles.stampDayFuture,
                      ]}>
                      {cell.day}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.stampDone]} />
          <Text style={styles.legendText}>남긴 날</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.stampEmpty]} />
          <Text style={styles.legendText}>빈 날 — 지금 채워도 돼요</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 4,
    padding: 12,
  },
  cell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 3,
  },
  legendDot: {
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'center',
    paddingTop: 8,
  },
  legendText: {
    color: '#5c5b57',
    fontSize: 13,
    fontWeight: '700',
  },
  monthButton: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  monthCount: {
    color: '#2a7d76',
    fontSize: 14,
    fontWeight: '800',
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  monthTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 21,
  },
  monthTitles: {
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  ring: {
    borderColor: 'transparent',
    borderRadius: 24,
    borderWidth: 2,
    padding: 1,
  },
  ringSelected: {
    borderColor: '#22211f',
  },
  stamp: {
    alignItems: 'center',
    borderRadius: 19,
    borderWidth: 2,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  stampDay: {
    color: '#5c5b57',
    fontSize: 13,
    fontWeight: '800',
  },
  stampDayDone: {
    color: '#ffffff',
  },
  stampDayFuture: {
    color: '#a9a6a1',
    fontWeight: '600',
  },
  stampDone: {
    backgroundColor: '#2a7d76',
    borderColor: '#1c5a55',
  },
  stampEmpty: {
    borderColor: '#a9a6a1',
    borderStyle: 'dashed',
  },
  stampFuture: {
    backgroundColor: '#f7f6f4',
    borderColor: '#f7f6f4',
  },
  stampToday: {
    borderColor: '#c4561b',
    borderStyle: 'solid',
    borderWidth: 3,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    color: '#5c5b57',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingBottom: 2,
  },
});
