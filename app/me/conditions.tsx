import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ChipGroup } from '@/components/chip-group';
import { ErrorBanner } from '@/components/error-banner';
import { FALLBACK_CONDITION_OPTIONS, getMetaOptions, MetaOption } from '@/services/meta-api';
import { ConsentRequiredError, getConditions, putConditions } from '@/services/onboarding-api';

// '해당 없음'은 서버 값이 아니라 replace-all PUT의 빈 배열로 표현한다 (온보딩과 동일 규칙).
const NONE_VALUE = 'none';

export default function ConditionsEditScreen() {
  const router = useRouter();
  const [conditionOptions, setConditionOptions] = useState<MetaOption[]>(
    FALLBACK_CONDITION_OPTIONS,
  );
  const [savedCodes, setSavedCodes] = useState<string[]>([]);
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
    // 기존 값을 지우므로, 이때는 폼 대신 오류 배너만 보여준다.
    const [optionsResult, savedResult] = await Promise.allSettled([
      getMetaOptions(),
      getConditions(),
    ]);

    if (optionsResult.status === 'fulfilled') {
      setConditionOptions(optionsResult.value.conditions);
    }

    if (savedResult.status === 'rejected') {
      const error = savedResult.reason;

      // 403(동의 없음/철회)은 세션 만료가 아니다. 동의 화면으로 되돌린다.
      if (error instanceof ConsentRequiredError) {
        router.replace('/onboarding/consent');
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      setIsLoading(false);
      return;
    }

    setSavedCodes(savedResult.value);
    // 저장값이 비어 있으면 '해당 없음' 상태로 프리필한다 (빈 배열 = 전체 삭제와 같은 의미).
    setSelectedValues(savedResult.value.length > 0 ? savedResult.value : [NONE_VALUE]);
    setIsLoaded(true);
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // 저장값(표준 code)을 label로 표시한다. 메타 목록에 없는 code는 code 그대로 칩을 만든다.
  const chipOptions = useMemo(() => {
    const knownCodes = new Set(conditionOptions.map((option) => option.code));
    const unknownSaved = savedCodes
      .filter((code) => !knownCodes.has(code) && code !== NONE_VALUE)
      .map((code) => ({ value: code, label: code }));

    return [
      ...conditionOptions.map((option) => ({ value: option.code, label: option.label })),
      ...unknownSaved,
      { value: NONE_VALUE, label: '해당 없음' },
    ];
  }, [conditionOptions, savedCodes]);

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

  const save = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      // '해당 없음'은 앱 전용 값 — 서버로는 표준 code만 보낸다.
      const conditions = selectedValues.filter((value) => value !== NONE_VALUE);
      await putConditions(conditions);

      // 내 정보 탭은 useFocusEffect로 복귀 시 다시 읽는다.
      router.back();
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
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>질병 정보 수정</Text>
            <Text style={styles.subtitle}>추천에서 피해야 할 음식을 거르는 데만 씁니다.</Text>
          </View>

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>질병 정보를 불러오는 중입니다.</Text>
            </View>
          ) : !isLoaded ? (
            errorMessage ? (
              <ErrorBanner message={errorMessage} onRetry={() => void load()} />
            ) : null
          ) : (
            <>
              <ChipGroup onToggle={toggle} options={chipOptions} selectedValues={selectedValues} />

              <View style={styles.noteBox}>
                <Text style={styles.noteText}>
                  kcal은 의료 서비스가 아닙니다. 진단·처방을 대신하지 않으며, 치료 중이라면 반드시
                  의료진과 상의하세요.
                </Text>
              </View>

              {errorMessage ? (
                <ErrorBanner message={errorMessage} onRetry={() => void save()} />
              ) : null}

              <Pressable
                disabled={selectedValues.length === 0 || isSaving}
                onPress={() => void save()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (selectedValues.length === 0 || isSaving) && styles.primaryButtonDisabled,
                  pressed && styles.pressed,
                ]}>
                {isSaving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>저장</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  header: {
    gap: 4,
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
    marginTop: 8,
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
