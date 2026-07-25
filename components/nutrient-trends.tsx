import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

import { NutrientTrendAxis, NutrientTrends as NutrientTrendsData } from '@/services/health-api';

// 질환 축 기간 추이. 리포트가 kcal 만 보여주면 정작 이 앱의 대상 사용자에게 중요한 숫자가
// 어디에도 없다 — 만성질환 관리에서 하루는 흔들리고 **추세가 말을 한다**.
// 판정·기준은 전부 서버가 한다 (kcalAI-model/docs/DATA_MODEL.md 28장). 앱은 그리기만 한다.

const BAR_HEIGHT = 56;

export function NutrientTrends({ trends }: { trends: NutrientTrendsData | null }) {
  if (trends === null || trends.axes.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>질환 영양 추이</Text>

      {trends.axes.map((axis) => (
        <AxisCard key={axis.nutrient} axis={axis} />
      ))}

      <Text style={styles.notice}>{trends.notice}</Text>
    </View>
  );
}

function AxisCard({ axis }: { axis: NutrientTrendAxis }) {
  // 막대 높이 기준. 상한이 있으면 상한선이 보이도록 그것도 후보에 넣는다.
  const peak = Math.max(
    ...axis.days.map((day) => day.consumed_mg),
    axis.limit_mg ?? 0,
    1,
  );

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.axisLabel}>{axis.label}</Text>
        {axis.average_mg !== null ? (
          <Text style={styles.average}>
            {`기록일 평균 ${Math.round(axis.average_mg).toLocaleString()} mg`}
          </Text>
        ) : (
          <Text style={styles.averageEmpty}>기록 없음</Text>
        )}
      </View>

      <View style={styles.chart}>
        {axis.days.map((day) => {
          const ratio = Math.min(1, day.consumed_mg / peak);
          const over = axis.limit_mg !== null && day.consumed_mg > axis.limit_mg;

          return (
            <View key={day.date} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(day.consumed_mg > 0 ? 2 : 0, BAR_HEIGHT * ratio) },
                    over && styles.barOver,
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* 상한이 있는 축(나트륨)만 "며칠 넘었나"를 셀 수 있다. 칼륨·인은 지침이 혈청 수치
          기반 개인화라 상한 자체가 없다 — 여기서 임의 기준을 만들면 처방이 된다. */}
      {axis.limit_mg !== null && axis.days_over_limit !== null ? (
        <View style={styles.summaryRow}>
          <MaterialIcons
            color={axis.days_over_limit > 0 ? '#d4571a' : '#0f8a5f'}
            name={axis.days_over_limit > 0 ? 'info' : 'check-circle'}
            size={16}
          />
          <Text style={styles.summaryText}>
            {axis.recorded_days === 0
              ? '기록한 날이 없어요'
              : `기록한 ${axis.recorded_days}일 중 ${axis.days_over_limit}일이 하루 기준을 넘었어요`}
          </Text>
        </View>
      ) : null}

      {axis.basis ? <Text style={styles.basis}>{axis.basis}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  average: {
    color: '#333d4b',
    fontSize: 14,
    fontWeight: '800',
  },
  averageEmpty: {
    color: '#b0b8c1',
    fontSize: 13,
  },
  axisLabel: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
  },
  bar: {
    backgroundColor: '#3182f6',
    borderRadius: 3,
    width: '100%',
  },
  barColumn: {
    flex: 1,
    paddingHorizontal: 2,
  },
  barOver: {
    backgroundColor: '#e5484d',
  },
  barTrack: {
    height: BAR_HEIGHT,
    justifyContent: 'flex-end',
  },
  basis: {
    color: '#8b95a1',
    fontSize: 12,
    lineHeight: 17,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 16,
  },
  chart: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
  },
  headRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notice: {
    color: '#8b95a1',
    fontSize: 12,
    lineHeight: 17,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: '#191f28',
    fontSize: 17,
    fontWeight: '900',
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  summaryText: {
    color: '#4e5968',
    fontSize: 13,
  },
});
