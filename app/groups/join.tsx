import { useRouter } from 'expo-router';
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
import { joinGroup } from '@/services/group-api';

export default function GroupJoinScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 초대코드는 서버 생성 8자 (대문자·숫자, I/L/O/0/1 제외). 서버가 대문자로 정규화한다.
  const trimmedCode = code.trim();
  const isValid = trimmedCode.length === 8;

  const join = async () => {
    setIsJoining(true);
    setErrorMessage(null);

    try {
      const group = await joinGroup(trimmedCode);

      router.replace({ pathname: '/groups/[id]', params: { id: String(group.id) } });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
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
              <Text style={styles.subtitle}>그룹 멤버에게 받은 8자리 코드를 입력해주세요.</Text>
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
