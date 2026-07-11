import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// 끼니별(아침·점심·저녁·간식) 합계 카드. 기록이 없으면 빈 상태 문구를 보여준다.
// onPress가 있으면 탭 가능한 행으로 동작한다 (홈 → 해당 날짜 기록 목록 진입).
export function MealTypeCard({
  icon,
  label,
  kcal,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  kcal: number;
  onPress?: () => void;
}) {
  const isEmpty = kcal <= 0;

  return (
    <Pressable
      disabled={onPress === undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && onPress !== undefined && styles.pressed]}>
      <View style={styles.iconWrap}>
        <MaterialIcons color="#3182f6" name={icon} size={20} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text style={isEmpty ? styles.empty : styles.kcal}>
          {isEmpty ? '기록 없음' : `${kcal.toLocaleString()} kcal`}
        </Text>
      </View>
      {onPress !== undefined ? (
        <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 2,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  empty: {
    color: '#8b95a1',
    fontSize: 14,
    fontWeight: '600',
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#edf6ff',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  kcal: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '800',
  },
  label: {
    color: '#4e5968',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.74,
  },
});
