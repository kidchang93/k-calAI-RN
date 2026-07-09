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
import { ConsentRequiredError, putAllergies } from '@/services/onboarding-api';

// '없음'은 서버 값이 아니라 replace-all PUT의 빈 배열로 표현한다.
const NONE_VALUE = 'none';

// allergen은 자유 문자열(100자) 계약이라 한국어 라벨을 값으로 그대로 보낸다.
const ALLERGY_OPTIONS = [
  { value: '땅콩', label: '땅콩' },
  { value: '우유', label: '우유' },
  { value: '갑각류', label: '갑각류' },
  { value: '계란', label: '계란' },
  { value: '밀', label: '밀' },
  { value: '대두', label: '대두' },
  { value: '복숭아', label: '복숭아' },
  { value: NONE_VALUE, label: '없음' },
];

export default function AllergiesScreen() {
  const router = useRouter();
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggle = (value: string) => {
    setSelectedValues((previous) => {
      if (value === NONE_VALUE) {
        return previous.includes(NONE_VALUE) ? [] : [NONE_VALUE];
      }

      const withoutNone = previous.filter((item) => item !== NONE_VALUE);

      return withoutNone.includes(value)
        ? withoutNone.filter((item) => item !== value)
        : [...withoutNone, value];
    });
  };

  const goNext = () => {
    router.push({ pathname: '/onboarding/goal', params: { consented: '1' } });
  };

  const saveAndNext = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const allergens = selectedValues.filter((value) => value !== NONE_VALUE);
      await putAllergies(allergens.map((allergen) => ({ allergen })));
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
          <OnboardingProgress current={5} total={6} />

          <View style={styles.header}>
            <Text style={styles.title}>알러지가 있는{'\n'}재료가 있나요?</Text>
            <Text style={styles.subtitle}>추천 식단에서 완전히 제외합니다.</Text>
          </View>

          <ChipGroup onToggle={toggle} options={ALLERGY_OPTIONS} selectedValues={selectedValues} />

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              사진 분석 결과에 제외 재료가 보이면 기록할 때 경고합니다.
            </Text>
          </View>

          {errorMessage ? (
            <ErrorBanner message={errorMessage} onRetry={() => void saveAndNext()} />
          ) : null}

          <View style={styles.buttonGroup}>
            <Pressable
              disabled={selectedValues.length === 0 || isSaving}
              onPress={() => void saveAndNext()}
              style={({ pressed }) => [
                styles.primaryButton,
                (selectedValues.length === 0 || isSaving) && styles.primaryButtonDisabled,
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
