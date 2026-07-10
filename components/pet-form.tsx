import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChipGroup } from '@/components/chip-group';

// 반려동물 등록·수정 화면이 공유하는 폼.
// components/는 services/를 import 하지 않으므로 (docs/ARCHITECTURE.md 의존성 방향),
// 값 타입을 여기서 구조적으로 선언한다. services/pet-api.ts의 PetUpsertRequest와 호환된다.
export type PetFormValue = {
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed: string | null;
  birth_year: number | null;
  weight_kg: number | null;
  is_neutered: boolean | null;
};

const SPECIES_OPTIONS = [
  { value: 'dog', label: '강아지' },
  { value: 'cat', label: '고양이' },
  { value: 'other', label: '기타' },
];

const NEUTERED_OPTIONS = [
  { value: 'yes', label: '했어요' },
  { value: 'no', label: '안 했어요' },
  { value: 'unknown', label: '모름' },
];

function toNeuteredValue(isNeutered: boolean | null): string {
  if (isNeutered === true) {
    return 'yes';
  }

  if (isNeutered === false) {
    return 'no';
  }

  return 'unknown';
}

export function PetForm({
  initial,
  submitLabel,
  isSaving,
  onSubmit,
}: {
  initial?: PetFormValue;
  submitLabel: string;
  isSaving: boolean;
  onSubmit: (value: PetFormValue) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [species, setSpecies] = useState<PetFormValue['species'] | null>(initial?.species ?? null);
  const [breed, setBreed] = useState(initial?.breed ?? '');
  const [birthYearText, setBirthYearText] = useState(
    initial?.birth_year === null || initial?.birth_year === undefined
      ? ''
      : String(initial.birth_year)
  );
  const [weightText, setWeightText] = useState(
    initial?.weight_kg === null || initial?.weight_kg === undefined
      ? ''
      : String(initial.weight_kg)
  );
  const [neutered, setNeutered] = useState(toNeuteredValue(initial?.is_neutered ?? null));

  const trimmedName = name.trim();
  const birthYear = birthYearText === '' ? null : Number(birthYearText);
  const weight = weightText === '' ? null : Number(weightText);
  // 서버 제약(pet_schema): birth_year 1980~2100, weight_kg 0 초과 200 이하.
  const isBirthYearValid =
    birthYear === null || (Number.isInteger(birthYear) && birthYear >= 1980 && birthYear <= 2100);
  const isWeightValid = weight === null || (Number.isFinite(weight) && weight > 0 && weight <= 200);
  const isValid =
    trimmedName.length > 0 && trimmedName.length <= 50 && species !== null && isBirthYearValid && isWeightValid;

  const submit = () => {
    if (!isValid || species === null) {
      return;
    }

    onSubmit({
      name: trimmedName,
      species,
      breed: breed.trim() === '' ? null : breed.trim(),
      birth_year: birthYear,
      weight_kg: weight,
      is_neutered: neutered === 'yes' ? true : neutered === 'no' ? false : null,
    });
  };

  return (
    <View style={styles.form}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>이름</Text>
        <View style={styles.inputRow}>
          <TextInput
            maxLength={50}
            onChangeText={setName}
            placeholder="콩이"
            placeholderTextColor="#b0b8c1"
            style={styles.input}
            value={name}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>종류</Text>
        <ChipGroup
          onToggle={(value) => {
            if (value === 'dog' || value === 'cat' || value === 'other') {
              setSpecies(value);
            }
          }}
          options={SPECIES_OPTIONS}
          selectedValues={species === null ? [] : [species]}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>품종 (선택)</Text>
        <View style={styles.inputRow}>
          <TextInput
            maxLength={50}
            onChangeText={setBreed}
            placeholder="말티즈"
            placeholderTextColor="#b0b8c1"
            style={styles.input}
            value={breed}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>태어난 해 (선택)</Text>
        <View style={styles.inputRow}>
          <TextInput
            keyboardType="numeric"
            maxLength={4}
            onChangeText={setBirthYearText}
            placeholder="2021"
            placeholderTextColor="#b0b8c1"
            style={styles.input}
            value={birthYearText}
          />
          <Text style={styles.unit}>년</Text>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>몸무게 (선택)</Text>
        <View style={styles.inputRow}>
          <TextInput
            keyboardType="numeric"
            onChangeText={setWeightText}
            placeholder="4.2"
            placeholderTextColor="#b0b8c1"
            style={styles.input}
            value={weightText}
          />
          <Text style={styles.unit}>kg</Text>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>중성화</Text>
        <ChipGroup onToggle={setNeutered} options={NEUTERED_OPTIONS} selectedValues={[neutered]} />
      </View>

      <Pressable
        disabled={!isValid || isSaving}
        onPress={submit}
        style={({ pressed }) => [
          styles.primaryButton,
          (!isValid || isSaving) && styles.primaryButtonDisabled,
          pressed && styles.pressed,
        ]}>
        {isSaving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.primaryButtonText}>{submitLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  input: {
    color: '#191f28',
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
    borderColor: '#e5e8eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  label: {
    color: '#4e5968',
    fontSize: 14,
    fontWeight: '700',
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
  unit: {
    color: '#8b95a1',
    fontSize: 14,
    fontWeight: '700',
  },
});
