import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// 요금제 한도(402) 안내. 재시도해도 풀리지 않으므로 ErrorBanner의 '다시 시도' 대신
// 요금제 화면으로 보내는 버튼을 둔다. 문구는 서버 detail(한국어)을 그대로 쓴다.
export function PlanLimitBanner({
  message,
  onUpgrade,
}: {
  message: string;
  onUpgrade: () => void;
}) {
  return (
    <View style={styles.limitBox}>
      <MaterialIcons color="#b8524e" name="error-outline" size={20} />
      <View style={styles.limitBody}>
        <Text style={styles.limitText}>{message}</Text>
        <Pressable
          onPress={onUpgrade}
          style={({ pressed }) => [styles.upgradeButton, pressed && styles.pressed]}>
          <Text style={styles.upgradeButtonText}>요금제 업그레이드</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  limitBody: {
    flex: 1,
    gap: 10,
  },
  limitBox: {
    backgroundColor: '#fbeaea',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  limitText: {
    color: '#b8524e',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.74,
  },
  upgradeButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  upgradeButtonText: {
    color: '#b8524e',
    fontSize: 14,
    fontWeight: '700',
  },
});
