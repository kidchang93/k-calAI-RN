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

import { ErrorBanner } from '@/components/error-banner';
import { OnboardingProgress } from '@/components/onboarding-progress';
import { CONSENT_VERSION } from '@/constants/consent';
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
      router.push({ pathname: '/onboarding/body', params: { consented: '1' } });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsAgreeing(false);
    }
  };

  const continueWithoutConsent = () => {
    // 동의하지 않으면 혈액형·질병·알러지(2~4단계)를 아예 보여주지 않는다.
    router.push({ pathname: '/onboarding/body', params: { consented: '0' } });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <OnboardingProgress current={1} total={6} />

          <View style={styles.header}>
            <Text style={styles.title}>건강 정보 수집에{'\n'}동의해주세요</Text>
            <Text style={styles.subtitle}>혈액형·질병·알러지는 법이 정한 민감정보입니다.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>건강 정보 수집·이용</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>선택</Text>
              </View>
            </View>
            <Text style={styles.cardBody}>
              식단 추천에서 피해야 할 음식을 거르는 데만 씁니다. 제3자에게 제공하지 않습니다.
            </Text>
            <Text style={styles.cardMeta}>{`${CONSENT_VERSION} · 내 정보에서 언제든 철회할 수 있어요`}</Text>
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              동의하지 않아도 사진 기록과 칼로리 계산은 쓸 수 있어요. 다만 혈액형·질병·알러지
              입력 단계를 건너뛰고, 식단 추천은 개인 맞춤 없이 일반 가이드로 제공됩니다.
            </Text>
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
                <ActivityIndicator color="#ffffff" />
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
    backgroundColor: '#edf6ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#3182f6',
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
    gap: 8,
    padding: 20,
  },
  cardBody: {
    color: '#4e5968',
    fontSize: 14,
    lineHeight: 20,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMeta: {
    color: '#8b95a1',
    fontSize: 13,
  },
  cardTitle: {
    color: '#191f28',
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
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    paddingVertical: 14,
  },
  ghostButtonText: {
    color: '#4e5968',
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    gap: 6,
  },
  noteBox: {
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    padding: 16,
  },
  noteText: {
    color: '#4e5968',
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
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
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 34,
  },
});
