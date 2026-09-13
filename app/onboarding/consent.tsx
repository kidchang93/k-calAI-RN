import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsentNotice } from '@/components/consent-notice';
import { ErrorBanner } from '@/components/error-banner';
import { OnboardingProgress } from '@/components/onboarding-progress';
import {
  CONSENT_VERSION,
  SENSITIVE_HEALTH_NOTICE_ROWS,
  SENSITIVE_HEALTH_REFUSAL,
  SENSITIVE_HEALTH_SUMMARY,
} from '@/constants/consent';
import { postConsent } from '@/services/onboarding-api';

export default function ConsentScreen() {
  const router = useRouter();
  const [isAgreeing, setIsAgreeing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const agreeAndStart = async () => {
    setIsAgreeing(true);
    setErrorMessage(null);

    try {
      await postConsent('sensitive_health', CONSENT_VERSION);
      // **질환을 가장 먼저 묻는다** (2026-07-25). 이 앱은 식이요법이 필요한 만성질환자를 위한
      // 것이고, 질환 선택이 온보딩의 중심에 있어야 한다는 것이 방어선이다
      // (서버 docs/PRODUCT_STRATEGY.md §3). 예전에는 신체·혈액형 뒤 4번째라 일반 다이어트
      // 앱의 순서였고, 질환이 부가 정보처럼 보였다.
      router.push({ pathname: '/onboarding/conditions', params: { consented: '1' } });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsAgreeing(false);
    }
  };

  const continueWithoutConsent = () => {
    // 동의하지 않으면 질병·알러지를 아예 보여주지 않는다 — 그러면 이 앱의 핵심 기능
    // (질환 축 경고·추천)은 동작하지 않고 칼로리 기록만 남는다.
    router.push({ pathname: '/onboarding/body', params: { consented: '0' } });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <OnboardingProgress current={1} total={5} />

          <View style={styles.header}>
            <Text style={styles.title}>건강 정보 수집에{'\n'}동의해주세요</Text>
            <Text style={styles.subtitle}>{SENSITIVE_HEALTH_SUMMARY}</Text>
          </View>

          {/* 개인정보 보호법 제23조①1호가 동의 전에 알리게 한 것(항목·목적·보유 기간·거부권과 불이익)을
              전부 이 화면에 둔다. 2026-09-13(v1.0)까지는 "식단 추천에서 거르는 데만"이라는 한 문장뿐이었고,
              실제로 쓰는 검사 수치·진료 메모·경고·주간 조언·리포트가 빠져 있었다(KCAL-22). */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>건강 정보 수집·이용</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>선택</Text>
              </View>
            </View>
            <ConsentNotice rows={SENSITIVE_HEALTH_NOTICE_ROWS} />
            <Text style={styles.cardMeta}>{`${CONSENT_VERSION} · 내 정보에서 언제든 철회할 수 있어요`}</Text>
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>{SENSITIVE_HEALTH_REFUSAL}</Text>
          </View>

          {errorMessage ? (
            <ErrorBanner message={errorMessage} onRetry={() => void agreeAndStart()} />
          ) : null}

          <View style={styles.buttonGroup}>
            <Pressable
              disabled={isAgreeing}
              onPress={() => void agreeAndStart()}
              style={({ pressed }) => [
                styles.primaryButton,
                isAgreeing && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}>
              {isAgreeing ? (
                <ActivityIndicator color="#22211f" />
              ) : (
                <Text style={styles.primaryButtonText}>동의하고 시작</Text>
              )}
            </Pressable>

            <Pressable
              disabled={isAgreeing}
              onPress={continueWithoutConsent}
              style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}>
              <Text style={styles.ghostButtonText}>동의하지 않고 계속</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#bee2dd',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#2a7d76',
    fontSize: 12,
    fontWeight: '800',
  },
  buttonGroup: {
    gap: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 14,
    padding: 20,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMeta: {
    color: '#a9a6a1',
    fontSize: 13,
  },
  cardTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  ghostButton: {
    alignItems: 'center',
    backgroundColor: '#e4e2de',
    borderRadius: 8,
    paddingVertical: 14,
  },
  ghostButtonText: {
    color: '#5c5b57',
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    gap: 6,
  },
  noteBox: {
    backgroundColor: '#eef7f5',
    borderRadius: 8,
    padding: 16,
  },
  noteText: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#60beb8',
    borderRadius: 8,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: '#99d2ce',
  },
  primaryButtonText: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: '#f7f6f4',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  subtitle: {
    color: '#5c5b57',
    fontSize: 14,
  },
  title: {
    color: '#22211f',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 34,
  },
});
