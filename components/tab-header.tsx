import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DISPLAY_FONT } from '@/constants/typography';

// 식단·케어·진료 세 탭의 머리 (2026-10-05 화면 재구성).
// 내 정보는 탭에서 빠져 **오른쪽 위 동그라미**로 들어간다 — 계정·설정은 매일 여는 곳이 아니라
// 탭 한 칸을 차지할 이유가 없다. 탭은 할 일이 있는 곳 셋만 남긴다.
export function TabHeader({ title, caption }: { title: string; caption?: string | null }) {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="내 정보"
        accessibilityRole="button"
        hitSlop={6}
        onPress={() => router.push('/account')}
        style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
        <MaterialIcons color="#22211f" name="person" size={24} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 4,
    borderColor: '#e4e2de',
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  caption: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.74,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  title: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 32,
    lineHeight: 40,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
});
