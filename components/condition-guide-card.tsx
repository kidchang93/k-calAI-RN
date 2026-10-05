import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DISPLAY_FONT } from '@/constants/typography';
import { GuideSummary } from '@/services/guide-api';

// 내 질환의 식이 가이드 진입점 — **내 질환 도감** (서버 `docs/CARE_LOOP.md` §5-2).
//
// **수치 바로 아래**에 두는 것이 핵심이다. 수치를 본 직후가 "이게 무슨 뜻이지"가 이어지는 순간이라,
// 그 자리를 놓치면 가이드는 아무도 찾지 않는 화면이 된다. 실사용에서 "내 질환 정보를 찾아보기 너무
// 힘들다"로 나온 지점이기도 하다 (CARE_LOOP §0-3). 2026-10-05 홈 → 케어 탭(질환 영양 추이 아래)으로
// 옮기며 목록 행을 넘겨 보는 카드로 바꿨다.
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
    <View style={styles.section}>
      <View style={styles.headRow}>
        <Text accessibilityRole="header" style={styles.title}>
          내 질환 도감
        </Text>
        <Text style={styles.meta}>왜 줄이는지, 얼마가 기준인지</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.shelf}
        horizontal
        showsHorizontalScrollIndicator={false}>
        {mine.map((guide) => (
          <Pressable
            key={guide.condition}
            accessibilityLabel={`${guide.label} 식단 가이드, ${guide.axis_count}개 항목`}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/guides/[condition]', params: { condition: guide.condition } })
            }
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.cardIcon}>
              <MaterialIcons color="#1c5a55" name="menu-book" size={20} />
            </View>
            <Text numberOfLines={2} style={styles.cardTitle}>
              {guide.label}
            </Text>
            <Text style={styles.cardMeta}>{`카드 ${guide.axis_count}장`}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 18,
    borderWidth: 2,
    gap: 6,
    minHeight: 132,
    padding: 14,
    width: 148,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: '#bee2dd',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  cardMeta: {
    color: '#1c5a55',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 'auto',
  },
  cardTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 21,
  },
  headRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  meta: {
    color: '#5c5b57',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.74,
  },
  section: {
    gap: 10,
  },
  shelf: {
    gap: 10,
    paddingBottom: 4,
  },
  title: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
  },
});
