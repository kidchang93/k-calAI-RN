import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

// 끼니별(아침·점심·저녁·간식) 합계 카드. 기록이 없으면 빈 상태 문구를 보여준다.
export function MealTypeCard({
  icon,
  label,
  kcal,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  kcal: number;
}) {
  const isEmpty = kcal <= 0;

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <MaterialIcons color="#3182f6" name={icon} size={20} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text style={isEmpty ? styles.empty : styles.kcal}>
          {isEmpty ? '기록 없음' : `${kcal.toLocaleString()} kcal`}
        </Text>
      </View>
    </View>
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
});
