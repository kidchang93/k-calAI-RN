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
import {
  FALLBACK_CKD_STAGE_OPTIONS,
  FALLBACK_CONDITION_OPTIONS,
  getMetaOptions,
  MetaOption,
} from '@/services/meta-api';
import {
  CkdStage,
  ConsentRequiredError,
  putConditions,
  putHealthProfile,
} from '@/services/onboarding-api';

// '해당 없음'은 서버 값이 아니라 replace-all PUT의 빈 배열로 표현한다.
const NONE_VALUE = 'none';

// 신장 질환 코드 (condition_types.code). 이 값이 선택되면 병기를 이어서 묻는다.
const CKD_CODE = 'ckd';

export default function ConditionsScreen() {
  const router = useRouter();
  const [conditionOptions, setConditionOptions] = useState<MetaOption[]>(
    FALLBACK_CONDITION_OPTIONS,
  );
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  // 신장 질환을 고르면 **병기까지 이어서 묻는다** (2026-07-25). 나트륨 1일 상한이 병기에서
  // 갈리므로(비투석 2,000 · 투석 3,000), 병기를 모르면 CKD 사용자에게 상한을 제시할 수 없다
  // — 하루 누적이 "투석 여부를 입력해주세요"로 남는다 (서버 CKD_NUTRITION.md 3-6).
  const [stageOptions, setStageOptions] = useState<MetaOption[]>(FALLBACK_CKD_STAGE_OPTIONS);
  const [ckdStage, setCkdStage] = useState<CkdStage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      try {
        const options = await getMetaOptions();

        if (!cancelled) {
          setConditionOptions(options.conditions);
          setStageOptions(options.ckd_stages);
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

  const isCkdSelected = selectedValues.includes(CKD_CODE);

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

      // 병기는 다른 API(PUT /me/health-profile)다. 온보딩에서는 아직 혈액형을 묻지 않으므로
      // null 로 보낸다 — 이 PUT 은 전체 교체라 항목을 빠뜨리면 지워진다(서버 CLAUDE.md).
      if (isCkdSelected && ckdStage !== null) {
        await putHealthProfile({ blood_type: null, rh: null, ckd_stage: ckdStage });
      }

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
          <OnboardingProgress current={2} total={5} />

          <View style={styles.header}>
            <Text style={styles.title}>해당하는 것을{'\n'}모두 골라주세요</Text>
            {/* 예전 문구는 "추천에서 피해야 할 음식을 거르는 데만 씁니다"였다. 사실이지만
                **질환을 고르는 사람이 알고 싶은 것**은 그게 아니다 — 방금 진단받은 사람은
                무엇을 어떻게 먹어야 하는지를 알고 싶어 한다. 이 화면이 앱에서 질환을 언급하는
                첫 자리인데 배울 것이 있다는 사실조차 알리지 않았다 (서버 `docs/CARE_LOOP.md` §0-3). */}
            <Text style={styles.subtitle}>
              고른 질환의 식단 가이드를 볼 수 있고, 먹은 음식에 주의할 성분이 있으면 알려드려요.
            </Text>
          </View>

          {isLoadingOptions ? (
            <ActivityIndicator color="#3182f6" />
          ) : (
            <ChipGroup onToggle={toggle} options={chipOptions} selectedValues={selectedValues} />
          )}

          {/* 신장 질환을 골랐을 때만 나타난다. 나트륨 1일 상한이 병기에서 갈리므로
              (비투석 2,000 · 투석 3,000) 여기서 묻지 않으면 그 사용자에게는 상한을 제시할 수
              없다. 건너뛸 수 있게 두는 이유는 모르는 사람에게 강요하면 아무거나 고르기 때문이다 —
              서버는 병기가 없으면 상한 대신 안내를 준다 (서버 CKD_NUTRITION.md 3-6). */}
          {isCkdSelected ? (
            <View style={styles.stageBlock}>
              <Text style={styles.stageTitle}>투석을 받고 계신가요?</Text>
              <Text style={styles.stageHint}>
                투석 여부에 따라 하루 나트륨 기준이 2,000~3,000mg으로 달라요. 모르시면 건너뛰고
                나중에 내 정보에서 입력하셔도 됩니다.
              </Text>
              <ChipGroup
                onToggle={(value) =>
                  setCkdStage((current) => (current === value ? null : (value as CkdStage)))
                }
                options={stageOptions.map((option) => ({
                  value: option.code,
                  label: option.label,
                }))}
                selectedValues={ckdStage === null ? [] : [ckdStage]}
              />
            </View>
          ) : null}

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
  stageBlock: {
    gap: 8,
  },
  stageHint: {
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 19,
  },
  stageTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '800',
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
