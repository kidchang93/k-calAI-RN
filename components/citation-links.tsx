import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type CitationLink, openCitation } from '@/services/citations';

// 수치·기준 옆의 '출처'. 누르면 원문이 열린다 (2026-10-20 App Store 1.4.1 반려 — 출처 문장이 있어도
// 링크가 아니면 사용자가 찾을 수 없다). 의료 수치·기준을 새 화면에 그리면 이것도 함께 붙인다.
// showUrl 은 인쇄되는 진료 리포트용이다 — 종이에서는 누를 수 없어 주소를 적는다.
export function CitationLinks({
  citations,
  showUrl = false,
}: {
  citations: CitationLink[];
  showUrl?: boolean;
}) {
  if (citations.length === 0) {
    return null;
  }

  return (
    <View style={styles.box}>
      <Text style={styles.label}>출처</Text>
      {citations.map((citation) => (
        <Pressable
          key={citation.url}
          accessibilityLabel={`${citation.title} 원문 열기`}
          accessibilityRole="link"
          hitSlop={6}
          onPress={() => void openCitation(citation.url)}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>{`${citation.publisher} · ${citation.title}`}</Text>
            <MaterialIcons color="#2a7d76" name="open-in-new" size={13} style={styles.icon} />
          </View>
          {showUrl ? <Text style={styles.url}>{citation.url}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 4,
  },
  icon: {
    marginTop: 2,
  },
  item: {
    gap: 1,
  },
  label: {
    color: '#5c5b57',
    fontSize: 11,
    fontWeight: '700',
  },
  linkRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 4,
  },
  linkText: {
    color: '#2a7d76',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.74,
  },
  url: {
    color: '#5c5b57',
    fontSize: 10,
    lineHeight: 14,
  },
});
