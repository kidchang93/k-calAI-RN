import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AllergyForm } from '@/components/allergy-form';
import { OnboardingProgress } from '@/components/onboarding-progress';
import { Screen } from '@/components/screen';
import { FALLBACK_ALLERGEN_OPTIONS, getMetaOptions, MetaOption } from '@/services/meta-api';
import {
  AllergyEntry,
  AllergyInput,
  ConsentRequiredError,
  getAllergies,
  putAllergies,
} from '@/services/onboarding-api';

export default function AllergiesScreen() {
  const router = useRouter();
  const [allergenOptions, setAllergenOptions] = useState<MetaOption[]>(FALLBACK_ALLERGEN_OPTIONS);
  const [savedEntries, setSavedEntries] = useState<AllergyEntry[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // 조회 실패는 무시하고 폴백/빈 값으로 그린다 — 온보딩이 네트워크 오류로
      // 막히면 안 된다 (docs/DESIGN.md 선택지 데이터 규칙).
      const [optionsResult, savedResult] = await Promise.allSettled([
        getMetaOptions(),
        getAllergies(),
      ]);

      if (cancelled) {
        return;
      }

      if (optionsResult.status === 'fulfilled') {
        setAllergenOptions(optionsResult.value.allergens);
      }

      if (savedResult.status === 'fulfilled' && savedResult.value.length > 0) {
        setSavedEntries(savedResult.value);
        setSelectedValues(savedResult.value.map((entry) => entry.allergen));
      }

      setIsLoadingOptions(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const goNext = () => {
    router.push({ pathname: '/onboarding/body', params: { consented: '1' } });
  };

  const saveAndNext = async (allergies: AllergyInput[]) => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await putAllergies(allergies);
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
    <Screen>
      <OnboardingProgress current={3} total={5} />

      <View style={styles.header}>
        <Text style={styles.title}>알러지가 있는{'\n'}재료가 있나요?</Text>
        <Text style={styles.subtitle}>추천 식단에서 완전히 제외합니다.</Text>
      </View>

      <AllergyForm
        errorMessage={errorMessage}
        isLoadingOptions={isLoadingOptions}
        isSaving={isSaving}
        onChange={setSelectedValues}
        onSave={(allergies) => void saveAndNext(allergies)}
        onSkip={goNext}
        options={allergenOptions}
        saveLabel="다음"
        savedEntries={savedEntries}
        selectedValues={selectedValues}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6,
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
