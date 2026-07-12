import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipGroup } from '@/components/chip-group';
import { ErrorBanner } from '@/components/error-banner';
import { OnboardingProgress } from '@/components/onboarding-progress';
import { FALLBACK_CONDITION_OPTIONS, getMetaOptions, MetaOption } from '@/services/meta-api';
import { ConsentRequiredError, putConditions } from '@/services/onboarding-api';

// '해당 없음'은 서버 값이 아니라 replace-all PUT의 빈 배열로 표현한다.
const NONE_VALUE = 'none';

export default function ConditionsScreen() {
  const router = useRouter();
  const [conditionOptions, setConditionOptions] = useState<MetaOption[]>(
    FALLBACK_CONDITION_OPTIONS,
  );
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      try {
        const options = await getMetaOptions();

        if (!cancelled) {
          setConditionOptions(options.conditions);
        }
      } catch {
        // 조회 실패 시 번들 폴백으로 그린다 — 온보딩이 네트워크 오류로 막히면 안 된다
        // (docs/DESIGN.md 선택지 데이터 규칙).
      } finally {
        if (!cancelled) {
          setIsLoadingOptions(false);
        }
      }
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const chipOptions = useMemo(
    () => [
      ...conditionOptions.map((option) => ({ value: option.code, label: option.label })),
      { value: NONE_VALUE, label: '해당 없음' },
    ],
    [conditionOptions],
  );

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
    router.push({ pathname: '/onboarding/allergies', params: { consented: '1' } });
  };

  const saveAndNext = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      // '해당 없음'은 앱 전용 값 — 서버로는 표준 code만 보낸다.
      const conditions = selectedValues.filter((value) => value !== NONE_VALUE);
      await putConditions(conditions);
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
          <OnboardingProgress current={4} total={6} />

          <View style={styles.header}>
            <Text style={styles.title}>해당하는 것을{'\n'}모두 골라주세요</Text>
            <Text style={styles.subtitle}>추천에서 피해야 할 음식을 거르는 데만 씁니다.</Text>
          </View>

          {isLoadingOptions ? (
            <ActivityIndicator color="#3182f6" />
          ) : (
            <ChipGroup onToggle={toggle} options={chipOptions} selectedValues={selectedValues} />
          )}

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              kcal은 의료 서비스가 아닙니다. 진단·처방을 대신하지 않으며, 치료 중이라면 반드시
              의료진과 상의하세요.
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
