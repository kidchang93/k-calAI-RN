import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SessionLoading } from '@/components/session-loading';
import {
  consumeKakaoWebRedirect,
  KakaoCancelledError,
  KakaoLinkExpiredError,
  KakaoNotRegisteredError,
  loginWithKakao,
  signupWithKakao,
  startKakaoLogin,
} from '@/services/auth-api';
import { setAuthSession, useAuthSession } from '@/services/auth-session';
import { FALLBACK_PLANS, fetchPlans, Plan } from '@/services/subscription-api';

// 가입 시 기본 선택. 서버도 plan_code 미지정 시 이 무료 플랜을 부여한다.
const DEFAULT_PLAN_CODE = 'lite';

// 연동 코드가 죽었을 때(TTL 10분 초과·1회용 소비) 붙이는 안내. 그 코드로는 더 진행할 수 없고
// 카카오 로그인부터 다시 해야 한다.
const RESTART_GUIDE = '카카오 로그인부터 다시 진행해주세요.';

// 카카오가 알려주므로 로그인·회원가입 탭을 나누지 않는다.
// 'kakao'  = 카카오로 시작하기 버튼만 보이는 상태
// 'signup' = 신규 회원(is_new=true) — 동의 2종 + 요금제를 받는 상태
type AuthStage = 'kakao' | 'signup';

export default function AuthScreen() {
  const authState = useAuthSession();
  const [stage, setStage] = useState<AuthStage>('kakao');
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 가입 전용 상태 — 기존 회원은 화면에 그리지도, 서버로 보내지도 않는다.
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [planCode, setPlanCode] = useState(DEFAULT_PLAN_CODE);

  // 웹은 서버 콜백에서 /auth?code=…로 **전체 페이지 이동**해 돌아온다 (팝업이 아니다 —
  // 이유는 services/auth-api.ts의 startKakaoLogin 주석 참고). 마운트 시 쿼리에서 결과를 읽어
  // 로그인/가입을 잇는다. 네이티브에서는 consumeKakaoWebRedirect()가 항상 null이라 no-op이다.
  //
  // 아래 startKakao와 로직이 겹치지만 그 함수는 조기 반환(로딩·인증됨) 뒤에 정의되므로 여기서
  // 참조할 수 없다. 효과 안에 가둬 둔다.
  useEffect(() => {
    let isActive = true;

    const resume = async () => {
      let started;

      try {
        started = consumeKakaoWebRedirect();
      } catch (error) {
        // 사용자가 카카오 동의 화면에서 취소했다 — 조용히 로그인 화면을 보여준다.
        if (error instanceof KakaoCancelledError) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : '카카오 로그인 중 오류가 발생했습니다.',
        );

        return;
      }

      if (started === null || !isActive) {
        return;
      }

      setIsStarting(true);
      // 연동 코드는 TTL 10분·1회용이다. 가입 단계로 넘어갈 수 있으니 먼저 보관한다.
      setLinkCode(started.link_code);

      try {
        if (started.is_new) {
          setStage('signup');

          return;
        }

        setAuthSession(await loginWithKakao(started.link_code));
      } catch (error) {
        if (error instanceof KakaoNotRegisteredError) {
          setStage('signup');

          return;
        }

        if (error instanceof KakaoLinkExpiredError) {
          setStage('kakao');
          setLinkCode(null);
          setErrorMessage(`${error.message}\n${RESTART_GUIDE}`);

          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : '카카오 로그인 중 오류가 발생했습니다.',
        );
      } finally {
        if (isActive) {
          setIsStarting(false);
        }
      }
    };

    void resume();

    return () => {
      isActive = false;
    };
  }, []);

  // 가입 단계에 들어올 때만 가격표를 읽는다(무인증 GET). 실패해도 번들 폴백으로 그린다 —
  // 네트워크 오류로 가입 자체가 막히면 안 된다 (선택지 데이터 규칙, DESIGN.md).
  useEffect(() => {
    if (stage !== 'signup') {
      return;
    }

    let isActive = true;

    fetchPlans()
      .then((result) => {
        if (isActive && result.length > 0) {
          setPlans(result);
        }
      })
      .catch(() => {
        // 폴백 유지 — 가입 흐름을 막지 않는다.
      });

    return () => {
      isActive = false;
    };
  }, [stage]);

  // 세션 복원 중에는 화면을 그리지 않는다. 복원 후 세션이 있으면 아래에서 탭으로 넘어가는데,
  // 로딩 동안 로그인 화면을 보였다가 리다이렉트하면 깜빡임이 생긴다.
  if (authState.status === 'loading') {
    return <SessionLoading />;
  }

  // 인증이 끝나면 세션 스토어가 리렌더를 유발하고, 여기서 탭으로 넘어갑니다.
  // router.replace() 를 쓰지 않는 이유는 app/_layout.tsx 주석 참고.
  if (authState.status === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  const isSignup = stage === 'signup';
  const hasAgreedAll = agreedTerms && agreedPrivacy;
  // 가입은 필수 동의 2종을 모두 체크해야 완료할 수 있다 (서버도 false면 400으로 막는다).
  const canSignup = !isSigningUp && linkCode !== null && hasAgreedAll;

  const restartFromKakao = (message: string | null) => {
    setStage('kakao');
    setLinkCode(null);
    setAgreedTerms(false);
    setAgreedPrivacy(false);
    setPlanCode(DEFAULT_PLAN_CODE);
    setErrorMessage(message);
  };

  const toggleAgreeAll = () => {
    const next = !hasAgreedAll;

    setAgreedTerms(next);
    setAgreedPrivacy(next);
  };

  // 계정 전환 = 진행 중이던 가입 상태를 버리고, 카카오에 **로그인 화면을 다시 띄우라고** 요청한다.
  // 화면만 되돌리면(restartFromKakao) 카카오 세션이 남아 있어 같은 계정으로 다시 들어간다.
  const switchKakaoAccount = async () => {
    restartFromKakao(null);
    await startKakao(true);
  };

  // switchAccount=true 면 카카오 세션이 남아 있어도 로그인 화면을 다시 띄운다. 없으면 브라우저에
  // 남은 카카오 세션 때문에 늘 같은 계정으로만 들어가진다 (공용 PC·계정 전환).
  const startKakao = async (switchAccount = false) => {
    setIsStarting(true);
    setErrorMessage(null);

    try {
      const started = await startKakaoLogin({ switchAccount });

      // 연동 코드는 TTL 10분·1회용이다. 가입 단계로 넘어갈 수 있으니 먼저 보관한다.
      setLinkCode(started.link_code);

      // 신규 회원은 동의·요금제를 받고 나서 가입한다.
      if (started.is_new) {
        setStage('signup');
        return;
      }

      setAuthSession(await loginWithKakao(started.link_code));
    } catch (error) {
      // 사용자가 취소한 경우다 — 에러 박스를 띄우지 않고 조용히 원상복귀한다.
      if (error instanceof KakaoCancelledError) {
        return;
      }

      // is_new=false로 왔지만 서버에 회원이 없다 — 보관해 둔 연동 코드로 가입 단계를 잇는다.
      if (error instanceof KakaoNotRegisteredError) {
        setStage('signup');
        return;
      }

      // 연동 코드가 만료·소비된 상태로 돌아왔다면 그 코드를 붙들고 있을 이유가 없다.
      if (error instanceof KakaoLinkExpiredError) {
        restartFromKakao(`${error.message}\n${RESTART_GUIDE}`);
        return;
      }

      setErrorMessage(
        error instanceof Error ? error.message : '카카오 로그인 중 오류가 발생했습니다.',
      );
    } finally {
      setIsStarting(false);
    }
  };

  const completeSignup = async () => {
    if (linkCode === null) {
      restartFromKakao(RESTART_GUIDE);
      return;
    }

    setIsSigningUp(true);
    setErrorMessage(null);

    try {
      setAuthSession(
        await signupWithKakao(linkCode, {
          agreed_terms: agreedTerms,
          agreed_privacy: agreedPrivacy,
          plan_code: planCode,
        }),
      );
    } catch (error) {
      // 연동 코드가 만료·소비됐다(동의 화면에 10분 이상 머문 경우). 그 코드로는 못 고치니
      // 처음부터 다시 시작시킨다.
      if (error instanceof KakaoLinkExpiredError) {
        restartFromKakao(`${error.message}\n${RESTART_GUIDE}`);
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.logoMark}>
              <MaterialIcons name="health-and-safety" size={30} color="#ffffff" />
            </View>
            <Text style={styles.kicker}>K-Cal AI</Text>
            <Text style={styles.title}>
              {isSignup ? '거의 다 됐어요' : '카카오로\n식단 기록을 시작해요'}
            </Text>
            <Text style={styles.description}>
              {isSignup
                ? '약관에 동의하고 요금제를 고르면 가입이 끝나요.'
                : '비밀번호 없이 카카오 계정으로 가입하고 로그인합니다.'}
            </Text>
          </View>

          <View style={styles.form}>
            {isSignup ? (
              <>
                <View style={styles.consentSection}>
                  <Text style={styles.label}>약관 동의</Text>
                  <Pressable
                    onPress={toggleAgreeAll}
                    style={({ pressed }) => [styles.agreeAllRow, pressed && styles.pressed]}>
                    <CheckBox isChecked={hasAgreedAll} />
                    <Text style={styles.agreeAllText}>모두 동의</Text>
                  </Pressable>
                  <ConsentRow
                    isChecked={agreedTerms}
                    label="[필수] 서비스 이용약관"
                    onToggle={() => setAgreedTerms((prev) => !prev)}
                  />
                  <ConsentRow
                    isChecked={agreedPrivacy}
                    label="[필수] 개인정보 처리방침"
                    onToggle={() => setAgreedPrivacy((prev) => !prev)}
                  />
                </View>

                <View style={styles.planSection}>
                  <Text style={styles.label}>요금제</Text>
                  <Text style={styles.planGuide}>
                    무료로 시작하고 언제든지 내 정보에서 바꿀 수 있어요.
                  </Text>
                  {plans.map((plan) => (
                    <PlanCard
                      isSelected={plan.code === planCode}
                      key={plan.code}
                      onPress={() => setPlanCode(plan.code)}
                      plan={plan}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={20} color="#e5484d" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {isSignup ? (
              <>
                <Pressable
                  disabled={!canSignup}
                  onPress={() => void completeSignup()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !canSignup && styles.primaryButtonDisabled,
                    pressed && canSignup && styles.pressed,
                  ]}>
                  {isSigningUp ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <MaterialIcons name="verified-user" size={20} color="#ffffff" />
                      <Text style={styles.primaryButtonText}>가입 완료</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  disabled={isSigningUp}
                  onPress={() => void switchKakaoAccount()}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Text style={styles.textButtonLabel}>다른 카카오 계정으로 시작하기</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  disabled={isStarting}
                  onPress={() => void startKakao()}
                  style={({ pressed }) => [
                    styles.kakaoButton,
                    isStarting && styles.buttonDisabled,
                    pressed && !isStarting && styles.pressed,
                  ]}>
                  {isStarting ? (
                    <ActivityIndicator color="#191f28" />
                  ) : (
                    <>
                      <MaterialIcons name="chat-bubble" size={20} color="#191f28" />
                      <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
                    </>
                  )}
                </Pressable>

                {/* 브라우저에 카카오 세션이 남아 있으면 위 버튼은 늘 같은 계정으로 들어간다.
                    계정을 바꾸려면 카카오에 로그인 화면을 다시 띄우라고 요청해야 한다. */}
                <Pressable
                  disabled={isStarting}
                  onPress={() => void switchKakaoAccount()}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Text style={styles.textButtonLabel}>다른 카카오 계정으로 로그인</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CheckBox({ isChecked }: { isChecked: boolean }) {
  return (
    <View style={[styles.checkBox, isChecked && styles.checkBoxChecked]}>
      <MaterialIcons color={isChecked ? '#ffffff' : '#b0b8c1'} name="check" size={16} />
    </View>
  );
}

function ConsentRow({
  isChecked,
  label,
  onToggle,
}: {
  isChecked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked }}
      onPress={onToggle}
      style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}>
      <CheckBox isChecked={isChecked} />
      <Text style={styles.consentText}>{label}</Text>
    </Pressable>
  );
}

function PlanCard({
  isSelected,
  onPress,
  plan,
}: {
  isSelected: boolean;
  onPress: () => void;
  plan: Plan;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.planCard,
        isSelected && styles.planCardSelected,
        pressed && styles.pressed,
      ]}>
      <View style={styles.planCardHeader}>
        <Text style={styles.planCardTitle}>{plan.label}</Text>
        <Text style={styles.planCardPrice}>{formatPlanPrice(plan.price_krw)}</Text>
      </View>
      <Text style={styles.planCardDetail}>
        {`사진 인식 하루 ${plan.daily_vision_quota}건 · 그룹 인원 ${plan.max_group_members}명 · 반려동물 ${plan.max_pets}마리`}
      </Text>
    </Pressable>
  );
}

function formatPlanPrice(priceKrw: number): string {
  return priceKrw === 0 ? '무료' : `월 ${priceKrw.toLocaleString()}원`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  container: {
    alignSelf: 'center',
    gap: 18,
    maxWidth: 720,
    width: '100%',
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
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 14,
    padding: 18,
  },
  label: {
    color: '#333d4b',
    fontSize: 14,
    fontWeight: '900',
  },
  kakaoButton: {
    alignItems: 'center',
    backgroundColor: '#fee500',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  kakaoButtonText: {
    color: '#191f28',
    fontSize: 17,
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
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  textButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  textButtonLabel: {
    color: '#6b7684',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.74,
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
  consentSection: {
    gap: 8,
  },
  agreeAllRow: {
    alignItems: 'center',
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  agreeAllText: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  consentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  consentText: {
    color: '#4e5968',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  checkBox: {
    alignItems: 'center',
    backgroundColor: '#e5e8eb',
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkBoxChecked: {
    backgroundColor: '#3182f6',
  },
  planSection: {
    gap: 8,
  },
  planGuide: {
    color: '#8b95a1',
    fontSize: 13,
    lineHeight: 18,
  },
  planCard: {
    backgroundColor: '#f2f4f6',
    borderColor: '#f2f4f6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  planCardSelected: {
    backgroundColor: '#f5f9ff',
    borderColor: '#3182f6',
  },
  planCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planCardTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  planCardPrice: {
    color: '#3182f6',
    fontSize: 15,
    fontWeight: '900',
  },
  planCardDetail: {
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 19,
  },
});
