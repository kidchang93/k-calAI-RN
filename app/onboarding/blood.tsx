import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { ErrorBanner } from '@/components/error-banner';
import { OnboardingProgress } from '@/components/onboarding-progress';
import {
  BloodType,
  ConsentRequiredError,
  putHealthProfile,
  RhFactor,
} from '@/services/onboarding-api';

const BLOOD_OPTIONS = [
  { value: 'A', label: 'A형' },
  { value: 'B', label: 'B형' },
  { value: 'O', label: 'O형' },
  { value: 'AB', label: 'AB형' },
  { value: 'unknown', label: '모름' },
];

const RH_OPTIONS = [
  { value: '+', label: 'Rh+' },
  { value: '-', label: 'Rh-' },
];

export default function BloodScreen() {
  const router = useRouter();
  const [bloodType, setBloodType] = useState<BloodType | null>(null);
  const [rh, setRh] = useState<RhFactor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const goNext = () => {
    router.push({ pathname: '/onboarding/conditions', params: { consented: '1' } });
  };

  const saveAndNext = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await putHealthProfile({ blood_type: bloodType, rh });
      goNext();
    } catch (error) {
      // 403(동의 없음/철회)은 세션 만료가 아니다. 동의 화면으로 되돌린다.
      if (error instanceof ConsentRequiredError) {
        router.replace('/onboarding/consent');
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <OnboardingProgress current={3} total={6} />

          <View style={styles.header}>
            <Text style={styles.title}>혈액형을{'\n'}선택해주세요</Text>
            <Text style={styles.subtitle}>응급 상황에 대비한 정보입니다. 건너뛸 수 있어요.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>혈액형</Text>
            <ChipGroup
              onToggle={(value) => {
                if (
                  value === 'A' ||
                  value === 'B' ||
                  value === 'O' ||
                  value === 'AB' ||
                  value === 'unknown'
                ) {
                  setBloodType((previous) => (previous === value ? null : value));
                }
              }}
              options={BLOOD_OPTIONS}
              selectedValues={bloodType === null ? [] : [bloodType]}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Rh 인자</Text>
            <ChipGroup
              onToggle={(value) => {
                if (value === '+' || value === '-') {
                  setRh((previous) => (previous === value ? null : value));
                }
              }}
              options={RH_OPTIONS}
              selectedValues={rh === null ? [] : [rh]}
            />
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              동의하신 항목입니다. 내 정보에서 언제든 철회할 수 있어요.
            </Text>
          </View>

          {errorMessage ? (
            <ErrorBanner message={errorMessage} onRetry={() => void saveAndNext()} />
          ) : null}

          <View style={styles.buttonGroup}>
            <Pressable
              disabled={bloodType === null || isSaving}
              onPress={() => void saveAndNext()}
              style={({ pressed }) => [
                styles.primaryButton,
                (bloodType === null || isSaving) && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}>
              {isSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>다음</Text>
              )}
            </Pressable>

            <Pressable
              disabled={isSaving}
              onPress={goNext}
              style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}>
              <Text style={styles.ghostButtonText}>건너뛰기</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  buttonGroup: {
    gap: 8,
    marginTop: 8,
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
  label: {
    color: '#4e5968',
    fontSize: 14,
    fontWeight: '700',
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
  section: {
    gap: 8,
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
