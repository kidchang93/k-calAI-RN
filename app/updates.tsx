import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { Screen } from '@/components/screen';
import {
  CHANGE_TYPE_LABELS,
  CHANGELOG,
  ChangelogEntry,
  ChangeType,
} from '@/constants/changelog';
import { formatYearMonthDay } from '@/services/format';

// 변화 유형별 배지 색. new=민트(진한 틴트), improved=민트(옅은 틴트), fixed=중립.
const TYPE_COLORS: Record<ChangeType, { bg: string; fg: string }> = {
  new: { bg: '#bee2dd', fg: '#2a7d76' },
  improved: { bg: '#eef7f5', fg: '#2a7d76' },
  fixed: { bg: '#e4e2de', fg: '#5c5b57' },
};

export default function UpdatesScreen() {
  return (
    <Screen gap={16} contentStyle={styles.content}>
      <BackButton />

      <View style={styles.header}>
        <Text style={styles.title}>업데이트 이력</Text>
        <Text style={styles.subtitle}>케어테이블이 어떻게 좋아지고 있는지 알려드려요.</Text>
      </View>

      <View style={styles.list}>
        {CHANGELOG.map((entry, index) => (
          <UpdateCard
            key={`${entry.date}-${entry.title}`}
            entry={entry}
            isLatest={index === 0}
          />
        ))}
      </View>
    </Screen>
  );
}

function UpdateCard({ entry, isLatest }: { entry: ChangelogEntry; isLatest: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={styles.cardTitle}>{entry.title}</Text>
          <Text style={styles.cardDate}>{formatYearMonthDay(entry.date)}</Text>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 14,
    padding: 18,
  },
  cardDate: {
    color: '#a9a6a1',
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
    color: '#22211f',
    fontSize: 18,
    fontWeight: '900',
  },
  content: {
    paddingBottom: 36,
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
    color: '#5c5b57',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  latestBadge: {
    backgroundColor: '#60beb8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  latestBadgeText: {
    color: '#22211f',
    fontSize: 12,
    fontWeight: '800',
  },
  list: {
    gap: 12,
  },
  subtitle: {
    color: '#5c5b57',
    fontSize: 14,
  },
  title: {
    color: '#22211f',
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
