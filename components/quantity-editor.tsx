import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { Segmented } from '@/components/segmented';

// 양을 인분으로 고를지, g으로 직접 입력할지. g은 serving_size_g(1인분=몇 g)로 인분 비율로 환산한다.
export type QuantityUnit = 'serving' | 'gram';

// 한 항목의 양 편집 상태. 저장 페이로드에는 serving_ratio + (kcalText→kcal)만 나가고
// unit·serving_size_g·basePerServing은 UI 전용이다. 끼니 구성·기록 수정이 공유한다.
export type QuantityValue = {
  food_label: string;
  // 현재 선택한 인분(serving_ratio)의 총 kcal(문자열, 편집 가능). 인분·g을 바꾸면 스케일된다.
  kcalText: string;
  serving_ratio: number;
  unit: QuantityUnit;
  // 1인분이 몇 g(estimate 응답). null이면 g 입력 불가 → 인분 모드 고정.
  serving_size_g: number | null;
  // 1인분당 kcal(정수). 인분/g 스케일 시 매번 여기서 절대 계산해 반올림 누적을 막는다.
  // null=기준 미상(직접 입력·estimate 실패)→이전 kcal 기준 누적 폴백.
  basePerServing: number | null;
};

const SERVING_RATIO_OPTIONS: { value: string; label: string; ratio: number }[] = [
  { value: '0.5', label: '0.5인분', ratio: 0.5 },
  { value: '1', label: '1인분', ratio: 1 },
  { value: '1.5', label: '1.5인분', ratio: 1.5 },
  { value: '2', label: '2인분', ratio: 2 },
];

const UNIT_OPTIONS: { value: QuantityUnit; label: string }[] = [
  { value: 'serving', label: '인분' },
  { value: 'gram', label: 'g' },
];

// g 모드 증감 스테퍼 폭.
const GRAM_STEP = 50;

export function QuantityEditor({
  value,
  isLookingUp,
  portionHint,
  onChange,
  onLabelBlur,
  onRemove,
}: {
  value: QuantityValue;
  isLookingUp: boolean;
  // 인식 사진이 추정한 대략 g(끼니 구성 전용). 없으면 표시하지 않는다.
  portionHint?: number | null;
  onChange: (next: QuantityValue) => void;
  onLabelBlur?: () => void;
  onRemove: () => void;
}) {
  const servingSize = value.serving_size_g;
  const gramMode = servingSize !== null && value.unit === 'gram';
  // 현재 인분(serving_ratio)에 해당하는 g. serving_size_g 미상이면 null.
  const derivedGram = servingSize !== null ? Math.round(value.serving_ratio * servingSize) : null;

  // g 입력은 자유롭게 지우고 쓸 수 있어야 해 로컬 텍스트로 다룬다. 편집 중이 아니면 serving_ratio
  // 에서 파생한 g을 그대로 보여준다(외부에서 인분을 바꿔도 따라간다).
  const [gramText, setGramText] = useState('');
  const [isEditingGram, setIsEditingGram] = useState(false);

  const changeLabel = (text: string) => onChange({ ...value, food_label: text });

  // 사용자가 총 kcal을 직접 고치면 그 값은 현재 serving_ratio 기준이므로 1인분 기준으로
  // 되돌려 basePerServing을 재동기화한다. 이래야 편집 후 양을 바꿔도 편집값이 기준이 된다.
  const changeKcal = (text: string) => {
    const next: QuantityValue = { ...value, kcalText: text };
    const parsed = Number(text.trim());

    if (text.trim() !== '' && Number.isFinite(parsed) && value.serving_ratio > 0) {
      next.basePerServing = Math.round(parsed / value.serving_ratio);
    }

    onChange(next);
  };

  // 인분↔g 토글. serving_ratio는 그대로 두고 표시 단위만 바꾼다(kcal 불변).
  const selectUnit = (unit: QuantityUnit) => onChange({ ...value, unit });

  const selectServing = (ratio: number) => {
    if (ratio === value.serving_ratio) {
      return;
    }

    // 1인분 기준 kcal(basePerServing)을 알면 매번 거기서 절대 계산한다 — 이전 값 기준 누적
    // 스케일은 중간 반올림이 쌓인다. 기준을 모르면(직접 입력) 이전 값 기준 누적으로 폴백한다.
    let kcalText = value.kcalText;

    if (value.basePerServing !== null) {
      kcalText = String(Math.round(value.basePerServing * ratio));
    } else {
      const current = Number(value.kcalText.trim());
      const canScale =
        value.kcalText.trim() !== '' && Number.isFinite(current) && value.serving_ratio > 0;

      if (canScale) {
        kcalText = String(Math.round((current * ratio) / value.serving_ratio));
      }
    }

    onChange({ ...value, serving_ratio: ratio, kcalText });
  };

  const applyGram = (grams: number) => {
    if (servingSize === null || servingSize <= 0) {
      return;
    }

    const ratio = grams / servingSize;

    // 0·음수·NaN·무한대는 무시한다(selectServing의 kcal 스케일을 그대로 재사용).
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return;
    }

    selectServing(ratio);
  };

  const changeGramText = (text: string) => {
    setGramText(text);

    const grams = Number(text.trim());

    if (text.trim() !== '' && Number.isFinite(grams) && grams > 0) {
      applyGram(grams);
    }
  };

  const stepGram = (delta: number) => {
    const base = derivedGram ?? servingSize ?? 0;
    const next = Math.max(GRAM_STEP, base + delta);
    setGramText(String(next));
    applyGram(next);
  };

  const gramValue = isEditingGram ? gramText : derivedGram !== null ? String(derivedGram) : '';

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <TextInput
          maxLength={100}
          onChangeText={changeLabel}
          onEndEditing={onLabelBlur}
          placeholder="음식 이름 (입력하면 칼로리 자동)"
          placeholderTextColor="#b0b8c1"
          style={styles.nameInput}
          value={value.food_label}
        />
        <Pressable
          hitSlop={8}
          onPress={onRemove}
          style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
          <MaterialIcons color="#e5484d" name="delete-outline" size={20} />
        </Pressable>
      </View>

      {servingSize !== null ? (
        <Segmented compact onChange={selectUnit} options={UNIT_OPTIONS} value={value.unit} />
      ) : isLookingUp ? (
        <Text style={styles.unitNotice}>제공량 정보를 불러오는 중이에요</Text>
      ) : (
        <Text style={styles.unitNotice}>1회 제공량 정보가 없어 인분으로 기록해요</Text>
      )}

      {gramMode ? (
        <View style={styles.gramRow}>
          <Pressable
            onPress={() => stepGram(-GRAM_STEP)}
            style={({ pressed }) => [styles.gramStepButton, pressed && styles.pressed]}>
            <MaterialIcons color="#3182f6" name="remove" size={18} />
          </Pressable>
          <View style={styles.gramField}>
            <TextInput
              keyboardType="number-pad"
              maxLength={5}
              onBlur={() => setIsEditingGram(false)}
              onChangeText={changeGramText}
              onFocus={() => {
                setIsEditingGram(true);
                setGramText(derivedGram !== null ? String(derivedGram) : '');
              }}
              placeholder="그램"
              placeholderTextColor="#b0b8c1"
              style={styles.gramInput}
              value={gramValue}
            />
            <Text style={styles.gramUnit}>g</Text>
          </View>
          <Pressable
            onPress={() => stepGram(GRAM_STEP)}
            style={({ pressed }) => [styles.gramStepButton, pressed && styles.pressed]}>
            <MaterialIcons color="#3182f6" name="add" size={18} />
          </Pressable>
        </View>
      ) : (
        <ChipGroup
          options={SERVING_RATIO_OPTIONS}
          selectedValues={[String(value.serving_ratio)]}
          onToggle={(option) => selectServing(servingRatioOf(option))}
        />
      )}

      {!gramMode && portionHint !== null && portionHint !== undefined ? (
        <Text style={styles.portion}>{`대략 ${Math.round(portionHint)}g 정도로 보여요`}</Text>
      ) : null}

      <View style={styles.kcalRow}>
        <View style={styles.kcalField}>
          <TextInput
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={changeKcal}
            placeholder="칼로리"
            placeholderTextColor="#b0b8c1"
            style={styles.kcalInput}
            value={value.kcalText}
          />
          <Text style={styles.kcalUnit}>kcal</Text>
        </View>
        {isLookingUp ? <Text style={styles.lookup}>영양 정보 불러오는 중…</Text> : null}
      </View>
    </View>
  );
}

function servingRatioOf(value: string): number {
  const option = SERVING_RATIO_OPTIONS.find((item) => item.value === value);

  return option ? option.ratio : 1;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 16,
  },
  gramField: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e8eb',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  gramInput: {
    color: '#191f28',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 10,
    textAlign: 'right',
  },
  gramRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  gramStepButton: {
    alignItems: 'center',
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 46,
  },
  gramUnit: {
    color: '#8b95a1',
    fontSize: 12,
    fontWeight: '700',
  },
  headRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  kcalField: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e8eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
  },
  kcalInput: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '700',
    minWidth: 56,
    paddingVertical: 10,
    textAlign: 'right',
  },
  kcalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kcalUnit: {
    color: '#8b95a1',
    fontSize: 12,
    fontWeight: '700',
  },
  lookup: {
    color: '#8b95a1',
    fontSize: 13,
    fontWeight: '700',
  },
  nameInput: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e8eb',
    borderRadius: 8,
    borderWidth: 1,
    color: '#191f28',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  portion: {
    color: '#8b95a1',
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.74,
  },
  removeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
  },
  unitNotice: {
    color: '#8b95a1',
    fontSize: 12,
    fontWeight: '700',
  },
});
