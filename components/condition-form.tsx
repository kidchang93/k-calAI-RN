import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { ErrorBanner } from '@/components/error-banner';
import { PrimaryButton } from '@/components/primary-button';
import type { MetaOption } from '@/services/meta-api';

// '해당 없음'·'없음'은 서버 값이 아니라 replace-all PUT의 빈 배열로 표현한다. 알러지 폼도 같은 값을 쓴다.
export const NONE_VALUE = 'none';

// '없음'은 다른 칩과 함께 고를 수 없다. 질병·알러지 폼이 같은 규칙을 쓴다.
export function toggleExclusive(previous: string[], value: string): string[] {
  if (value === NONE_VALUE) {
    return previous.includes(NONE_VALUE) ? [] : [NONE_VALUE];
  }

  const withoutNone = previous.filter((item) => item !== NONE_VALUE);

  return withoutNone.includes(value)
    ? withoutNone.filter((item) => item !== value)
    : [...withoutNone, value];
}

// 온보딩 질환·질병 정보 수정이 같이 쓰는 폼. 불러오기·저장·이동은 화면이 한다.
// children 은 질병 칩 바로 아래(신장병 병기 블록)에 그린다 — 두 화면의 문구·모양이 달라 화면이 그린다.
// onSkip 을 넘기면 저장 버튼 아래에 '건너뛰기'를 붙인다(온보딩).
export function ConditionForm({
  options,
  savedCodes,
  selectedValues,
  onChange,
  isLoadingOptions = false,
  errorMessage,
  isSaving,
  saveLabel,
  onSave,
  onSkip,
  children,
}: {
  options: MetaOption[];
  savedCodes?: string[];
  selectedValues: string[];
  onChange: (update: (previous: string[]) => string[]) => void;
  isLoadingOptions?: boolean;
  errorMessage: string | null;
  isSaving: boolean;
  saveLabel: string;
  onSave: (conditions: string[]) => void;
  onSkip?: () => void;
  children?: ReactNode;
}) {
  // 저장값(표준 code)을 label로 표시한다. 메타 목록에 없는 code는 code 그대로 칩을 만든다.
  const chipOptions = useMemo(() => {
    const knownCodes = new Set(options.map((option) => option.code));
    const unknownSaved = (savedCodes ?? [])
      .filter((code) => !knownCodes.has(code) && code !== NONE_VALUE)
      .map((code) => ({ value: code, label: code }));

    return [
      ...options.map((option) => ({ value: option.code, label: option.label })),
      ...unknownSaved,
      { value: NONE_VALUE, label: '해당 없음' },
    ];
  }, [options, savedCodes]);

  // '해당 없음'은 앱 전용 값 — 서버로는 표준 code만 보낸다.
  const submit = () => onSave(selectedValues.filter((value) => value !== NONE_VALUE));

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

      {children}

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          케어테이블은 의료 서비스가 아닙니다. 진단·처방을 대신하지 않으며, 치료 중이라면 반드시
          의료진과 상의하세요.
        </Text>
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
