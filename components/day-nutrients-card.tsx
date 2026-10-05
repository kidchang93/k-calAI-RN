import { StyleSheet, Text, View } from 'react-native';

import { MedicalDisclaimer } from '@/components/medical-disclaimer';
import { DISPLAY_FONT } from '@/constants/typography';
import { DayNutrientAxis, DayNutrients } from '@/services/health-api';

// 오늘 먹은 음식의 질환 축 누적 (서버 DATA_MODEL.md 28장).
//
// **경고가 "먹기 직전 1회 알림"에서 "하루를 관리하는 숫자"로 넘어오는 지점**이다. 기록 확정
// 화면의 경고는 저장하면 사라져서, 만성질환자가 "오늘 나트륨 얼마나 먹었지"를 볼 곳이 없었다.
//
// 그리는 규칙 두 가지 — 둘 다 근거에서 온 것이라 임의로 바꾸면 안 된다.
// 1. **채워지는 그릇(항아리)은 상한(limit_mg)이 있을 때만.** 칼륨·인은 지침이 혈청 수치 기반
//    개인화라 하루 상한이 없다(KDOQI 2020). 참고치(reference_mg)를 그릇으로 그리면 없는 기준을
//    만들어내는 셈이다 — 그 축은 숫자와 근거 문장으로만 둔다.
// 2. **못 센 항목 수를 밝힌다.** 실측이 없는 음식은 합계에서 빠져 실제보다 적게 보인다.
//    이걸 감추면 커버리지 구멍이 "적게 먹었다"로 읽힌다.
// title 은 과거 날짜에서 재사용하기 위해 열어 둔다 — 지난 기록을 보면서 "오늘의 영양"이라고
// 적혀 있으면 그 숫자가 언제 것인지 알 수 없다 (2026-08-03, `CARE_LOOP.md` §0-3).
//
// 2026-10-05: 게이지 막대 → **소금 항아리**. 식단 탭이 게임처럼 읽히도록 상한이 있는 축을 그릇이
// 차오르는 모양으로 바꿨다. 규칙 1·2는 그대로다.
export function DayNutrientsCard({
  nutrients,
  title = '오늘의 영양',
}: {
  nutrients: DayNutrients | null;
  title?: string;
}) {
  if (nutrients === null) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      {nutrients.axes.map((axis) =>
        axis.limit_mg !== null && axis.limit_mg > 0 ? (
          <JarRow key={axis.nutrient} axis={axis} limit={axis.limit_mg} totalItems={nutrients.total_items} />
        ) : (
          <PlainRow key={axis.nutrient} axis={axis} totalItems={nutrients.total_items} />
        ),
      )}

      <Text style={styles.notice}>{nutrients.notice}</Text>
      <MedicalDisclaimer />
    </View>
  );
}

function JarRow({ axis, limit, totalItems }: { axis: DayNutrientAxis; limit: number; totalItems: number }) {
  const consumed = Math.round(axis.consumed_mg);
  const ratio = consumed / limit;
  const left = limit - consumed;

  return (
    <View style={styles.axis}>
      <View style={styles.jarRow}>
        <View accessible={false} style={styles.jar}>
          <View style={styles.jarLid} />
          <View style={styles.jarBody}>
            {/* 상한을 넘어도 항아리는 가득 찬 데서 멈춘다 — 넘친 사실은 색과 문장이 말한다. */}
            <View style={[styles.jarFill, ratioFillStyle(ratio), { height: `${Math.min(100, ratio * 100)}%` }]} />
          </View>
        </View>
        <View style={styles.jarText}>
          <Text style={styles.jarLabel}>{`${axis.label} 항아리`}</Text>
          <Text style={styles.jarValue}>
            {consumed.toLocaleString()}
            <Text style={styles.jarLimit}>{` / ${limit.toLocaleString()} mg`}</Text>
          </Text>
          <Text style={[styles.jarLeft, ratioTextStyle(ratio)]}>
            {left >= 0
              ? `상한까지 ${left.toLocaleString()} mg 남았어요`
              : `상한보다 ${(-left).toLocaleString()} mg 많아요`}
          </Text>
        </View>
      </View>
      <AxisFootnotes axis={axis} totalItems={totalItems} />
    </View>
  );
}

function PlainRow({ axis, totalItems }: { axis: DayNutrientAxis; totalItems: number }) {
  return (
    <View style={styles.axis}>
      <View style={styles.plainHead}>
        <Text style={styles.plainLabel}>{axis.label}</Text>
        <Text style={styles.plainValue}>{`${Math.round(axis.consumed_mg).toLocaleString()} mg`}</Text>
      </View>
      <AxisFootnotes axis={axis} totalItems={totalItems} />
    </View>
  );
}

function AxisFootnotes({ axis, totalItems }: { axis: DayNutrientAxis; totalItems: number }) {
  // 기록은 있는데 실측을 못 찾은 음식이 있으면 합계가 과소평가다.
  const missingItems = Math.max(0, totalItems - axis.measured_items);

  return (
    <>
      {axis.basis !== null ? <Text style={styles.basis}>{axis.basis}</Text> : null}
      {missingItems > 0 ? (
        <Text style={styles.coverage}>
          {`기록 ${totalItems}개 중 ${axis.measured_items}개 음식의 실측만 반영됐어요. 실제 섭취량은 이보다 많을 수 있어요.`}
        </Text>
      ) : null}
    </>
  );
}

// 상한을 넘었으면 코랄, 가까우면(80%) 살구, 그 외는 민트. 칩 팔레트(nutrient-chips)와 같은 색이다.
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
  basis: {
    color: '#5c5b57',
    fontSize: 12,
    lineHeight: 17,
  },
  card: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 14,
    padding: 16,
  },
  coverage: {
    color: '#a4603f',
    fontSize: 12,
    lineHeight: 17,
  },
  fillNear: {
    backgroundColor: '#ed9c89',
  },
  fillOver: {
    backgroundColor: '#ea8989',
  },
  jar: {
    alignItems: 'center',
    width: 56,
  },
  jarBody: {
    backgroundColor: '#f7f6f4',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderColor: '#5c5b57',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 3,
    height: 62,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 56,
  },
  jarFill: {
    backgroundColor: '#60beb8',
    width: '100%',
  },
  jarLabel: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 18,
  },
  jarLeft: {
    color: '#5c5b57',
    fontSize: 14,
    fontWeight: '700',
  },
  jarLid: {
    backgroundColor: '#5c5b57',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    height: 9,
    width: 36,
  },
  jarLimit: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '700',
  },
  jarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  jarText: {
    flex: 1,
    gap: 2,
  },
  jarValue: {
    color: '#22211f',
    fontSize: 19,
    fontWeight: '900',
  },
  notice: {
    color: '#5c5b57',
    fontSize: 11,
    lineHeight: 16,
  },
  plainHead: {
    alignItems: 'baseline',
    borderTopColor: '#e4e2de',
    borderTopWidth: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  plainLabel: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  plainValue: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '900',
  },
  title: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
  },
  valueNear: {
    color: '#a4603f',
  },
  valueOver: {
    color: '#b8524e',
  },
});
