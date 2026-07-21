import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileResponse } from '@/services/health-api';

// BMI와 주당 권장 활동량. 판정·문구는 전부 서버가 준 값을 그대로 그린다 —
// 앱에서 다시 계산하지 않는다 (kcalAI-model/docs/ACTIVITY_GUIDANCE.md 3-1).
//
// 색은 '비만'을 붉게 칠하지 않는다. 낙인이 되고, 우리가 진단하는 것이 아니다.
// 정상만 초록으로 두고 나머지는 전부 중립색으로 담담하게 보여준다.

export function BodyMetrics({ profile }: { profile: ProfileResponse | null }) {
  const router = useRouter();

  if (profile === null) {
    return null;
  }

  const { bmi, bmi_category, bmi_category_label, bmi_notice, activity_guide } = profile;

  // 서버가 파생 지표를 안 준 경우(구버전 서버)엔 섹션 자체를 그리지 않는다.
  if (bmi === null && activity_guide === null) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>내 몸 지표</Text>

      {bmi !== null ? (
        <View style={styles.card}>
          <View style={styles.bmiRow}>
            <View style={styles.bmiValueBox}>
              <Text style={styles.bmiValue}>{bmi.toFixed(1)}</Text>
              <Text style={styles.bmiUnit}>BMI</Text>
            </View>
            {bmi_category_label !== null ? (
              <View
                style={[
                  styles.categoryChip,
                  bmi_category === 'normal' && styles.categoryChipNormal,
                ]}>
                <Text
                  style={[
                    styles.categoryText,
                    bmi_category === 'normal' && styles.categoryTextNormal,
                  ]}>
                  {bmi_category_label}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.bmiBasis}>
            {`키 ${profile.height_cm}cm · 몸무게 ${profile.weight_kg}kg 기준`}
          </Text>
          {/* 한계 고지는 서버 문구를 그대로 쓴다 — 앱 하드코딩 금지 (추천 disclaimer 선례). */}
          {bmi_notice !== null ? <Text style={styles.notice}>{bmi_notice}</Text> : null}
        </View>
      ) : null}

      {activity_guide !== null ? (
        <View style={styles.card}>
          <View style={styles.guideHeader}>
            <MaterialIcons color="#3182f6" name="directions-run" size={18} />
            <Text style={styles.guideTitle}>주당 권장 운동량</Text>
          </View>

          <View style={styles.guideRows}>
            <GuideRow
              label="유산소(중강도)"
              value={`${activity_guide.moderate_min_minutes}~${activity_guide.moderate_max_minutes}분`}
            />
            <GuideRow
              label="유산소(고강도)"
              value={`${activity_guide.vigorous_min_minutes}~${activity_guide.vigorous_max_minutes}분`}
            />
            <GuideRow label="근력운동" value={`주 ${activity_guide.strength_days}일 이상`} />
            {/* 평형성은 65세 이상에만 있는 축이다 — 성인에게는 줄 자체를 그리지 않는다. */}
            {activity_guide.balance_days !== null ? (
              <GuideRow label="평형성 운동" value={`주 ${activity_guide.balance_days}일 이상`} />
            ) : null}
          </View>

          {activity_guide.tips.map((tip) => (
            <Text key={tip} style={styles.tip}>{`• ${tip}`}</Text>
          ))}

          <Text style={styles.source}>{activity_guide.source}</Text>
          <Text style={styles.notice}>{activity_guide.notice}</Text>

          {/* 권고만 보여주고 끝내지 않는다 — 바로 기록하러 갈 수 있게 잇는다. */}
          <Pressable
            onPress={() => router.push('/exercises')}
            style={({ pressed }) => [styles.recordButton, pressed && styles.pressed]}>
            <MaterialIcons color="#3182f6" name="add" size={18} />
            <Text style={styles.recordButtonText}>운동 기록하기</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function GuideRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.guideRow}>
      <Text style={styles.guideLabel}>{label}</Text>
      <Text style={styles.guideValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bmiBasis: {
    color: '#8b95a1',
    fontSize: 12,
  },
  bmiRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  bmiUnit: {
    color: '#8b95a1',
    fontSize: 13,
    fontWeight: '700',
  },
  bmiValue: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
  bmiValueBox: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    padding: 16,
  },
  categoryChip: {
    backgroundColor: '#f2f4f6',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryChipNormal: {
    backgroundColor: '#e9f8f0',
  },
  categoryText: {
    color: '#4e5968',
    fontSize: 13,
    fontWeight: '800',
  },
  categoryTextNormal: {
    color: '#0f8a5f',
  },
  guideHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  guideLabel: {
    color: '#6b7684',
    fontSize: 14,
  },
  guideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  guideRows: {
    gap: 6,
    paddingVertical: 2,
  },
  guideTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
  },
  guideValue: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '800',
  },
  notice: {
    color: '#8b95a1',
    fontSize: 12,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.74,
  },
  recordButton: {
    alignItems: 'center',
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    marginTop: 2,
    paddingVertical: 12,
  },
  recordButtonText: {
    color: '#3182f6',
    fontSize: 14,
    fontWeight: '800',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '800',
  },
  source: {
    color: '#8b95a1',
    fontSize: 12,
  },
  tip: {
    color: '#4e5968',
    fontSize: 13,
    lineHeight: 19,
  },
});
