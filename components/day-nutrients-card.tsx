import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

import { MedicalDisclaimer } from '@/components/medical-disclaimer';
import { DayNutrientAxis, DayNutrients } from '@/services/health-api';

// 오늘 먹은 음식의 질환 축 누적 (서버 DATA_MODEL.md 28장).
//
// **경고가 "먹기 직전 1회 알림"에서 "하루를 관리하는 숫자"로 넘어오는 지점**이다. 기록 확정
// 화면의 경고는 저장하면 사라져서, 만성질환자가 "오늘 나트륨 얼마나 먹었지"를 볼 곳이 없었다.
//
// 그리는 규칙 두 가지 — 둘 다 근거에서 온 것이라 임의로 바꾸면 안 된다.
// 1. **게이지는 상한(limit_mg)이 있을 때만.** 칼륨·인은 지침이 혈청 수치 기반 개인화라
//    하루 상한이 없다(KDOQI 2020). 참고치(reference_mg)를 게이지로 그리면 없는 기준을
//    만들어내는 셈이다 — 참고치는 문장으로만 적는다.
// 2. **못 센 항목 수를 밝힌다.** 실측이 없는 음식은 합계에서 빠져 실제보다 적게 보인다.
//    이걸 감추면 커버리지 구멍이 "적게 먹었다"로 읽힌다.
export function DayNutrientsCard({ nutrients }: { nutrients: DayNutrients | null }) {
  if (nutrients === null) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <MaterialIcons color="#3182f6" name="monitor-heart" size={18} />
        <Text style={styles.title}>오늘의 영양</Text>
      </View>

      {nutrients.axes.map((axis) => (
        <AxisRow key={axis.nutrient} axis={axis} totalItems={nutrients.total_items} />
      ))}

      <Text style={styles.notice}>{nutrients.notice}</Text>
      <MedicalDisclaimer />
    </View>
  );
}

function AxisRow({ axis, totalItems }: { axis: DayNutrientAxis; totalItems: number }) {
  const consumed = Math.round(axis.consumed_mg);
  const ratio = axis.limit_mg !== null && axis.limit_mg > 0 ? consumed / axis.limit_mg : null;
  // 기록은 있는데 실측을 못 찾은 음식이 있으면 합계가 과소평가다.
  const missingItems = Math.max(0, totalItems - axis.measured_items);

  return (
    <View style={styles.axis}>
      <View style={styles.axisHead}>
        <Text style={styles.axisLabel}>{axis.label}</Text>
        <Text style={[styles.axisValue, ratio !== null && ratioTextStyle(ratio)]}>
          {axis.limit_mg !== null
            ? `${consumed.toLocaleString()} / ${axis.limit_mg.toLocaleString()} mg`
            : `${consumed.toLocaleString()} mg`}
        </Text>
      </View>

      {ratio !== null ? (
        <View style={styles.track}>
          {/* 100%를 넘어도 막대는 100%에서 멈춘다 — 넘친 사실은 색과 숫자가 말한다. */}
          <View style={[styles.fill, ratioFillStyle(ratio), { width: `${Math.min(100, ratio * 100)}%` }]} />
        </View>
      ) : null}

      {axis.basis !== null ? <Text style={styles.basis}>{axis.basis}</Text> : null}

      {missingItems > 0 ? (
        <Text style={styles.coverage}>
          {`기록 ${totalItems}개 중 ${axis.measured_items}개 음식의 실측만 반영됐어요. 실제 섭취량은 이보다 많을 수 있어요.`}
        </Text>
      ) : null}
    </View>
  );
}

// 상한을 넘었으면 붉게, 가까우면(80%) 주황, 그 외는 파랑. 칩 팔레트(nutrient-chips)와 같은 색이다.
function ratioTextStyle(ratio: number) {
  if (ratio >= 1) {
    return styles.valueOver;
  }

  return ratio >= 0.8 ? styles.valueNear : undefined;
}

function ratioFillStyle(ratio: number) {
  if (ratio >= 1) {
    return styles.fillOver;
  }

  return ratio >= 0.8 ? styles.fillNear : undefined;
}

const styles = StyleSheet.create({
  axis: {
    gap: 6,
  },
  axisHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    color: '#4e5968',
    fontSize: 14,
    fontWeight: '800',
  },
  axisValue: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  basis: {
    color: '#8b95a1',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 16,
    padding: 18,
  },
  coverage: {
    color: '#b8770c',
    fontSize: 12,
    lineHeight: 17,
  },
  fill: {
    backgroundColor: '#3182f6',
    borderRadius: 4,
    height: '100%',
  },
  fillNear: {
    backgroundColor: '#b8770c',
  },
  fillOver: {
    backgroundColor: '#d4571a',
  },
  headRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  notice: {
    color: '#8b95a1',
    fontSize: 11,
    lineHeight: 16,
  },
  title: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  track: {
    backgroundColor: '#f2f4f6',
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
  valueNear: {
    color: '#b8770c',
  },
  valueOver: {
    color: '#d4571a',
  },
});
