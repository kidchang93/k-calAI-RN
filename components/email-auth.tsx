import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { NO_AGREEMENTS, SignupAgreements, SignupConsents } from '@/components/signup-consents';
import {
  checkEmailNickname,
  loginWithEmail,
  requestEmailSignupCode,
  requestPasswordResetCode,
  resetPassword,
  signupWithEmail,
  verifyEmailSignupCode,
} from '@/services/auth-api';
import { setAuthSession } from '@/services/auth-session';

export type EmailAuthMode = 'login' | 'signup' | 'reset';
// 지금 서버에 가 있는 요청. 하나라도 있으면 모든 버튼을 막는다.
type Pending = 'code' | 'verify' | 'nickname' | 'submit';

// 서버(auth_service)와 같은 규칙이다. 화면이 먼저 막아 왕복을 줄일 뿐 최종 판정은 서버가 한다.
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODE_PATTERN = /^\d{6}$/;
const RESEND_SECONDS = 60;

const MODE_TITLES: Record<EmailAuthMode, string> = {
  login: '이메일로 로그인',
  signup: '이메일로 가입하기',
  reset: '비밀번호 다시 정하기',
};

const MODE_GUIDES: Record<EmailAuthMode, string | null> = {
  login: null,
  signup: '메일로 받은 6자리 코드를 확인하면 다음 칸이 열려요.',
  reset: '가입한 이메일로 인증 코드를 보내드려요.',
};

// 이메일 로그인·가입·비밀번호 재설정. 로그인 화면 첫 칸에 놓인다(아이디·비밀번호 로그인이 첫 화면에 있어야
// 사용자도 심사관도 찾는다). 성공하면 setAuthSession 만 부른다 — 이동은 app/auth.tsx 의 <Redirect> 가 한다.
// 모드는 화면(app/auth.tsx)이 갖는다 — 가입·재설정 중에는 화면이 카카오·Apple 버튼을 숨기므로, 모드를
// 양쪽에 따로 두면 어긋난다. 비밀번호는 이 컴포넌트 상태에만 있고 저장·로그하지 않는다.
export function EmailAuth({
  mode,
  onModeChange,
}: {
  mode: EmailAuthMode;
  onModeChange: (mode: EmailAuthMode) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  // 서버가 '쓸 수 있다'고 답한 닉네임. 칸을 고치면 다시 확인해야 한다.
  const [checkedNickname, setCheckedNickname] = useState<string | null>(null);
  // 중복확인 결과는 닉네임 칸 바로 아래에 보인다 — 폼 맨 아래 오류 상자까지 내려가야 보이면 놓친다.
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [agreements, setAgreements] = useState<SignupAgreements>(NO_AGREEMENTS);
  const [pending, setPending] = useState<Pending | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 재요청 대기는 시각으로 잰다 — 앱이 백그라운드에 있던 동안도 시간이 흐른 것으로 친다.
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (secondsLeft === 0) {
      return;
    }

    const timer = setTimeout(() => setNow(Date.now()), 1000);

    return () => clearTimeout(timer);
  }, [now, secondsLeft]);

  const isBusy = pending !== null;
  const isEmailValid = EMAIL_PATTERN.test(email.trim());
  const isCodeValid = CODE_PATTERN.test(code);
  const isPasswordValid =
    password.length >= 8 && password.length <= 64 && /[A-Za-z]/.test(password) && /\d/.test(password);
  const passwordsMatch = password === passwordConfirm;
  const trimmedNickname = nickname.trim();
  const isNicknameChecked = checkedNickname !== null && checkedNickname === trimmedNickname;
  const isNewPasswordReady = isPasswordValid && passwordsMatch;

  const canSendCode = !isBusy && isEmailValid && secondsLeft === 0;
  const canVerify = !isBusy && isCodeValid && !isCodeVerified;
  const canSubmit =
    !isBusy &&
    (mode === 'login'
      ? isEmailValid && password.length > 0
      : mode === 'signup'
        ? isCodeVerified &&
          isNicknameChecked &&
          isNewPasswordReady &&
          agreements.agreed_terms &&
          agreements.agreed_privacy
        : isCodeSent && isCodeValid && isNewPasswordReady);
  // 가입은 코드를 확인해야, 재설정은 코드를 받아야 비밀번호 칸이 열린다.
  const showPasswordFields = mode === 'signup' ? isCodeVerified : mode === 'reset' && isCodeSent;

  // 서버 호출 공통: 이전 안내·오류를 지우고, 실패하면 서버 문구(한국어 detail)를 그대로 보인다.
  const run = async (kind: Pending, task: () => Promise<void>) => {
    setPending(kind);
    setErrorMessage(null);
    setNotice(null);

    try {
      await task();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setPending(null);
    }
  };

  const clearCode = () => {
    setCode('');
    setIsCodeSent(false);
    setIsCodeVerified(false);
  };

  // 코드는 그 주소로 나간 것이다. 주소를 바꾸면 받은 코드·확인 상태를 버리고 처음부터 다시 받는다.
  // 재요청 1분 제한도 서버가 주소마다 거는 것이라 새 주소는 바로 받을 수 있다.
  const changeEmail = (value: string) => {
    setEmail(value);

    if (isCodeSent) {
      clearCode();
      setResendAt(0);
    }
  };

  const switchMode = (next: EmailAuthMode, message: string | null = null) => {
    onModeChange(next);
    setPassword('');
    setPasswordConfirm('');
    clearCode();
    setErrorMessage(null);
    setNotice(message);
  };

  const sendCode = () =>
    run('code', async () => {
      const message =
        mode === 'reset' ? await requestPasswordResetCode(email) : await requestEmailSignupCode(email);
      const sentAt = Date.now();

      // 다시 받으면 이전 코드는 서버에서 죽는다 — 확인 상태도 함께 버린다.
      setCode('');
      setIsCodeSent(true);
      setIsCodeVerified(false);
      setNow(sentAt);
      setResendAt(sentAt + RESEND_SECONDS * 1000);
      setNotice(message);
    });

  const changeNickname = (value: string) => {
    setNickname(value);
    setNicknameError(null);
  };

  const checkNickname = async () => {
    setPending('nickname');
    setNicknameError(null);

    try {
      await checkEmailNickname(email, code, trimmedNickname);
      setCheckedNickname(trimmedNickname);
    } catch (error) {
      setNicknameError(error instanceof Error ? error.message : '닉네임을 확인하지 못했어요.');
    } finally {
      setPending(null);
    }
  };

  const verifyCode = () =>
    run('verify', async () => {
      setNotice(await verifyEmailSignupCode(email, code));
      setIsCodeVerified(true);
    });

  const submit = () =>
    run('submit', async () => {
      if (mode === 'login') {
        setAuthSession(await loginWithEmail(email, password));
        return;
      }

      if (mode === 'signup') {
        setAuthSession(
          await signupWithEmail({ email, code, password, nickname: trimmedNickname }, agreements),
        );
        return;
      }

      // 서버가 이 계정의 세션을 모두 끊었다 — 이메일은 채운 채 로그인으로 돌려보낸다.
      switchMode('login', await resetPassword(email, code, password));
    });

  const codeButtonLabel =
    secondsLeft > 0 ? `다시 받기 (${secondsLeft}초)` : isCodeSent ? '인증 코드 다시 받기' : '인증 코드 받기';
  const isNewPasswordMode = mode !== 'login';
  const guide = MODE_GUIDES[mode];

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>{MODE_TITLES[mode]}</Text>
        {guide ? <Text style={styles.guide}>{guide}</Text> : null}
      </View>

      {/* textContentType="username": iOS 가 비밀번호를 저장·자동완성할 때 이 칸을 계정 이름으로 묶는다. */}
      <Field label="이메일">
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={changeEmail}
          placeholder="name@example.com"
          placeholderTextColor="#a9a6a1"
          style={styles.input}
          textContentType="username"
          value={email}
        />
      </Field>

      {mode === 'login' ? (
        <Field label="비밀번호">
          <TextInput
            autoCapitalize="none"
            autoComplete="password"
            autoCorrect={false}
            onChangeText={setPassword}
            onSubmitEditing={canSubmit ? () => void submit() : undefined}
            placeholder="비밀번호"
            placeholderTextColor="#a9a6a1"
            secureTextEntry
            style={styles.input}
            textContentType="password"
            value={password}
          />
        </Field>
      ) : (
        <SecondaryButton
          disabled={!canSendCode}
          label={codeButtonLabel}
          loading={pending === 'code'}
          onPress={() => void sendCode()}
        />
      )}

      {isNewPasswordMode && isCodeSent ? (
        <Field
          action={
            mode === 'signup' ? (
              <SecondaryButton
                disabled={!canVerify}
                label={isCodeVerified ? '확인됨' : '확인'}
                loading={pending === 'verify'}
                onPress={() => void verifyCode()}
              />
            ) : undefined
          }
          hint="메일로 받은 6자리 숫자예요. 10분 안에 입력해주세요."
          label="인증 코드">
          <TextInput
            autoComplete="one-time-code"
            editable={!isCodeVerified}
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
            placeholder="000000"
            placeholderTextColor="#a9a6a1"
            style={styles.input}
            textContentType="oneTimeCode"
            value={code}
          />
        </Field>
      ) : null}

      {mode === 'signup' && showPasswordFields ? (
        <Field
          action={
            <SecondaryButton
              disabled={isBusy || trimmedNickname.length === 0 || isNicknameChecked}
              label={isNicknameChecked ? '확인됨' : '중복확인'}
              loading={pending === 'nickname'}
              onPress={() => void checkNickname()}
            />
          }
          hint={
            nicknameError ??
            (isNicknameChecked
              ? '쓸 수 있는 닉네임이에요.'
              : trimmedNickname.length > 0
                ? '중복확인을 해야 가입할 수 있어요.'
                : '그룹에서 다른 사람에게 보이는 이름이에요. 20자까지 쓸 수 있어요.')
          }
          isHintError={nicknameError !== null}
          label="닉네임">
          <TextInput
            maxLength={20}
            onChangeText={changeNickname}
            placeholder="닉네임"
            placeholderTextColor="#a9a6a1"
            style={styles.input}
            value={nickname}
          />
        </Field>
      ) : null}

      {showPasswordFields ? (
        <>
          <Field
            hint="영문과 숫자를 섞어 8~64자로 정해주세요."
            isHintError={password.length > 0 && !isPasswordValid}
            label={mode === 'reset' ? '새 비밀번호' : '비밀번호'}>
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect={false}
              maxLength={64}
              onChangeText={setPassword}
              placeholder="영문+숫자 8자 이상"
              placeholderTextColor="#a9a6a1"
              secureTextEntry
              style={styles.input}
              textContentType="newPassword"
              value={password}
            />
          </Field>
          <Field
            hint={passwordConfirm.length > 0 && !passwordsMatch ? '비밀번호가 서로 달라요.' : undefined}
            isHintError
            label="비밀번호 확인">
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect={false}
              maxLength={64}
              onChangeText={setPasswordConfirm}
              placeholder="한 번 더 입력"
              placeholderTextColor="#a9a6a1"
              secureTextEntry
              style={styles.input}
              textContentType="newPassword"
              value={passwordConfirm}
            />
          </Field>
        </>
      ) : null}

      {mode === 'signup' && showPasswordFields ? (
        <SignupConsents onChange={setAgreements} value={agreements} />
      ) : null}

      {notice ? (
        <View style={styles.noticeBox}>
          <MaterialIcons color="#2a7d76" name="info-outline" size={20} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorBox}>
          <MaterialIcons color="#b8524e" name="error-outline" size={20} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {mode === 'login' || showPasswordFields ? (
        <PrimaryButton
          disabled={!canSubmit}
          inGroup
          label={mode === 'login' ? '로그인' : mode === 'signup' ? '가입 완료' : '비밀번호 바꾸기'}
          loading={pending === 'submit'}
          onPress={() => void submit()}
        />
      ) : null}

      <View style={styles.links}>
        {mode === 'login' ? (
          <>
            <TextButton disabled={isBusy} label="회원가입" onPress={() => switchMode('signup')} />
            <Text style={styles.linkSeparator}>·</Text>
            <TextButton disabled={isBusy} label="비밀번호 찾기" onPress={() => switchMode('reset')} />
          </>
        ) : (
          <TextButton disabled={isBusy} label="로그인으로 돌아가기" onPress={() => switchMode('login')} />
        )}
      </View>
    </View>
  );
}

function Field({
  label,
  hint,
  isHintError = false,
  action,
  children,
}: {
  label: string;
  hint?: string;
  isHintError?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <View style={styles.inputRow}>{children}</View>
        {action}
      </View>
      {hint ? <Text style={[styles.hint, isHintError && styles.hintError]}>{hint}</Text> : null}
    </View>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        isDisabled && styles.secondaryButtonDisabled,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color="#2a7d76" />
      ) : (
        <Text style={[styles.secondaryButtonText, isDisabled && styles.secondaryButtonTextDisabled]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function TextButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
      <Text style={styles.textButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  heading: {
    gap: 4,
  },
  title: {
    color: '#22211f',
    fontSize: 17,
    fontWeight: '900',
  },
  guide: {
    color: '#5c5b57',
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: '#5c5b57',
    fontSize: 14,
    fontWeight: '700',
  },
  fieldRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 8,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e4e2de',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  input: {
    color: '#22211f',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    paddingVertical: 14,
  },
  hint: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  hintError: {
    color: '#b8524e',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#60beb8',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonDisabled: {
    borderColor: '#e4e2de',
  },
  secondaryButtonText: {
    color: '#2a7d76',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButtonTextDisabled: {
    color: '#a9a6a1',
  },
  noticeBox: {
    alignItems: 'center',
    backgroundColor: '#eef7f5',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  noticeText: {
    color: '#2a7d76',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  errorBox: {
    alignItems: 'center',
    backgroundColor: '#fbeaea',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  errorText: {
    color: '#b8524e',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  links: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  linkSeparator: {
    color: '#a9a6a1',
    fontSize: 14,
  },
  textButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  textButtonLabel: {
    color: '#5c5b57',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.74,
  },
});
