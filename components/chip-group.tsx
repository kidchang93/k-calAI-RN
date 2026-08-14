import { Pressable, StyleSheet, Text, View } from 'react-native';

export type ChipOption = {
  value: string;
  label: string;
};

// 온보딩의 칩 선택기. 단일/복수 선택 규칙은 화면이 selectedValues·onToggle로 결정한다.
export function ChipGroup({
  options,
  selectedValues,
  onToggle,
}: {
  options: ChipOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={option.value}
            onPress={() => onToggle(option.value)}
            style={({ pressed }) => [
              styles.chip,
              isSelected && styles.chipSelected,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: '#ffffff',
    borderColor: '#e4e2de',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: '#bee2dd',
    borderColor: '#2a7d76',
  },
  chipText: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#2a7d76',
  },
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pressed: {
    opacity: 0.74,
  },
});
