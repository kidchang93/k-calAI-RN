import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GuideSummary } from '@/services/guide-api';

// 내 질환의 식이 가이드 진입점 (서버 `docs/CARE_LOOP.md` §5-2).
//
// **오늘의 영양 카드 바로 아래**에 두는 것이 핵심이다. 수치를 본 직후가 "이게 무슨 뜻이지"가
// 이어지는 순간이라, 그 자리를 놓치면 가이드는 아무도 찾지 않는 화면이 된다. 실사용에서
// "내 질환 정보를 찾아보기 너무 힘들다"로 나온 지점이기도 하다 (CARE_LOOP §0-3).
//
// 내 질환이 하나도 없으면 **그리지 않는다** — 질환을 등록하지 않은 사용자에게 이 앱의 핵심
// 가치가 보이지 않아도 된다는 방침과 같다(`docs/PRODUCT_STRATEGY.md` §3).
export function ConditionGuideCard({ guides }: { guides: GuideSummary[] }) {
  const router = useRouter();
  const mine = guides.filter((guide) => guide.is_mine);

  if (mine.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <MaterialIcons color="#3182f6" name="menu-book" size={18} />
        <Text style={styles.title}>내 질환 알아보기</Text>
      </View>
      <Text style={styles.subtitle}>왜 줄여야 하는지, 얼마나가 기준인지 근거와 함께 정리했어요.</Text>

      {mine.map((guide) => (
        <Pressable
          key={guide.condition}
          onPress={() =>
            router.push({ pathname: '/guides/[condition]', params: { condition: guide.condition } })
          }
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{`${guide.label} 식단 가이드`}</Text>
            <Text style={styles.rowMeta}>{`${guide.axis_count}개 항목`}</Text>
          </View>
          <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 18,
  },
  headRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  pressed: {
    opacity: 0.74,
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowMeta: {
    color: '#8b95a1',
    fontSize: 12,
  },
  rowTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 2,
  },
  title: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
});
