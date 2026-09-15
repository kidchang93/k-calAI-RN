import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// 화면 본문을 불러오는 동안의 흰 카드(스피너 + 문구).
export function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color="#2a7d76" />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stateBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 32,
  },
  stateText: {
    color: '#5c5b57',
    fontSize: 14,
    textAlign: 'center',
  },
});
