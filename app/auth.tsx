import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SessionLoading } from '@/components/session-loading';
import { AuthMode, requestPhoneCode, verifyPhoneCode } from '@/services/auth-api';
import { setAuthSession, useAuthSession } from '@/services/auth-session';

export default function AuthScreen() {
  const authState = useAuthSession();
  const [mode, setMode] = useState<AuthMode>('login');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [hasRequestedCode, setHasRequestedCode] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 세션 복원 중에는 폼을 그리지 않는다. 복원 후 세션이 있으면 아래에서 탭으로 넘어가는데,
  // 로딩 동안 폼을 보였다가 리다이렉트하면 깜빡임이 생긴다.
  if (authState.status === 'loading') {
    return <SessionLoading />;
  }

  // 인증이 끝나면 세션 스토어가 리렌더를 유발하고, 여기서 탭으로 넘어갑니다.
  // router.replace() 를 쓰지 않는 이유는 app/_layout.tsx 주석 참고.
  if (authState.status === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  const isSignup = mode === 'signup';

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setCode('');
    setDevCode(null);
    setHasRequestedCode(false);
    setMessage(null);
    setErrorMessage(null);
  };

  const requestCode = async () => {
    setIsRequesting(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      const result = await requestPhoneCode(mode, phoneNumber);
      setHasRequestedCode(true);
      setDevCode(result.dev_code ?? null);
      setMessage(result.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '인증번호 요청 중 오류가 발생했습니다.');
    } finally {
      setIsRequesting(false);
    }
  };

  const verifyCode = async () => {
    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const verified = await verifyPhoneCode(mode, phoneNumber, code);
      setAuthSession(verified);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '휴대폰 인증 중 오류가 발생했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.logoMark}>
              <MaterialIcons name="health-and-safety" size={30} color="#ffffff" />
            </View>
            <Text style={styles.kicker}>K-Cal AI</Text>
            <Text style={styles.title}>휴대폰 번호로{"\n"}식단 기록을 시작해요</Text>
            <Text style={styles.description}>
              비밀번호 없이 인증번호만으로 가입하고 로그인합니다.
            </Text>
          </View>

          <View style={styles.segment}>
            <Pressable
              onPress={() => changeMode('login')}
              style={[styles.segmentButton, !isSignup && styles.segmentButtonActive]}>
              <Text style={[styles.segmentText, !isSignup && styles.segmentTextActive]}>로그인</Text>
            </Pressable>
            <Pressable
              onPress={() => changeMode('signup')}
              style={[styles.segmentButton, isSignup && styles.segmentButtonActive]}>
              <Text style={[styles.segmentText, isSignup && styles.segmentTextActive]}>회원가입</Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>휴대폰 번호</Text>
              <TextInput
                keyboardType="phone-pad"
                onChangeText={setPhoneNumber}
                placeholder="01012345678"
                placeholderTextColor="#a0a8b3"
                style={styles.input}
                value={phoneNumber}
              />
            </View>

            <Pressable
              disabled={isRequesting || phoneNumber.trim().length < 8}
              onPress={requestCode}
              style={({ pressed }) => [
                styles.secondaryButton,
                (isRequesting || phoneNumber.trim().length < 8) && styles.buttonDisabled,
                pressed && styles.pressed,
              ]}>
              {isRequesting ? (
                <ActivityIndicator color="#3182f6" />
              ) : (
                <>
                  <MaterialIcons name="sms" size={20} color="#3182f6" />
                  <Text style={styles.secondaryButtonText}>인증번호 받기</Text>
                </>
              )}
            </Pressable>

            {hasRequestedCode ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>인증번호</Text>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={setCode}
                  placeholder="6자리 입력"
                  placeholderTextColor="#a0a8b3"
                  style={styles.input}
                  value={code}
                />
              </View>
            ) : null}

            {message ? <Text style={styles.messageText}>{message}</Text> : null}
            {/* 서버가 dev_code를 주면(AUTH_INCLUDE_DEV_CODE=true) 화면에 표시한다.
                SMS 연동 후 서버에서 false로 바꾸면 dev_code가 null이라 자동으로 숨겨진다. */}
            {devCode ? (
              <Text style={styles.devCodeText}>인증번호: {devCode} (임시 표시 — 문자 발송 연동 전)</Text>
            ) : null}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={20} color="#e5484d" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={isVerifying || !hasRequestedCode || code.trim().length < 4}
              onPress={verifyCode}
              style={({ pressed }) => [
                styles.primaryButton,
                (isVerifying || !hasRequestedCode || code.trim().length < 4) && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}>
              {isVerifying ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <MaterialIcons name="verified-user" size={20} color="#ffffff" />
                  <Text style={styles.primaryButtonText}>{isSignup ? '가입 완료' : '로그인'}</Text>
                </>
              )}
            </Pressable>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    gap: 18,
    justifyContent: 'center',
    padding: 22,
  },
  header: {
    gap: 10,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: '#191f28',
    borderRadius: 8,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  kicker: {
    color: '#3182f6',
    fontSize: 14,
    fontWeight: '900',
  },
  title: {
    color: '#191f28',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 42,
  },
  description: {
    color: '#6b7684',
    fontSize: 15,
    lineHeight: 22,
  },
  segment: {
    backgroundColor: '#e9edf3',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    paddingVertical: 11,
  },
  segmentButtonActive: {
    backgroundColor: '#ffffff',
  },
  segmentText: {
    color: '#6b7684',
    fontSize: 15,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#191f28',
  },
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 14,
    padding: 18,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: '#333d4b',
    fontSize: 14,
    fontWeight: '900',
  },
  input: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    color: '#191f28',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#edf6ff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryButtonText: {
    color: '#3182f6',
    fontSize: 16,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  primaryButtonDisabled: {
    backgroundColor: '#b4c7e7',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
  },
  messageText: {
    color: '#3182f6',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  devCodeText: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  errorBox: {
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  errorText: {
    color: '#e5484d',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
