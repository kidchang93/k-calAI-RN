import { StyleSheet, Text, View } from 'react-native';

// 온보딩 상단 진행 표시. current는 1부터 시작하는 현재 단계.
export function OnboardingProgress({ current, total }: { current: number; total: number }) {
  return (
    <View
      accessibilityLabel={`온보딩 진행 ${current} / ${total}`}
      accessibilityRole="progressbar"
      style={styles.container}>
      <View style={styles.track}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={`segment-${index}`}
            style={[styles.segment, index < current && styles.segmentDone]}
          />
        ))}
      </View>
      <Text style={styles.label}>{`${current} / ${total}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    color: '#8b95a1',
    fontSize: 13,
    fontWeight: '700',
  },
  segment: {
    backgroundColor: '#e5e8eb',
    borderRadius: 999,
    flex: 1,
    height: 4,
  },
  segmentDone: {
    backgroundColor: '#3182f6',
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
});
