import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { ConditionForm } from '@/components/condition-form';
import { OnboardingProgress } from '@/components/onboarding-progress';
import { Screen } from '@/components/screen';
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

// 신장 질환 코드 (condition_types.code). 이 값이 선택되면 병기를 이어서 묻는다.
const CKD_CODE = 'ckd';

export default function ConditionsScreen() {
  const router = useRouter();
  const [conditionOptions, setConditionOptions] = useState<MetaOption[]>(
    FALLBACK_CONDITION_OPTIONS,
  );
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  // 신장 질환을 고르면 **병기까지 이어서 묻는다** (2026-07-25). 2026-09-16 부터 나트륨 상한은
  // 병기와 무관하게 2,000 mg 이고(KDOQI 2020 6.5.1 이 CKD 5D 를 같은 값으로 묶는다), 병기가
  // 가르는 것은 **칼륨·인 참고치 노출과 칼륨 과일 분류**다 (서버 CKD_NUTRITION.md §3-6).
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

  const isCkdSelected = selectedValues.includes(CKD_CODE);

  const goNext = () => {
    router.push({ pathname: '/onboarding/allergies', params: { consented: '1' } });
  };

  const saveAndNext = async (conditions: string[]) => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
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
    <Screen>
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

      <ConditionForm
        errorMessage={errorMessage}
        isLoadingOptions={isLoadingOptions}
        isSaving={isSaving}
        onChange={setSelectedValues}
        onSave={(conditions) => void saveAndNext(conditions)}
        onSkip={goNext}
        options={conditionOptions}
        saveLabel="다음"
        selectedValues={selectedValues}>
        {/* 신장 질환을 골랐을 때만 나타난다. 투석 중일 때만 칼륨·인 참고치를 보이고 칼륨 과일
            분류가 달라지므로 여기서 묻는다(나트륨 2,000 mg 은 병기와 무관하다). 건너뛸 수 있게
            두는 이유는 모르는 사람에게 강요하면 아무거나 고르기 때문이다 — 병기를 몰라도
            나트륨 상한은 나오고, 칼륨·인은 엄격한 쪽으로 본다 (서버 CKD_NUTRITION.md §3-6). */}
        {isCkdSelected ? (
          <View style={styles.stageBlock}>
            <Text style={styles.stageTitle}>투석을 받고 계신가요?</Text>
            <Text style={styles.stageHint}>
              투석 중이면 칼륨·인을 함께 살펴드려요. 모르시면 건너뛰고 나중에 바꾸셔도 됩니다.
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
      </ConditionForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6,
  },
  stageBlock: {
    gap: 8,
  },
  stageHint: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  stageTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
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
