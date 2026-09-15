import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AllergyForm } from '@/components/allergy-form';
import { BackButton } from '@/components/back-button';
import { NONE_VALUE } from '@/components/condition-form';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { FALLBACK_ALLERGEN_OPTIONS, getMetaOptions, MetaOption } from '@/services/meta-api';
import {
  AllergyEntry,
  AllergyInput,
  ConsentRequiredError,
  getAllergies,
  putAllergies,
} from '@/services/onboarding-api';

export default function AllergiesEditScreen() {
  const router = useRouter();
  const [allergenOptions, setAllergenOptions] = useState<MetaOption[]>(FALLBACK_ALLERGEN_OPTIONS);
  const [savedEntries, setSavedEntries] = useState<AllergyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    // 메타 조회 실패는 번들 폴백으로 그린다 (docs/DESIGN.md 선택지 데이터 규칙).
    // 저장값 조회 실패에는 폴백이 없다 — replace-all PUT이라 프리필 없이 저장하면
    // 기존 값(severity 포함)을 지우므로, 이때는 폼 대신 오류 배너만 보여준다.
    const [optionsResult, savedResult] = await Promise.allSettled([
      getMetaOptions(),
      getAllergies(),
    ]);

    if (optionsResult.status === 'fulfilled') {
      setAllergenOptions(optionsResult.value.allergens);
    }

    if (savedResult.status === 'rejected') {
      const error = savedResult.reason;

      // 403(동의 없음/철회/이전 버전 동의)은 세션 만료가 아니다. 동의 관리로 보낸다.
      // 온보딩 동의 화면으로 보내면 안 된다(2026-09-13, KCAL-22): 동의 뒤 온보딩 질병·알러지·신체 화면이
      // 이어지는데 프리필 없는 전체 교체 PUT 이라, 이전 버전 동의자(데이터가 남아 있다)의 값을 덮어쓴다.
      if (error instanceof ConsentRequiredError) {
        router.replace('/me/consents');
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      setIsLoading(false);
      return;
    }

    setSavedEntries(savedResult.value);
    // 저장값이 비어 있으면 '없음' 상태로 프리필한다 (빈 배열 = 전체 삭제와 같은 의미).
    setSelectedValues(
      savedResult.value.length > 0 ? savedResult.value.map((entry) => entry.allergen) : [NONE_VALUE],
    );
    setIsLoaded(true);
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (allergies: AllergyInput[]) => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await putAllergies(allergies);

      // 내 정보 탭은 useFocusEffect로 복귀 시 다시 읽는다.
      router.back();
    } catch (error) {
      // 403(동의 없음/철회/이전 버전 동의)은 세션 만료가 아니다. 동의 관리로 보낸다.
      // 온보딩 동의 화면으로 보내면 안 된다(2026-09-13, KCAL-22): 동의 뒤 온보딩 질병·알러지·신체 화면이
      // 이어지는데 프리필 없는 전체 교체 PUT 이라, 이전 버전 동의자(데이터가 남아 있다)의 값을 덮어쓴다.
      if (error instanceof ConsentRequiredError) {
        router.replace('/me/consents');
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <BackButton />

      <View style={styles.header}>
        <Text style={styles.title}>알러지 정보 수정</Text>
        <Text style={styles.subtitle}>선택한 재료는 추천 식단에서 완전히 제외합니다.</Text>
      </View>

      {isLoading ? (
        <LoadingState label="알러지 정보를 불러오는 중입니다." />
      ) : !isLoaded ? (
        errorMessage ? (
          <ErrorBanner message={errorMessage} onRetry={() => void load()} />
        ) : null
      ) : (
        <AllergyForm
          errorMessage={errorMessage}
          isSaving={isSaving}
          onChange={setSelectedValues}
          onSave={(allergies) => void save(allergies)}
          options={allergenOptions}
          saveLabel="저장"
          savedEntries={savedEntries}
          selectedValues={selectedValues}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
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
});
