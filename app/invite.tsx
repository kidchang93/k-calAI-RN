import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SessionLoading } from '@/components/session-loading';
import { useAuthSession } from '@/services/auth-session';
import { isInviteCode, readInviteCodeParam, rememberPendingInvite } from '@/services/group-invite';

// 초대 링크(`/invite?code=…`)의 착지 화면. **인증 가드 밖**에 두는 것이 이 화면의 존재 이유다 —
// 초대를 받는 사람은 대개 미가입자라, 가드가 걸린 /groups/join 으로 바로 보내면 로그인으로
// 튕기면서 코드가 사라진다. 여기서 코드를 보관해 두고 로그인·온보딩을 마친 뒤 홈에서 이어받는다.
export default function InviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const authState = useAuthSession();

  const code = readInviteCodeParam(params.code);
  const isValid = isInviteCode(code);
  const isAuthenticated = authState.status === 'authenticated';

  useEffect(() => {
    if (!isValid) {
      return;
    }

    if (isAuthenticated) {
      router.replace({ pathname: '/groups/join', params: { code } });

      return;
    }

    if (authState.status === 'unauthenticated') {
      rememberPendingInvite(code);
    }
  }, [authState.status, code, isAuthenticated, isValid, router]);

  // **세션 판단이 끝나기 전에는 어떤 결론도 그리지 않는다.** 특히 오류 화면을 먼저 두면 안 된다 —
  // Expo 웹은 이 라우트를 빌드 시점에 미리 렌더하는데 그때는 `?code=`가 없어 '열 수 없어요'가
  // 정적 HTML 에 박힌다. 번들이 뜨기 전(느린 인앱 브라우저)에 초대받은 사람이 그 화면을 본다.
  if (authState.status === 'loading' || (isValid && isAuthenticated)) {
    return <SessionLoading />;
  }

  if (!isValid) {
    return (
      <InviteFrame
        description="링크가 잘못되었거나 만료되었을 수 있어요. 초대한 분께 링크를 다시 요청해주세요."
        icon="link-off"
        title="초대 링크를 열 수 없어요">
        <Pressable
          onPress={() => router.replace('/groups/join')}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>초대코드 직접 입력하기</Text>
        </Pressable>
      </InviteFrame>
    );
  }

  return (
    <InviteFrame
      description="로그인하면 초대받은 그룹에 바로 참여할 수 있어요. 코드는 저장해 두었어요."
      icon="group-add"
      title="그룹에 초대받았어요">
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>초대코드</Text>
        <Text style={styles.code}>{code}</Text>
      </View>
      <Pressable
        onPress={() => router.replace('/auth')}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>로그인하고 참여하기</Text>
      </Pressable>
    </InviteFrame>
  );
}

type InviteFrameProps = {
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  children: ReactNode;
};

function InviteFrame({ title, description, icon, children }: InviteFrameProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <MaterialIcons color="#3182f6" name={icon} size={48} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  code: {
    color: '#191f28',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
  },
  codeCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e8eb',
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  codeLabel: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  container: {
    alignItems: 'center',
    alignSelf: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    maxWidth: 720,
    padding: 24,
    width: '100%',
  },
  description: {
    color: '#6b7684',
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: '100%',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  title: {
    color: '#191f28',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
});
