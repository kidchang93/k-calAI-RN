import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { PlanLimitBanner } from '@/components/plan-limit-banner';
import { joinGroup } from '@/services/group-api';
import { readInviteCodeParam } from '@/services/group-invite';
import { PlanLimitError } from '@/services/http';

export default function GroupJoinScreen() {
  const router = useRouter();
  // 초대 링크(`/invite?code=…`)로 들어오면 코드가 채워진 채 시작한다. 참여는 자동으로 하지
  // 않는다 — 잘못 눌러 들어간 그룹을 되돌릴 화면이 없어서, 확인은 사람이 한 번 한다.
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(() => readInviteCodeParam(params.code));
  const isFromInviteLink = readInviteCodeParam(params.code).length > 0;
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 402(그룹 정원 초과). 정원을 산 사람은 그룹 소유자라, 서버 detail이 "소유자가 업그레이드해야
  // 한다"고 알려준다 — 문구를 앱에서 바꾸지 않고 그대로 보여준다.
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);

  // 초대코드는 서버 생성 8자 (대문자·숫자, I/L/O/0/1 제외). 서버가 대문자로 정규화한다.
  const trimmedCode = code.trim();
  const isValid = trimmedCode.length === 8;

  const join = async () => {
    setIsJoining(true);
    setErrorMessage(null);
    setPlanLimitMessage(null);

    try {
      const group = await joinGroup(trimmedCode);

      router.replace({ pathname: '/groups/[id]', params: { id: String(group.id) } });
    } catch (error) {
      if (error instanceof PlanLimitError) {
        setPlanLimitMessage(error.message);
      } else {
        setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.container}>
            <BackButton />

            <View style={styles.header}>
              <Text style={styles.title}>초대코드로 참여</Text>
              <Text style={styles.subtitle}>
                {isFromInviteLink
                  ? '초대 링크의 코드를 채워두었어요. 참여하기를 누르면 그룹에 들어갑니다.'
                  : '그룹 멤버에게 받은 8자리 코드를 입력해주세요.'}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>초대코드</Text>
              <View style={styles.inputRow}>
                <TextInput
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                  onChangeText={setCode}
                  placeholder="A7K2MPQ9"
                  placeholderTextColor="#b0b8c1"
                  style={styles.input}
                  value={code}
                />
              </View>
            </View>

            {errorMessage ? (
              <ErrorBanner message={errorMessage} onRetry={() => void join()} />
            ) : null}

            {planLimitMessage ? (
              <PlanLimitBanner message={planLimitMessage} onUpgrade={() => router.push('/plan')} />
            ) : null}

            <Pressable
              disabled={!isValid || isJoining}
              onPress={() => void join()}
              style={({ pressed }) => [
                styles.primaryButton,
                (!isValid || isJoining) && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}>
              {isJoining ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>참여하기</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  header: {
    gap: 4,
  },
  input: {
    color: '#191f28',
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
    paddingVertical: 14,
  },
  inputGroup: {
    gap: 8,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e8eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  keyboardView: {
    flex: 1,
  },
  label: {
    color: '#4e5968',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: '#b4c7e7',
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
  scrollContent: {
    padding: 20,
  },
  subtitle: {
    color: '#6b7684',
    fontSize: 14,
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
});
