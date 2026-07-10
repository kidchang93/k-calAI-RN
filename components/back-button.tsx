import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

// 그룹·반려동물처럼 탭 밖 스택 화면의 상단 뒤로가기.
// 네이티브 헤더를 쓰지 않는 화면 관례(headerShown: false)를 유지하면서 되돌아갈 길을 만든다.
export function BackButton() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel="뒤로 가기"
      accessibilityRole="button"
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          // 딥링크 등으로 스택 없이 진입한 경우 홈으로 보낸다.
          router.replace('/home');
        }
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <MaterialIcons color="#4e5968" name="arrow-back" size={22} />
      <Text style={styles.label}>뒤로</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 4,
  },
  label: {
    color: '#4e5968',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.74,
  },
});
