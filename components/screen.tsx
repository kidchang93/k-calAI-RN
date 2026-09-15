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
export function Screen({
  children,
  keyboard,
  gap = 20,
  contentStyle,
}: {
  children: ReactNode;
  keyboard?: 'persistTaps' | 'avoid';
  gap?: number;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const scroll = (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps={keyboard === undefined ? undefined : 'handled'}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.container, { gap }]}>{children}</View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {keyboard === 'avoid' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          {scroll}
        </KeyboardAvoidingView>
      ) : (
        scroll
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
