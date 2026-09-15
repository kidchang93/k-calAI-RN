import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { ChipGroup } from '@/components/chip-group';
import { ConditionForm, NONE_VALUE } from '@/components/condition-form';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
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
  getConditions,
  getHealthProfile,
  HealthProfile,
  putConditions,
  putHealthProfile,
} from '@/services/onboarding-api';

// 병기를 물어보는 질병. 신장 질환만 나트륨 하루 상한이 병기에서 갈린다
// (비투석 2,000 / 투석 3,000 — 서버 docs/CKD_NUTRITION.md 3-6).
const CKD_CODE = 'ckd';

export default function ConditionsEditScreen() {
  const router = useRouter();
  const [conditionOptions, setConditionOptions] = useState<MetaOption[]>(
    FALLBACK_CONDITION_OPTIONS,
  );
  const [savedCodes, setSavedCodes] = useState<string[]>([]);
  const [stageOptions, setStageOptions] = useState<MetaOption[]>(FALLBACK_CKD_STAGE_OPTIONS);
  // 건강 프로필은 **replace-all PUT**이라 저장 시 혈액형·Rh를 함께 돌려보내야 한다.
  // 그래서 '조회 성공(프로필이 없을 수도 있다)'과 '조회 실패'를 구분한다 — 실패했는데
  // 편집을 열어 두면 저장이 혈액형을 지운다(알러지 severity 보존과 같은 판단).
  // 아직 프로필을 만들지 않은 사용자(혈액형 미입력)는 조회 성공 + null 이라 편집할 수 있다.
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [savedProfile, setSavedProfile] = useState<HealthProfile | null>(null);
  const [ckdStage, setCkdStage] = useState<CkdStage | null>(null);
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
    const [optionsResult, savedResult, profileResult] = await Promise.allSettled([
      getMetaOptions(),
      getConditions(),
      getHealthProfile(),
    ]);

    if (optionsResult.status === 'fulfilled') {
      setConditionOptions(optionsResult.value.conditions);
      setStageOptions(optionsResult.value.ckd_stages);
    }

    if (profileResult.status === 'fulfilled') {
      setIsProfileLoaded(true);
      setSavedProfile(profileResult.value);
      setCkdStage(profileResult.value?.ckd_stage ?? null);
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

    setSavedCodes(savedResult.value);
    // 저장값이 비어 있으면 '해당 없음' 상태로 프리필한다 (빈 배열 = 전체 삭제와 같은 의미).
    setSelectedValues(savedResult.value.length > 0 ? savedResult.value : [NONE_VALUE]);
    setIsLoaded(true);
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // 병기는 하나만 고른다. 같은 칩을 다시 누르면 '모름'(null)으로 되돌린다.
  const toggleStage = (value: string) => {
    setCkdStage((previous) => (previous === value ? null : (value as CkdStage)));
  };

  // 프로필 조회에 실패했으면 열지 않는다 (위 isProfileLoaded 주석).
  const canEditStage = selectedValues.includes(CKD_CODE) && isProfileLoaded;

  const save = async (conditions: string[]) => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await putConditions(conditions);

      // 병기는 다른 API(PUT /me/health-profile)라 따로 저장한다. 바뀐 게 없으면 부르지 않는다.
      // 혈액형·Rh를 함께 실어야 하는 이유는 이 PUT이 전체 교체이기 때문이다.
      // 질병에서 신장 질환을 뺐어도 병기 값은 지우지 않는다 — 읽는 곳이 사라질 뿐이고,
      // 다시 선택했을 때 재입력을 요구하지 않는 편이 낫다.
      if (canEditStage && ckdStage !== (savedProfile?.ckd_stage ?? null)) {
        await putHealthProfile({
          blood_type: savedProfile?.blood_type ?? null,
          rh: savedProfile?.rh ?? null,
          ckd_stage: ckdStage,
        });
      }

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
        <Text style={styles.title}>질병 정보 수정</Text>
        <Text style={styles.subtitle}>추천에서 피해야 할 음식을 거르는 데만 씁니다.</Text>
      </View>

      {isLoading ? (
        <LoadingState label="질병 정보를 불러오는 중입니다." />
      ) : !isLoaded ? (
        errorMessage ? (
          <ErrorBanner message={errorMessage} onRetry={() => void load()} />
        ) : null
      ) : (
        <ConditionForm
          errorMessage={errorMessage}
          isSaving={isSaving}
          onChange={setSelectedValues}
          onSave={(conditions) => void save(conditions)}
          options={conditionOptions}
          saveLabel="저장"
          savedCodes={savedCodes}
          selectedValues={selectedValues}>
          {/* 병기는 신장 질환을 고른 사람에게만 묻는다. 나트륨 상한이 여기서 갈리는데,
              모르면 상한을 제시할 수 없어 하루 누적이 수치로만 남는다. */}
          {canEditStage ? (
            <View style={styles.stageSection}>
              <Text style={styles.stageTitle}>투석을 받고 계신가요?</Text>
              <Text style={styles.stageDescription}>
                투석 여부에 따라 하루 나트륨 목표가 2,000~3,000mg으로 달라져요. 선택하면 그
                기준으로 오늘 섭취량을 알려드립니다. 모르시면 비워 두셔도 됩니다.
              </Text>
              <ChipGroup
                onToggle={toggleStage}
                options={stageOptions.map((option) => ({
                  value: option.code,
                  label: option.label,
                }))}
                selectedValues={ckdStage === null ? [] : [ckdStage]}
              />
            </View>
          ) : null}
        </ConditionForm>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
  },
  stageDescription: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  stageSection: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 18,
  },
  stageTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '900',
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
