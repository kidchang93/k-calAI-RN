import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// 화면 공통 틀: SafeAreaView → ScrollView → 가운데 정렬 컨테이너(최대 720).
// keyboard: 'persistTaps' = 입력 중에도 버튼 탭이 먹는다, 'avoid' = 여기에 iOS 키보드 회피를 더한다.
// contentStyle 은 ScrollView 내용(padding 20)에 덧씌운다.
// footer 는 스크롤 밖 **아래 고정** 영역이다(2026-10-05 상세 화면 — 그 화면의 할 일 버튼 하나).
// 키보드 회피 안에 함께 두어 입력 중에도 버튼이 키보드 위에 남는다.
export function Screen({
  children,
  keyboard,
  gap = 20,
  contentStyle,
  footer,
}: {
  children: ReactNode;
  keyboard?: 'persistTaps' | 'avoid';
  gap?: number;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}) {
  const body = (
    <>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentStyle]}
        keyboardShouldPersistTaps={keyboard === undefined ? undefined : 'handled'}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.container, { gap }]}>{children}</View>
      </ScrollView>
      {footer ? (
        <View style={styles.footer}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {keyboard === 'avoid' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    maxWidth: 720,
    width: '100%',
  },
  footer: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e4e2de',
    borderTopWidth: 2,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  footerInner: {
    alignSelf: 'center',
    gap: 8,
    maxWidth: 720,
    width: '100%',
  },
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: '#f7f6f4',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
});
