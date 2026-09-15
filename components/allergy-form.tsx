import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { NONE_VALUE, toggleExclusive } from '@/components/condition-form';
import { ErrorBanner } from '@/components/error-banner';
import { PrimaryButton } from '@/components/primary-button';
import type { MetaOption } from '@/services/meta-api';
import type { AllergyEntry, AllergyInput } from '@/services/onboarding-api';

// 온보딩 알러지·알러지 정보 수정이 같이 쓰는 폼. 불러오기·저장·이동은 화면이 한다.
// onSkip 을 넘기면 저장 버튼 아래에 '건너뛰기'를 붙인다(온보딩).
export function AllergyForm({
  options,
  savedEntries,
  selectedValues,
  onChange,
  isLoadingOptions = false,
  errorMessage,
  isSaving,
  saveLabel,
  onSave,
  onSkip,
}: {
  options: MetaOption[];
  savedEntries: AllergyEntry[];
  selectedValues: string[];
  onChange: (update: (previous: string[]) => string[]) => void;
  isLoadingOptions?: boolean;
  errorMessage: string | null;
  isSaving: boolean;
  saveLabel: string;
  onSave: (allergies: AllergyInput[]) => void;
  onSkip?: () => void;
}) {
  // 저장값(표준 code)을 label로 표시한다. 메타 목록에 없는 code는 code 그대로 칩을 만든다.
  const chipOptions = useMemo(() => {
    const knownCodes = new Set(options.map((option) => option.code));
    const unknownSaved = savedEntries
      .map((entry) => entry.allergen)
      .filter((code) => !knownCodes.has(code) && code !== NONE_VALUE)
      .map((code) => ({ value: code, label: code }));

    return [
      ...options.map((option) => ({ value: option.code, label: option.label })),
      ...unknownSaved,
      { value: NONE_VALUE, label: '없음' },
    ];
  }, [options, savedEntries]);

  const submit = () => {
    // '없음'은 앱 전용 값 — 서버로는 표준 code만 보낸다.
    // replace-all PUT이므로 기존 저장값의 severity를 유실하지 않게 함께 보낸다.
    const severityByAllergen = new Map(
      savedEntries.map((entry) => [entry.allergen, entry.severity]),
    );
    const allergens = selectedValues.filter((value) => value !== NONE_VALUE);

    onSave(
      allergens.map((allergen) => ({
        allergen,
        severity: severityByAllergen.get(allergen) ?? null,
      })),
    );
  };

  const saveButton = (
    <PrimaryButton
      disabled={selectedValues.length === 0}
      inGroup={onSkip !== undefined}
      label={saveLabel}
      loading={isSaving}
      onPress={submit}
    />
  );

  return (
    <>
      {isLoadingOptions ? (
        <ActivityIndicator color="#2a7d76" />
      ) : (
        <ChipGroup
          onToggle={(value) => onChange((previous) => toggleExclusive(previous, value))}
          options={chipOptions}
          selectedValues={selectedValues}
        />
      )}

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>사진 분석 결과에 제외 재료가 보이면 기록할 때 경고합니다.</Text>
      </View>

      {errorMessage ? <ErrorBanner message={errorMessage} onRetry={submit} /> : null}

      {onSkip === undefined ? (
        saveButton
      ) : (
        <View style={styles.buttonGroup}>
          {saveButton}

          <Pressable
            disabled={isSaving}
            onPress={onSkip}
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}>
            <Text style={styles.ghostButtonText}>건너뛰기</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  buttonGroup: {
    gap: 8,
    marginTop: 8,
  },
  ghostButton: {
    alignItems: 'center',
    backgroundColor: '#e4e2de',
    borderRadius: 8,
    paddingVertical: 14,
  },
  ghostButtonText: {
    color: '#5c5b57',
    fontSize: 16,
    fontWeight: '700',
  },
  noteBox: {
    backgroundColor: '#eef7f5',
    borderRadius: 8,
    padding: 16,
  },
  noteText: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.74,
  },
});
