import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import {
  CHANGE_TYPE_LABELS,
  CHANGELOG,
  ChangelogEntry,
  ChangeType,
} from '@/constants/changelog';

// 변화 유형별 배지 색. new=파랑, improved=초록, fixed=회색.
const TYPE_COLORS: Record<ChangeType, { bg: string; fg: string }> = {
  new: { bg: '#edf6ff', fg: '#3182f6' },
  improved: { bg: '#e6f9f0', fg: '#12b886' },
  fixed: { bg: '#f2f4f6', fg: '#6b7684' },
};

export default function UpdatesScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>업데이트 이력</Text>
            <Text style={styles.subtitle}>kcal이 어떻게 좋아지고 있는지 알려드려요.</Text>
          </View>

          {CHANGELOG.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>아직 안내해드릴 업데이트가 없어요.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {CHANGELOG.map((entry, index) => (
                <UpdateCard
                  key={`${entry.date}-${entry.title}`}
                  entry={entry}
                  isLatest={index === 0}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function UpdateCard({ entry, isLatest }: { entry: ChangelogEntry; isLatest: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={styles.cardTitle}>{entry.title}</Text>
          <Text style={styles.cardDate}>{formatDate(entry.date)}</Text>
        </View>
        {isLatest ? (
          <View style={styles.latestBadge}>
            <Text style={styles.latestBadgeText}>최신</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.items}>
        {entry.items.map((item) => {
          const color = TYPE_COLORS[item.type];

          return (
            <View key={item.text} style={styles.itemRow}>
              <View style={[styles.typeBadge, { backgroundColor: color.bg }]}>
                <Text style={[styles.typeBadgeText, { color: color.fg }]}>
                  {CHANGE_TYPE_LABELS[item.type]}
                </Text>
              </View>
              <Text style={styles.itemText}>{item.text}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// 'YYYY-MM-DD' → '2026년 7월 16일'
function formatDate(date: string): string {
  const [year, month, day] = date.split('-');

  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 14,
    padding: 18,
  },
  cardDate: {
    color: '#8b95a1',
    fontSize: 13,
    fontWeight: '700',
  },
  cardHead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardHeadText: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
  container: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 720,
    width: '100%',
  },
  emptyBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 32,
  },
  emptyText: {
    color: '#8b95a1',
    fontSize: 14,
  },
  header: {
    gap: 4,
  },
  itemRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  items: {
    gap: 12,
  },
  itemText: {
    color: '#4e5968',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  latestBadge: {
    backgroundColor: '#3182f6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  latestBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  list: {
    gap: 12,
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 36,
  },
  subtitle: {
    color: '#6b7684',
    fontSize: 14,
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
  typeBadge: {
    alignItems: 'center',
    borderRadius: 6,
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
