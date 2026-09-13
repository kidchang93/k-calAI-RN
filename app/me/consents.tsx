import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ConsentNotice } from '@/components/consent-notice';
import { ErrorBanner } from '@/components/error-banner';
import {
  CONSENT_VERSION,
  SENSITIVE_HEALTH_CHANGE_SUMMARY,
  SENSITIVE_HEALTH_NOTICE_ROWS,
  SENSITIVE_HEALTH_REFUSAL,
  SENSITIVE_HEALTH_SUMMARY,
} from '@/constants/consent';
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
//
// 민감정보 동의는 네 상태다 (2026-09-13, KCAL-22). 'outdated'는 철회하지 않았지만 **이전 문구에 동의한**
// 상태로, 서버가 무효로 보고 403 을 준다 — 그래서 '동의함'으로 그리지 않고 다시 동의를 받는다.
// 철회는 낡은 동의에도 된다(서버 revoke 는 버전을 보지 않는다).
type HealthConsentState = 'none' | 'revoked' | 'outdated' | 'current';

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
  const healthState = toHealthConsentState(health);
  const canRevoke = healthState === 'current' || healthState === 'outdated';
  const agree = () => void submit(() => postConsent('sensitive_health', CONSENT_VERSION));

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
              <ActivityIndicator color="#2a7d76" />
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
                {/* 이 화면에서도 동의를 받으므로(동의하기·다시 동의하기) 온보딩과 같은 고지를 그린다. */}
                <Text style={styles.cardText}>{SENSITIVE_HEALTH_SUMMARY}</Text>
                <ConsentNotice rows={SENSITIVE_HEALTH_NOTICE_ROWS} />

                <View style={styles.statusRow}>
                  <MaterialIcons
                    color={statusIconColor(healthState)}
                    name={statusIconName(healthState)}
                    size={16}
                  />
                  <Text style={styles.statusText}>{describeHealthStatus(health, healthState)}</Text>
                </View>

                {healthState === 'outdated' && !isRevokeConfirmVisible ? (
                  <View style={styles.updateBox}>
                    <Text style={styles.updateTitle}>동의 내용이 바뀌었어요</Text>
                    <Text style={styles.updateText}>{SENSITIVE_HEALTH_CHANGE_SUMMARY}</Text>
                    {/* 서버가 낡은 동의에 403 을 주는 라우트(require_sensitive_consent — 건강 프로필·질병·
                        알러지, 기록 경고, 식단 추천, 주간 조언, 검사 수치)와 403 없이 **읽지 않는** 곳
                        (홈·진료 탭의 질환 기준 영양 합계, 리포트의 질환·검사 수치 — 서버 DATA_MODEL 7장). */}
                    <Text style={styles.updateText}>
                      다시 동의하기 전까지 질병·알러지 조회와 수정, 기록할 때 음식 경고, 질환 기준 영양
                      합계, 식단 추천, 주간 조언, 검사 수치를 쓸 수 없고 진료 리포트에도 질환·검사 수치가
                      빠져요.
                    </Text>
                    <AgreeButton isSubmitting={isSubmitting} label="다시 동의하기" onPress={agree} />
                  </View>
                ) : null}

                {canRevoke ? (
                  isRevokeConfirmVisible ? (
                    /* 화면 안 2단계 확인 — Alert.alert는 react-native-web에서 no-op이라 웹에서
                       확인 없이 통과한다 (결제 해지 확인과 같은 규칙). */
                    <View style={styles.confirmBox}>
                      <Text style={styles.confirmTitle}>동의를 철회할까요?</Text>
                      {/* **파기 범위가 바뀌면 이 문구도 함께 바꾼다** (2026-08-19).
                          서버가 지우는 목록은 `services/consent_service._destroy_sensitive_data`
                          (건강 프로필·질병·알러지·검사 수치 행 삭제, 진료 메모만 비움)이고, 사용자가
                          무엇을 잃는지 모르고 누르면 고지의 의미가 없다.
                          2026-09-13: "식단 추천은 일반 가이드로 제공"을 뺐다 — 추천은 동의 없이 403 이다. */}
                      <Text style={styles.confirmText}>
                        입력한 혈액형·질병(병기 포함)·알러지와 <Text style={styles.confirmStrong}>기록해 둔
                        검사 수치, 진료에서 들은 메모</Text>가 <Text style={styles.confirmStrong}>즉시
                        삭제</Text>되고 되돌릴 수 없어요. 다시 동의해도 복구되지 않습니다.
                        저장돼 있던 식단 추천 목록도 함께 지워져요. 식단 추천과 주간 조언을 쓸 수 없고,
                        기록할 때 알러지·질환 경고도 뜨지 않아요.
                        사진 기록과 칼로리 계산, 진료 일정은 그대로 쓸 수 있어요.
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
                            <ActivityIndicator color="#22211f" />
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
                  <>
                    <Text style={styles.cardText}>{SENSITIVE_HEALTH_REFUSAL}</Text>
                    <AgreeButton isSubmitting={isSubmitting} label="동의하기" onPress={agree} />
                  </>
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

function AgreeButton({
  isSubmitting,
  label,
  onPress,
}: {
  isSubmitting: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={isSubmitting}
      onPress={onPress}
      style={({ pressed }) => [
        styles.agreeButton,
        isSubmitting && styles.buttonDisabled,
        pressed && !isSubmitting && styles.pressed,
      ]}>
      {isSubmitting ? (
        <ActivityIndicator color="#22211f" />
      ) : (
        <Text style={styles.agreeButtonText}>{label}</Text>
      )}
    </Pressable>
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
      <MaterialIcons color="#60beb8" name="check-circle" size={16} />
      <Text style={styles.requiredLabel}>{label}</Text>
      <Text style={styles.requiredMeta}>
        {consent === null ? '기록 없음' : `${formatDay(consent.agreed_at)} 동의`}
      </Text>
      <MaterialIcons color="#a9a6a1" name="chevron-right" size={18} />
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

function toHealthConsentState(consent: ConsentRecord | null): HealthConsentState {
  if (consent === null) {
    return 'none';
  }

  if (consent.revoked_at !== null) {
    return 'revoked';
  }

  return consent.is_current ? 'current' : 'outdated';
}

// 낡은 동의는 체크 표시를 달지 않는다 — 서버가 무효로 보는 것을 합격 도장처럼 그리면 안 된다.
function statusIconName(state: HealthConsentState): keyof typeof MaterialIcons.glyphMap {
  if (state === 'current') {
    return 'check-circle';
  }

  return state === 'outdated' ? 'info-outline' : 'remove-circle-outline';
}

function statusIconColor(state: HealthConsentState): string {
  if (state === 'current') {
    return '#60beb8';
  }

  return state === 'outdated' ? '#a4603f' : '#a9a6a1';
}

function describeHealthStatus(consent: ConsentRecord | null, state: HealthConsentState): string {
  if (consent === null) {
    return '아직 동의하지 않았어요';
  }

  if (consent.revoked_at !== null) {
    return `${formatDay(consent.revoked_at)}에 철회함`;
  }

  if (state === 'outdated') {
    return `${formatDay(consent.agreed_at)}에 이전 내용(${consent.version})으로 동의함`;
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
    backgroundColor: '#60beb8',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  agreeButtonText: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '900',
  },
  buttonDisabled: {
    backgroundColor: '#e4e2de',
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
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  cardTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '900',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmBox: {
    backgroundColor: '#fbeaea',
    borderRadius: 8,
    gap: 10,
    padding: 14,
  },
  confirmStrong: {
    color: '#b8524e',
    fontWeight: '900',
  },
  confirmText: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  confirmTitle: {
    color: '#22211f',
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
    color: '#5c5b57',
    fontSize: 14,
    fontWeight: '800',
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  linkButtonText: {
    color: '#a9a6a1',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  noteText: {
    color: '#a9a6a1',
    fontSize: 12,
    lineHeight: 17,
  },
  optionalBadge: {
    backgroundColor: '#e4e2de',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  optionalBadgeText: {
    color: '#5c5b57',
    fontSize: 11,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.74,
  },
  requiredLabel: {
    color: '#22211f',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  requiredMeta: {
    color: '#a9a6a1',
    fontSize: 12,
  },
  requiredRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  revokeButton: {
    alignItems: 'center',
    backgroundColor: '#ea8989',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  revokeButtonText: {
    color: '#22211f',
    fontSize: 14,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#f7f6f4',
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
    color: '#5c5b57',
    fontSize: 14,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  statusText: {
    color: '#5c5b57',
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5c5b57',
    fontSize: 14,
  },
  title: {
    color: '#22211f',
    fontSize: 30,
    fontWeight: '900',
  },
  updateBox: {
    backgroundColor: '#fbeee7',
    borderRadius: 8,
    gap: 8,
    padding: 14,
  },
  updateText: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  updateTitle: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '900',
  },
});
