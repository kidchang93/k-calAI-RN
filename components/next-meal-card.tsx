import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatFoodLabel } from '@/services/food-label';
import { MealType } from '@/services/health-api';
import { DietRecommendation } from '@/services/recommendation-api';

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

// 홈의 '다음 끼니 추천' 카드.
//
// 예전에는 그룹 진입과 나란한 **회색 리스트 행 하나**였다. 화면에서 비중이 가장 낮은 요소인데,
// 정작 내용은 질환별 제외·칼륨/인 등급·조리 팁까지 담긴 가장 밀도 높은 화면이었다. 경고가
// "먹지 마세요"라면 추천은 "이건 드셔도 돼요"다 — 만성질환자에게 후자가 더 쓸모 있다.
//
// **추천을 못 불러와도 카드는 남는다.** 진입 자체가 막히면 안 되고(403 미동의·네트워크 실패),
// 그때는 설명만 있는 카드가 된다. 미리보기는 있으면 좋은 것이지 전제가 아니다.
export function NextMealCard({
  mealType,
  recommendation,
  onPress,
}: {
  mealType: MealType;
  recommendation: DietRecommendation | null;
  onPress: () => void;
}) {
  // 홈에서는 2개까지만 — 더 보여주면 카드가 화면을 먹고, 고르는 건 추천 화면의 일이다.
  const preview = recommendation?.items.slice(0, 2) ?? [];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.headRow}>
        <MaterialIcons color="#3182f6" name="restaurant-menu" size={20} />
        <Text style={styles.title}>{`${MEAL_TYPE_LABELS[mealType]}, 뭐 드실까요`}</Text>
        <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
      </View>

      {preview.length === 0 ? (
        <Text style={styles.subtitle}>남은 칼로리와 건강 정보에 맞춰 골라드려요.</Text>
      ) : (
        <>
          <View style={styles.itemList}>
            {preview.map((item) => (
              <View key={item.name} style={styles.item}>
                <Text numberOfLines={1} style={styles.itemName}>
                  {formatFoodLabel(item.name)}
                </Text>
                <Text style={styles.itemKcal}>{`${item.kcal.toLocaleString()} kcal`}</Text>
              </View>
            ))}
          </View>

          {/* 제외 조건이 반영됐다는 사실은 이 카드의 신뢰 근거다 — 알러지·질병이 걸러진 뒤의
              목록이라는 걸 알아야 안심하고 고른다. */}
          {excludedLabels(recommendation).length > 0 ? (
            <Text style={styles.excluded}>
              {`${excludedLabels(recommendation).join(' · ')} 반영해서 고른 메뉴예요`}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function excludedLabels(recommendation: DietRecommendation | null): string[] {
  return (recommendation?.excluded ?? [])
    .filter((entry) => entry.type === 'allergen' || entry.type === 'condition')
    .map((entry) => (entry.type === 'filtered' ? '' : entry.label))
    .filter((label) => label !== '');
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 18,
  },
  excluded: {
    color: '#3182f6',
    fontSize: 12,
    fontWeight: '700',
  },
  headRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  item: {
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemKcal: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  itemList: {
    gap: 8,
  },
  itemName: {
    color: '#191f28',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  subtitle: {
    color: '#6b7684',
    fontSize: 13,
  },
  title: {
    color: '#191f28',
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
});
