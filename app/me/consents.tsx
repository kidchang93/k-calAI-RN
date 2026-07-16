import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { CONSENT_VERSION } from '@/constants/consent';
import {
  ConsentRecord,
  getConsents,
  postConsent,
  revokeConsent,
} from '@/services/onboarding-api';

// 동의 관리 — 온보딩에서 "내 정보에서 언제든 철회할 수 있어요"라고 약속한 그 화면이다
// (app/onboarding/consent.tsx, app/onboarding/blood.tsx). 2026-07-16까지 이 경로가 없어서
// 앱이 지키지 못할 고지를 하고 있었다.
//
// 가입 필수 동의(이용약관·개인정보 처리방침)는 **철회 버튼을 두지 않는다.** 서버 revoke는 받아주지만
// revoked_at만 채울 뿐 서비스 이용은 그대로라, 버튼을 두면 "철회했는데 계속 쓰인다"는 더 나쁜
// 거짓말이 된다. 이 둘을 그만두는 길은 회원 탈퇴다.

export default function ConsentsScreen() {
  const [consents, setConsents] = useState<ConsentRecord[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevokeConfirmVisible, setIsRevokeConfirmVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConsents = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setConsents(await getConsents());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadConsents();
    }, [loadConsents])
  );

  const submit = async (action: () => Promise<void>) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await action();
      setIsRevokeConfirmVisible(false);
      await loadConsents();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const health = consents === null ? null : latestConsent(consents, 'sensitive_health');
  const hasHealthConsent = health !== null && health.revoked_at === null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>동의 관리</Text>
            <Text style={styles.subtitle}>내가 동의한 항목을 확인하고 철회할 수 있어요.</Text>
          </View>

          {errorMessage ? (
            <ErrorBanner message={errorMessage} onRetry={() => void loadConsents()} />
          ) : null}

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>동의 내역을 불러오는 중입니다.</Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>건강 정보 수집·이용</Text>
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalBadgeText}>선택</Text>
                  </View>
                </View>
                <Text style={styles.cardText}>
                  혈액형·질병·알러지는 법이 정한 민감정보입니다. 식단 추천에서 피해야 할 음식을
                  거르고, 기록할 때 경고를 띄우는 데만 씁니다. 제3자에게 제공하지 않습니다.
                </Text>

                <View style={styles.statusRow}>
                  <MaterialIcons
                    color={hasHealthConsent ? '#20c997' : '#8b95a1'}
                    name={hasHealthConsent ? 'check-circle' : 'remove-circle-outline'}
                    size={16}
                  />
                  <Text style={styles.statusText}>{describeHealthStatus(health)}</Text>
                </View>

                {hasHealthConsent ? (
                  isRevokeConfirmVisible ? (
                    /* 화면 안 2단계 확인 — Alert.alert는 react-native-web에서 no-op이라 웹에서
                       확인 없이 통과한다 (결제 해지 확인과 같은 규칙). */
                    <View style={styles.confirmBox}>
                      <Text style={styles.confirmTitle}>동의를 철회할까요?</Text>
                      <Text style={styles.confirmText}>
                        입력한 혈액형·질병·알러지 정보가 <Text style={styles.confirmStrong}>즉시
                        삭제</Text>되고 되돌릴 수 없어요. 식단 추천은 개인 맞춤 없이 일반 가이드로
                        제공되고, 기록할 때 알러지 경고도 뜨지 않아요. 사진 기록과 칼로리 계산은
                        그대로 쓸 수 있어요.
                      </Text>
                      <View style={styles.confirmActions}>
                        <Pressable
                          disabled={isSubmitting}
                          onPress={() => setIsRevokeConfirmVisible(false)}
                          style={({ pressed }) => [styles.keepButton, pressed && styles.pressed]}>
                          <Text style={styles.keepButtonText}>유지하기</Text>
                        </Pressable>
                        <Pressable
                          disabled={isSubmitting}
                          onPress={() => void submit(() => revokeConsent('sensitive_health'))}
                          style={({ pressed }) => [
                            styles.revokeButton,
                            isSubmitting && styles.buttonDisabled,
                            pressed && !isSubmitting && styles.pressed,
                          ]}>
                          {isSubmitting ? (
                            <ActivityIndicator color="#ffffff" />
                          ) : (
                            <Text style={styles.revokeButtonText}>철회하고 삭제</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      disabled={isSubmitting}
                      onPress={() => setIsRevokeConfirmVisible(true)}
                      style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
                      <Text style={styles.linkButtonText}>동의 철회</Text>
                    </Pressable>
                  )
                ) : (
                  <Pressable
                    disabled={isSubmitting}
                    onPress={() =>
                      void submit(() => postConsent('sensitive_health', CONSENT_VERSION))
                    }
                    style={({ pressed }) => [
                      styles.agreeButton,
                      isSubmitting && styles.buttonDisabled,
                      pressed && !isSubmitting && styles.pressed,
                    ]}>
                    {isSubmitting ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.agreeButtonText}>동의하기</Text>
                    )}
                  </Pressable>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>서비스 이용에 필수인 동의</Text>
                <RequiredConsentRow
                  consent={consents === null ? null : latestConsent(consents, 'terms')}
                  href="/legal/terms"
                  label="서비스 이용약관"
                />
                <RequiredConsentRow
                  consent={consents === null ? null : latestConsent(consents, 'privacy')}
                  href="/legal/privacy"
                  label="개인정보 처리방침"
                />
                <Text style={styles.noteText}>
                  이 두 가지는 서비스를 이용하려면 반드시 필요해서 철회 버튼을 두지 않았어요.
                  그만두시려면 내 정보에서 회원 탈퇴를 해주세요.
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RequiredConsentRow({
  consent,
  href,
  label,
}: {
  consent: ConsentRecord | null;
  href: '/legal/terms' | '/legal/privacy';
  label: string;
}) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.requiredRow, pressed && styles.pressed]}>
      <MaterialIcons color="#20c997" name="check-circle" size={16} />
      <Text style={styles.requiredLabel}>{label}</Text>
      <Text style={styles.requiredMeta}>
        {consent === null ? '기록 없음' : `${formatDay(consent.agreed_at)} 동의`}
      </Text>
      <MaterialIcons color="#b0b8c1" name="chevron-right" size={18} />
    </Pressable>
  );
}

// 같은 kind의 최신 동의 1건. 서버가 재동의마다 새 행을 쌓고 최신순으로 주지만(agreed_at desc),
// 순서를 신뢰하지 않고 여기서 다시 고른다.
function latestConsent(consents: ConsentRecord[], kind: ConsentRecord['kind']): ConsentRecord | null {
  const matched = consents.filter((consent) => consent.kind === kind);

  if (matched.length === 0) {
    return null;
  }

  return matched.reduce((latest, current) =>
    new Date(current.agreed_at).getTime() > new Date(latest.agreed_at).getTime() ? current : latest
  );
}

function describeHealthStatus(consent: ConsentRecord | null): string {
  if (consent === null) {
    return '아직 동의하지 않았어요';
  }

  if (consent.revoked_at !== null) {
    return `${formatDay(consent.revoked_at)}에 철회함`;
  }

  return `${formatDay(consent.agreed_at)}에 동의함 · ${consent.version}`;
}

// ISO → 'YYYY년 M월 D일'. 형식이 어긋나면 빈 문자열(날짜 자리를 비운다).
function formatDay(isoText: string): string {
  const date = new Date(isoText);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

const styles = StyleSheet.create({
  agreeButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  agreeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  buttonDisabled: {
    backgroundColor: '#d1d6db',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 18,
  },
  cardHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cardText: {
    color: '#4e5968',
    fontSize: 13,
    lineHeight: 19,
  },
  cardTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmBox: {
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    gap: 10,
    padding: 14,
  },
  confirmStrong: {
    color: '#e5484d',
    fontWeight: '900',
  },
  confirmText: {
    color: '#4e5968',
    fontSize: 13,
    lineHeight: 19,
  },
  confirmTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  header: {
    gap: 4,
  },
  keepButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  keepButtonText: {
    color: '#4e5968',
    fontSize: 14,
    fontWeight: '800',
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  linkButtonText: {
    color: '#8b95a1',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  noteText: {
    color: '#8b95a1',
    fontSize: 12,
    lineHeight: 17,
  },
  optionalBadge: {
    backgroundColor: '#f2f4f6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  optionalBadgeText: {
    color: '#6b7684',
    fontSize: 11,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.74,
  },
  requiredLabel: {
    color: '#333d4b',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  requiredMeta: {
    color: '#8b95a1',
    fontSize: 12,
  },
  requiredRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  revokeButton: {
    alignItems: 'center',
    backgroundColor: '#e5484d',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  revokeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  stateBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 32,
  },
  stateText: {
    color: '#6b7684',
    fontSize: 14,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  statusText: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
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
