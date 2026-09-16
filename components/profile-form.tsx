import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { ErrorBanner } from '@/components/error-banner';
import { PrimaryButton } from '@/components/primary-button';
import type { ActivityLevel, ProfileRequest, ProfileResponse, Sex } from '@/services/health-api';

const SEX_OPTIONS = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
];

// 라벨만 2026-09-16(KCAL-32)에 바꿨다 — 값(activity_level)과 서버의 활동 계수는 그대로다.
// 내 정보 화면이 같은 라벨을 다시 쓰므로 여기서 내보낸다(예전에는 두 파일에 따로 적혀 있어
// 한쪽만 고쳐질 수 있었다).
export const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: '가벼운 산책만 해요' },
  { value: 'light', label: '주 1~2회 운동해요' },
  { value: 'moderate', label: '주 2~3회 운동해요' },
  { value: 'active', label: '주 4회 이상 운동해요' },
  { value: 'very_active', label: '거의 매일 운동해요' },
];

// 온보딩 신체 정보·프로필 수정이 같이 쓰는 폼. 불러오기·저장·이동은 화면이 한다.
// initial 은 마운트할 때 한 번만 읽는다 — 화면이 불러오기를 끝낸 뒤에 그려야 한다.
// minAge 가 0 보다 크면 그 나이 미만의 태어난 해를 막고 안내를 띄운다(온보딩만 넘긴다).
export function ProfileForm({
  initial = null,
  minAge = 0,
  note,
  saveLabel,
  isSaving,
  errorMessage,
  onSave,
}: {
  initial?: ProfileResponse | null;
  minAge?: number;
  note?: string;
  saveLabel: string;
  isSaving: boolean;
  errorMessage: string | null;
  onSave: (input: ProfileRequest) => void;
}) {
  const [heightText, setHeightText] = useState(initial === null ? '' : String(initial.height_cm));
  const [weightText, setWeightText] = useState(initial === null ? '' : String(initial.weight_kg));
  const [birthYearText, setBirthYearText] = useState(
    initial === null ? '' : String(initial.birth_year),
  );
  const [sex, setSex] = useState<Sex | null>(initial?.sex ?? null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(
    initial?.activity_level ?? null,
  );

  const currentYear = new Date().getFullYear();
  const height = Number(heightText);
  const weight = Number(weightText);
  const birthYear = Number(birthYearText);
  const isValid =
    sex !== null &&
    activityLevel !== null &&
    Number.isFinite(height) &&
    height >= 80 &&
    height <= 250 &&
    Number.isFinite(weight) &&
    weight >= 20 &&
    weight <= 300 &&
    Number.isInteger(birthYear) &&
    birthYear >= 1900 &&
    birthYear <= currentYear - minAge;

  // 태어난 해를 넣었는데 연령 미달이면 그 사실을 먼저 알린다 — 저장 버튼만 꺼두면 왜 안
  // 되는지 알 수 없다. 최종 판단은 서버가 한다(400). minAge 가 0 이면 항상 false 다.
  const isUnderage =
    Number.isInteger(birthYear) && birthYear > currentYear - minAge && birthYear <= currentYear;

  const submit = () => {
    if (sex === null || activityLevel === null) {
      return;
    }

    onSave({
      sex,
      birth_year: birthYear,
      height_cm: height,
      weight_kg: weight,
      activity_level: activityLevel,
    });
  };

  return (
    <>
      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>키</Text>
          <View style={styles.inputRow}>
            <TextInput
              keyboardType="numeric"
              onChangeText={setHeightText}
              placeholder="175"
              placeholderTextColor="#a9a6a1"
              style={styles.input}
              value={heightText}
            />
            <Text style={styles.unit}>cm</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>몸무게</Text>
          <View style={styles.inputRow}>
            <TextInput
              keyboardType="numeric"
              onChangeText={setWeightText}
              placeholder="70.5"
              placeholderTextColor="#a9a6a1"
              style={styles.input}
              value={weightText}
            />
            <Text style={styles.unit}>kg</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>태어난 해</Text>
          <View style={styles.inputRow}>
            <TextInput
              keyboardType="numeric"
              maxLength={4}
              onChangeText={setBirthYearText}
              placeholder="1993"
              placeholderTextColor="#a9a6a1"
              style={styles.input}
              value={birthYearText}
            />
            <Text style={styles.unit}>년</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>성별</Text>
          <ChipGroup
            onToggle={(value) => {
              if (value === 'male' || value === 'female') {
                setSex(value);
              }
            }}
            options={SEX_OPTIONS}
            selectedValues={sex === null ? [] : [sex]}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>활동량</Text>
          <ChipGroup
            onToggle={(value) => {
              if (
                value === 'sedentary' ||
                value === 'light' ||
                value === 'moderate' ||
                value === 'active' ||
                value === 'very_active'
              ) {
                setActivityLevel(value);
              }
            }}
            options={ACTIVITY_OPTIONS}
            selectedValues={activityLevel === null ? [] : [activityLevel]}
          />
        </View>
      </View>

      {note === undefined ? null : (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{note}</Text>
        </View>
      )}

      {isUnderage ? (
        <View style={styles.noteBox}>
          <Text style={styles.underageText}>
            만 {minAge}세 미만은 가입할 수 없어요. 이 서비스는 성인 진료지침을 기준으로 식단을
            안내하고 질병 정보를 다뤄요.
          </Text>
        </View>
      ) : null}

      {errorMessage ? <ErrorBanner message={errorMessage} onRetry={submit} /> : null}

      <PrimaryButton disabled={!isValid} label={saveLabel} loading={isSaving} onPress={submit} />
    </>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  input: {
    color: '#22211f',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    paddingVertical: 14,
  },
  inputGroup: {
    gap: 8,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e4e2de',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  label: {
    color: '#5c5b57',
    fontSize: 14,
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
  underageText: {
    color: '#b8524e',
    fontSize: 13,
    lineHeight: 19,
  },
  unit: {
    color: '#a9a6a1',
    fontSize: 14,
    fontWeight: '700',
  },
});
