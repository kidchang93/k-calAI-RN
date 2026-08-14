import { ActivityIndicator, StyleSheet, View } from 'react-native';

// 세션 복원 중 인증 가드가 로그인 화면으로 깜빡이지 않도록 보여주는 대기 화면.
export function SessionLoading() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color="#2a7d76" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#f7f6f4',
    flex: 1,
    justifyContent: 'center',
  },
});
