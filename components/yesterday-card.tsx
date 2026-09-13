import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NutrientTrendAxis, TrendsResponse } from '@/services/health-api';

// 홈 상단의 어제 요약. 기록(②)과 리포트(④) 사이에 비어 있던 **하루**라는 단위를 닫는다
// (서버 `docs/CARE_LOOP.md` §6). 판정이 아니라 사실 서술이다 — "나트륨 2,610 mg · 기준 2,000 mg".
//
// **기록이 없는 날도 그리고 그 사실을 말한다.** 빈 날을 숨기면 기록한 날만 남아 추이가 거짓이 된다.
// 끼니 수(meal_count)로 가르는 이유는 0 kcal 기록(물·차)이 "기록 없음"으로 잘못 읽히지 않게다.
export function YesterdayCard({
  trends,
  onPress,
  onDismiss,
}: {
  trends: TrendsResponse;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const day = trends.days[0];

  if (day === undefined) {
    return null;
  }

  const hasRecord = day.meal_count > 0;

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <MaterialIcons color="#2a7d76" name="history" size={18} />
        <Text style={styles.title}>{`어제 · ${formatMonthDay(day.date)}`}</Text>
        <Pressable
          accessibilityLabel="어제 요약 닫기"
          hitSlop={10}
          onPress={onDismiss}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <MaterialIcons color="#a9a6a1" name="close" size={18} />
        </Pressable>
      </View>

      {hasRecord ? (
        <View style={styles.body}>
          <Text style={styles.kcalLine}>
            {`${day.consumed_kcal.toLocaleString()} kcal`}
            {trends.target_kcal !== null ? (
              <Text style={styles.muted}>{` · 목표 ${trends.target_kcal.toLocaleString()} kcal`}</Text>
            ) : null}
            <Text style={styles.muted}>{` · 끼니 ${day.meal_count}번`}</Text>
          </Text>
          {(trends.nutrients?.axes ?? []).map((axis) => (
            <AxisLine key={axis.nutrient} axis={axis} />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>기록이 없는 날이에요. 지금 남겨도 그날 기록으로 들어가요.</Text>
      )}

      <Pressable onPress={onPress} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
        <Text style={styles.linkText}>{hasRecord ? '어제 기록 보기' : '어제 기록 남기기'}</Text>
        <MaterialIcons color="#2a7d76" name="chevron-right" size={18} />
      </Pressable>
    </View>
  );
}

function AxisLine({ axis }: { axis: NutrientTrendAxis }) {
  const day = axis.days[0];

  if (day === undefined || day.total_items === 0) {
    return null;
  }

  const consumed = Math.round(day.consumed_mg);
  const isAboveLimit = axis.limit_mg !== null && consumed > axis.limit_mg;
  // 실측을 못 찾은 음식은 합계에 없다 — 밝히지 않으면 적게 먹은 날로 읽힌다.
  const missingItems = Math.max(0, day.total_items - day.measured_items);

  return (
    <View style={styles.axis}>
      <Text style={styles.axisLine}>
        <Text style={styles.axisLabel}>{`${axis.label} `}</Text>
        <Text style={[styles.axisValue, isAboveLimit && styles.axisValueAbove]}>
          {`${consumed.toLocaleString()} mg`}
        </Text>
        {axis.limit_mg !== null ? (
          <Text style={styles.muted}>{` · 기준 ${axis.limit_mg.toLocaleString()} mg`}</Text>
        ) : null}
      </Text>
      {missingItems > 0 ? (
        <Text style={styles.coverage}>{`실측이 없는 음식 ${missingItems}개는 합계에서 빠졌어요`}</Text>
      ) : null}
    </View>
  );
}

function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-');

  return `${Number(month)}월 ${Number(day)}일`;
}

const styles = StyleSheet.create({
  axis: {
    gap: 2,
  },
  axisLabel: {
    color: '#5c5b57',
    fontSize: 14,
    fontWeight: '800',
  },
  axisLine: {
    fontSize: 14,
  },
  axisValue: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '900',
  },
  axisValueAbove: {
    color: '#b8524e',
  },
  body: {
    gap: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 18,
  },
  close: {
    marginLeft: 'auto',
  },
  coverage: {
    color: '#a4603f',
    fontSize: 12,
    lineHeight: 17,
  },
  emptyText: {
    color: '#5c5b57',
    fontSize: 14,
    lineHeight: 20,
  },
  headRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  kcalLine: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '900',
  },
  link: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
  },
  linkText: {
    color: '#2a7d76',
    fontSize: 14,
    fontWeight: '800',
  },
  muted: {
    color: '#a9a6a1',
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.74,
  },
  title: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '900',
  },
});
