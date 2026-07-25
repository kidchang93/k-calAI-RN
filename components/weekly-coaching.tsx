import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

import { Coaching, CoachingTone } from '@/services/coaching-api';

// 주간 조언. 문구·판정은 전부 서버가 규칙으로 만든다 — 앱은 톤에 맞춰 그리기만 한다
// (kcalAI-model/docs/ACTIVITY_GUIDANCE.md 3-5).
const TONE_ICONS: Record<CoachingTone, { name: 'check-circle' | 'lightbulb-outline' | 'info'; color: string }> = {
  good: { name: 'check-circle', color: '#0f8a5f' },
  tip: { name: 'lightbulb-outline', color: '#3182f6' },
  // 주의도 붉은 경고색을 쓰지 않는다 — 사실 안내이지 경고가 아니다.
  caution: { name: 'info', color: '#d4571a' },
};

export function WeeklyCoaching({
  coaching,
  // 같은 화면에 이미 떠 있는 고지 문구. 코칭 고지와 **글자가 같으면** 반복하지 않는다 —
  // 내 정보 탭에서는 바로 위 '주당 권장 운동량'이 같은 문장을 내려주기 때문이다(2026-07-25).
  // 앱은 문구를 판단하지 않고 비교만 한다: 서버가 문장을 바꾸면 자동으로 다시 보인다.
  shownNotice = null,
}: {
  coaching: Coaching | null;
  shownNotice?: string | null;
}) {
  if (coaching === null || coaching.items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>이번 주 코칭</Text>
        {coaching.conditions.length > 0 ? (
          <Text style={styles.conditions}>{`${coaching.conditions.join(' · ')} 반영`}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        {coaching.items.map((item) => {
          const icon = TONE_ICONS[item.tone];

          return (
            <View key={item.code} style={styles.item}>
              <MaterialIcons color={icon.color} name={icon.name} size={18} />
              <View style={styles.itemBody}>
                <Text style={styles.message}>{item.message}</Text>
                {/* 근거 수치를 함께 보인다 — 조언만 있으면 판단할 수 없다. */}
                {item.evidence !== null ? (
                  <Text style={styles.evidence}>{item.evidence}</Text>
                ) : null}
              </View>
            </View>
          );
        })}

        {/* 고지 문구는 서버 문자열을 그대로 쓴다 — 앱 하드코딩 금지. */}
        {coaching.notice === shownNotice ? null : (
          <Text style={styles.notice}>{coaching.notice}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 16,
  },
  conditions: {
    color: '#8b95a1',
    fontSize: 12,
    fontWeight: '700',
  },
  evidence: {
    color: '#8b95a1',
    fontSize: 12,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  item: {
    flexDirection: 'row',
    gap: 8,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  message: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  notice: {
    borderTopColor: '#f2f4f6',
    borderTopWidth: 1,
    color: '#8b95a1',
    fontSize: 12,
    lineHeight: 18,
    paddingTop: 10,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '800',
  },
});
