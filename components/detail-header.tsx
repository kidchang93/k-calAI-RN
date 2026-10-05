import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TAB_TONES, TabTone } from '@/constants/tab-tone';
import { DISPLAY_FONT } from '@/constants/typography';

// 상세 화면의 머리 (2026-10-05 상세 화면 기획 — 캔버스 '상세 화면' 페이지).
// 뒤로가기는 **돌아갈 탭 이름**을 말한다('← 식단'). 같은 화면이 두 탭에서 열리면(그날의 식탁 —
// 식단의 채운 칸 / 케어의 도장판) 들어온 쪽의 tone 을 넘긴다. 스택이 없으면(딥링크) 그 탭으로 보낸다.
export function DetailHeader({
  tone,
  title,
  caption,
}: {
  tone: TabTone;
  title: string;
  caption?: string | null;
}) {
  const router = useRouter();
  const toneStyle = TAB_TONES[tone];

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel={`${toneStyle.label}(으)로 돌아가기`}
        accessibilityRole="button"
        hitSlop={6}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace(toneStyle.href);
          }
        }}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <MaterialIcons color={toneStyle.text} name="chevron-left" size={24} />
        <Text style={[styles.backText, { color: toneStyle.text }]}>{toneStyle.label}</Text>
      </Pressable>
      <View style={styles.titles}>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderBottomWidth: 4,
    borderColor: '#e4e2de',
    borderRadius: 999,
    borderWidth: 2,
    flexDirection: 'row',
    minHeight: 44,
    paddingLeft: 6,
    paddingRight: 16,
  },
  backText: {
    fontFamily: DISPLAY_FONT,
    fontSize: 17,
  },
  caption: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.74,
  },
  title: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 29,
    lineHeight: 36,
  },
  titles: {
    gap: 2,
  },
  wrap: {
    gap: 8,
  },
});
