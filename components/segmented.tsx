import { Pressable, StyleSheet, Text, View } from 'react-native';

// 작은 세그먼트 토글. ChipGroup 은 선택지가 많은 폼(질병·알러지)용이라 세로 공간을 크게
// 먹는다. 리포트 화면처럼 2지선다를 헤더·카드 안에 끼워 넣을 때 이걸 쓴다.
type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  // 카드 안에 들어가는 작은 변형 (기간 토글 등).
  compact?: boolean;
};

export function Segmented<T extends string>({ options, value, onChange, compact }: Props<T>) {
  return (
    <View style={[styles.track, compact && styles.trackCompact]}>
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              compact && styles.segmentCompact,
              isSelected && styles.segmentSelected,
              pressed && !isSelected && styles.pressed,
            ]}>
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                isSelected && styles.labelSelected,
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: '#f2f4f6',
    borderRadius: 999,
    flexDirection: 'row',
    padding: 3,
  },
  trackCompact: {
    padding: 2,
  },
  segment: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  segmentCompact: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  segmentSelected: {
    backgroundColor: '#ffffff',
    // 선택된 칸만 살짝 떠 보이게 (iOS 세그먼트 관례).
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  label: {
    color: '#8b95a1',
    fontSize: 14,
    fontWeight: '800',
  },
  labelCompact: {
    fontSize: 12,
  },
  labelSelected: {
    color: '#191f28',
  },
  pressed: {
    opacity: 0.6,
  },
});
