import { StyleSheet, Text, View } from 'react-native';

import { NUTRIENT_TIER_LABELS } from '@/constants/nutrition';
import { NutrientTier } from '@/services/recommendation-api';

// 영양 수치 칩. 추천 카드와 끼니 구성 항목이 **같은 모양**으로 수치를 보이도록 공용화한다.
// 등급(tier)이 있으면 색과 낮음/보통/높음을 함께 그리고, 없으면 회색으로 숫자만 담담하게 둔다
// (kcalAI-model/docs/CKD_NUTRITION.md 3-4·3-5).
export type NutrientChip = {
  label: string;
  value: string;
  tier: NutrientTier | null;
};

export function NutrientChips({ chips }: { chips: NutrientChip[] }) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <View style={styles.row}>
      {chips.map((chip) => (
        <View key={chip.label} style={[styles.chip, chip.tier && TIER_CHIP_STYLES[chip.tier]]}>
          <Text style={styles.label}>{chip.label}</Text>
          <Text style={[styles.value, chip.tier && TIER_TEXT_STYLES[chip.tier]]}>{chip.value}</Text>
          {chip.tier ? (
            <Text style={[styles.tier, TIER_TEXT_STYLES[chip.tier]]}>
              {NUTRIENT_TIER_LABELS[chip.tier]}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'baseline',
    backgroundColor: '#f2f4f6',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  label: {
    color: '#8b95a1',
    fontSize: 11,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tier: {
    fontSize: 11,
    fontWeight: '800',
  },
  tierChipHigh: {
    backgroundColor: '#fff1e9',
  },
  tierChipLow: {
    backgroundColor: '#e9f8f0',
  },
  tierChipMid: {
    backgroundColor: '#fff6e5',
  },
  tierTextHigh: {
    color: '#d4571a',
  },
  tierTextLow: {
    color: '#0f8a5f',
  },
  tierTextMid: {
    color: '#b8770c',
  },
  value: {
    color: '#4e5968',
    fontSize: 12,
    fontWeight: '800',
  },
});

// styles 를 참조하므로 선언 이후에 둔다.
const TIER_CHIP_STYLES: Record<NutrientTier, object> = {
  low: styles.tierChipLow,
  mid: styles.tierChipMid,
  high: styles.tierChipHigh,
};

const TIER_TEXT_STYLES: Record<NutrientTier, object> = {
  low: styles.tierTextLow,
  mid: styles.tierTextMid,
  high: styles.tierTextHigh,
};
