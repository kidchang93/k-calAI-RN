import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { ChunkyButton } from '@/components/chunky-button';
import { DayNutrientsCard } from '@/components/day-nutrients-card';
import { DetailHeader } from '@/components/detail-header';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { NutrientChip, NutrientChips } from '@/components/nutrient-chips';
import { QuantityEditor, QuantityValue } from '@/components/quantity-editor';
import { Screen } from '@/components/screen';
import { INTAKE_ESTIMATE_NOTICE } from '@/constants/ai-notice';
import { isMealType, MEAL_TYPE_LABELS, MEAL_TYPES, MealType } from '@/constants/meal';
import { NUTRIENT_LABELS } from '@/constants/nutrition';
import { TAB_TONES } from '@/constants/tab-tone';
import { DISPLAY_FONT } from '@/constants/typography';
import { formatFoodLabel } from '@/services/food-label';
import { confirmDialog } from '@/services/dialog';
import { formatIsoTime, formatMonthDay } from '@/services/format';
import {
  DayNutrients,
  deleteMeal,
  estimateNutrition,
  formatDateParam,
  getMeals,
  getSummary,
  MealItem,
  MealItemSource,
  MealLog,
  updateMeal,
} from '@/services/health-api';

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = MEAL_TYPES.map((value) => ({
  value,
  label: MEAL_TYPE_LABELS[value],
}));

// 인라인 수정 폼의 항목. 양 편집 상태(food_label·kcalText·serving_ratio·unit·serving_size_g·
// basePerServing)는 끼니 구성과 같은 QuantityEditor를 쓰도록 QuantityValue로 담는다. source·
// confidence는 QuantityValue 밖이라 그대로 보존해 다시 보낸다 (PUT은 전체 교체).
type EditItem = QuantityValue & {
  key: number;
  source: MealItemSource;
  confidence: number | null;
};

export default function MealListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; from?: string }>();
  // 홈·캘린더가 넘긴 날짜(YYYY-MM-DD)만 신뢰한다. 형식이 다르면 오늘로 폴백.
  const date =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : formatDateParam(new Date());
  // 같은 화면이 두 탭에서 열린다 — 케어 탭 도장판이면 '← 케어'(청록), 그 외(식단 탭 채운 칸·
  // 어제 요약)는 '← 식단'(주황). 들어온 방의 색을 잃지 않게 한다.
  const tone = params.from === 'care' ? 'care' : 'meal';
  const toneStyle = TAB_TONES[tone];

  // 새 끼니: 빈 끼니 칸 → compose(meal_id 없음). 기존 끼니에 항목 더하기: compose append(meal_id·meal_type).
  // 케어 탭에서 들어왔으면 기록 화면에도 그대로 넘긴다 — 뒤로가기가 들어온 탭을 말하게.
  const fromParams = tone === 'care' ? { from: 'care' } : {};
  const openNewMeal = (mealType: MealType) =>
    router.push({ pathname: '/meals/compose', params: { date, meal_type: mealType, ...fromParams } });
  const openAppendMeal = (meal: MealLog) =>
    router.push({
      pathname: '/meals/compose',
      params: { date, meal_id: String(meal.id), meal_type: meal.meal_type, ...fromParams },
    });

  const [meals, setMeals] = useState<MealLog[]>([]);
  // 그날의 질환 축 누적. 질환이 없으면 서버가 null 을 주고 카드가 나타나지 않는다.
  const [nutrients, setNutrients] = useState<DayNutrients | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [editMealType, setEditMealType] = useState<MealType>('breakfast');
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  // estimate 재조회 중인 항목 key(로딩 표시용). 저장된 항목엔 serving_size_g·basePerServing이
  // 없어 수정 진입 때 이름으로 다시 조회해 인분/g 조정을 연다.
  const [editLookupKeys, setEditLookupKeys] = useState<number[]>([]);
  // 수정 세션 시퀀스 — 다른 끼니로 편집을 바꾸거나 취소하면 늦게 온 estimate 응답을 무시한다.
  const editSeqRef = useRef(0);

  const loadMeals = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await getMeals(date);

      // 서버 정렬을 신뢰하지 않는다 — 먹은 시각 순으로 보여준다. 시각이 같으면(과거 날짜는
      // UTC 정오로 앵커된다) id 순 — 이 동점 처리가 없으면 항목을 더한 끼니가 맨 뒤로 밀린다.
      setMeals(
        [...result].sort((a, b) => a.logged_at.localeCompare(b.logged_at) || a.id - b.id)
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }

    // 하루 누적은 **기록 조회와 독립적으로** 다룬다. 403(민감정보 미동의)·네트워크 오류로
    // 끼니 목록까지 막히면 안 된다 — 홈의 다음 끼니 추천과 같은 규약이다.
    try {
      setNutrients((await getSummary(date)).nutrients);
    } catch {
      setNutrients(null);
    }
  }, [date]);

  // 기록 화면에서 저장하고 돌아왔을 때 갱신되도록 포커스마다 다시 읽는다 (홈 화면 패턴).
  useFocusEffect(
    useCallback(() => {
      void loadMeals();
    }, [loadMeals])
  );

  const startEdit = (meal: MealLog) => {
    const seq = ++editSeqRef.current;

    setEditingMealId(meal.id);
    setEditMealType(meal.meal_type);

    // 저장값엔 serving_size_g·basePerServing이 없다 → 인분 모드 폴백으로 먼저 그리고,
    // 각 이름을 estimate로 재조회해 채워지면 인분/g 조정이 열린다.
    const items: EditItem[] = meal.items.map((item) => ({
      key: item.id,
      food_label: item.food_label,
      kcalText: String(item.kcal),
      serving_ratio: item.serving_ratio,
      unit: 'serving',
      serving_size_g: null,
      basePerServing: null,
      source: item.source,
      confidence: item.confidence,
    }));

    setEditItems(items);
    setEditLookupKeys(items.filter((item) => item.food_label.trim() !== '').map((item) => item.key));
    items.forEach((item) => void fillQuantityBase(seq, item.key, item.food_label));
  };

  const cancelEdit = () => {
    editSeqRef.current += 1;
    setEditingMealId(null);
    setEditItems([]);
    setEditLookupKeys([]);
  };

  // 저장된 항목 이름으로 estimate를 다시 조회해 serving_size_g·basePerServing을 채운다(쿼터 0).
  // kcalText는 저장값 그대로 두고(표시 kcal 유지) 양 조정 기준만 확보한다. 404/503/오류면
  // serving_size_g=null로 남겨 인분 모드로 동작한다.
  const fillQuantityBase = async (seq: number, key: number, foodLabel: string) => {
    const name = foodLabel.trim();

    if (name === '') {
      return;
    }

    try {
      const estimate = await estimateNutrition(name);

      if (editSeqRef.current !== seq) {
        return;
      }

      setEditItems((prev) =>
        prev.map((item) =>
          item.key === key
            ? {
                ...item,
                serving_size_g: estimate.serving_size_g,
                basePerServing: Math.round(estimate.kcal_per_serving),
              }
            : item
        )
      );
    } catch {
      // 미매칭(404)·일시 장애(503)·오류면 그대로 둔다 — 인분 모드로 기록/수정한다.
    } finally {
      setEditLookupKeys((prev) => prev.filter((current) => current !== key));
    }
  };

  // QuantityEditor가 양 편집을 마친 값을 병합한다. key·source·confidence는 QuantityValue 밖이라 보존된다.
  const applyQuantity = (key: number, next: QuantityValue) => {
    setEditItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...next } : item)));
  };

  // PUT은 전체 교체라 남은 항목만 다시 보내면 그 항목은 끼니에서 빠진다. 마지막 항목까지 지우면
  // isEditValid가 false가 돼 저장이 비활성된다(취소로 되돌린다).
  const removeEditItem = (key: number) => {
    setEditItems((prev) => prev.filter((item) => item.key !== key));
    setEditLookupKeys((prev) => prev.filter((current) => current !== key));
  };

  const isEditValid =
    editItems.length > 0 &&
    editItems.every((item) => {
      const kcal = Number(item.kcalText);

      return (
        item.food_label.trim().length > 0 && Number.isFinite(kcal) && kcal >= 0 && kcal <= 99999
      );
    });

  const saveEdit = async () => {
    if (editingMealId === null || !isEditValid) {
      return;
    }

    setIsSavingEdit(true);
    setErrorMessage(null);

    try {
      // logged_at을 보내지 않으면 서버가 기존 기록 시각을 유지한다 (DATA_MODEL.md 4장).
      await updateMeal(editingMealId, {
        meal_type: editMealType,
        items: editItems.map((item) => ({
          food_label: item.food_label.trim(),
          serving_ratio: item.serving_ratio,
          kcal: Math.round(Number(item.kcalText)),
          source: item.source,
          confidence: item.confidence,
        })),
      });
      // 진행 중인 estimate 재조회가 닫힌 폼에 뒤늦게 반영되지 않도록 세션을 무효화한다.
      editSeqRef.current += 1;
      setEditingMealId(null);
      setEditItems([]);
      setEditLookupKeys([]);
      await loadMeals();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const confirmDelete = async (meal: MealLog) => {
    const label = MEAL_TYPE_LABELS[meal.meal_type];

    const confirmed = await confirmDialog({
      title: '기록 삭제',
      message: `${label} 기록(${meal.total_kcal.toLocaleString()} kcal)을 삭제할까요? 되돌릴 수 없습니다.`,
      confirmLabel: '삭제',
      destructive: true,
    });

    if (confirmed) {
      await removeMeal(meal.id);
    }
  };

  const removeMeal = async (mealId: number) => {
    setDeletingId(mealId);
    setErrorMessage(null);

    try {
      await deleteMeal(mealId);
      // 삭제 후 재조회. 홈 합계는 복귀 시 useFocusEffect가 갱신한다.
      await loadMeals();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalKcal = meals.reduce((sum, meal) => sum + meal.total_kcal, 0);
  const isToday = date === formatDateParam(new Date());
  // 기록이 없는 끼니 자리. 빈 날도 이 칸들로 바로 채울 수 있다(예전 '기록 추가' 버튼을 대신한다).
  const emptyMealTypes = MEAL_TYPES.filter((type) => !meals.some((meal) => meal.meal_type === type));
  const isBusy = deletingId !== null || isSavingEdit;

  return (
    <Screen gap={16} keyboard="persistTaps">
      <DetailHeader
        caption={isLoading ? null : `끼니 ${meals.length}개 · ${totalKcal.toLocaleString()} kcal`}
        title={isToday ? '오늘의 식탁' : `${formatMonthDay(date)}의 식탁`}
        tone={tone}
      />

      {/* 질환 축 누적을 **kcal 합계 바로 아래**에 둔다 — 만성질환자에게는 이 숫자가 더
          중요하다(홈에서 칼로리 링 아래 놓은 것과 같은 이유). 이 카드가 없던 동안 지난
          기록은 kcal 만 말했고, 경고는 저장하는 순간에만 보였다 (`CARE_LOOP.md` §0-3). */}
      <DayNutrientsCard nutrients={nutrients} title={isToday ? '오늘의 영양' : '이날의 영양'} />

      {errorMessage ? (
        <ErrorBanner message={errorMessage} onRetry={() => void loadMeals()} />
      ) : null}

      {isLoading ? (
        <LoadingState label="끼니 기록을 불러오는 중입니다." />
      ) : (
        <>
          {meals.length === 0 ? (
            <View style={styles.stateBox}>
              <MaterialIcons color="#a9a6a1" name="no-meals" size={32} />
              <Text style={styles.stateText}>
                아직 기록이 없어요. 식단 탭의 끼니 칸에서 사진으로 남겨 보세요.
              </Text>
            </View>
          ) : (
            meals.map((meal) => (
              <View key={meal.id} style={styles.mealCard}>
                <View style={styles.mealHeader}>
                  <View accessibilityLabel="도장 받음" style={styles.stamp}>
                    <MaterialIcons color="#4a3200" name="check" size={18} />
                  </View>
                  <View style={styles.mealTitle}>
                    <Text style={styles.mealTypeLabel}>{MEAL_TYPE_LABELS[meal.meal_type]}</Text>
                    <Text style={styles.mealTime}>{formatIsoTime(meal.logged_at)}</Text>
                  </View>
                  <Text style={styles.mealKcal}>{`${meal.total_kcal.toLocaleString()} kcal`}</Text>
                </View>

                {editingMealId === meal.id ? (
                  <View style={styles.editBox}>
                    <Text style={styles.editSectionLabel}>끼니</Text>
                    <ChipGroup
                      options={MEAL_TYPE_OPTIONS}
                      selectedValues={[editMealType]}
                      onToggle={(value) => selectEditMealType(value, setEditMealType)}
                    />

                    {editItems.map((item) => (
                      <QuantityEditor
                        key={item.key}
                        value={item}
                        isLookingUp={editLookupKeys.includes(item.key)}
                        onChange={(next) => applyQuantity(item.key, next)}
                        onRemove={() => removeEditItem(item.key)}
                      />
                    ))}

                    <View style={styles.editActions}>
                      <View style={styles.editAction}>
                        <ChunkyButton
                          disabled={isSavingEdit}
                          label="취소"
                          onPress={cancelEdit}
                          tone={tone}
                          variant="outline"
                        />
                      </View>
                      <View style={styles.editAction}>
                        <ChunkyButton
                          disabled={!isEditValid}
                          label="저장"
                          loading={isSavingEdit}
                          onPress={() => void saveEdit()}
                          tone={tone}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.itemList}>
                      {meal.items.map((item) => (
                        <View key={item.id} style={styles.itemBlock}>
                          <View style={styles.itemRow}>
                            <Text style={styles.itemLabel}>
                              {formatFoodLabel(item.food_label)}
                              {/* AI기본법 제31조② — 사진 인식으로 담은 항목은 지난 기록에서도 밝힌다. */}
                              {item.source === 'ai' ? (
                                <Text style={styles.aiTag}>{'  AI 인식'}</Text>
                              ) : null}
                            </Text>
                            <Text style={styles.itemMeta}>
                              {`${item.serving_ratio}인분 · ${item.kcal.toLocaleString()} kcal`}
                            </Text>
                          </View>
                          <NutrientChips chips={itemNutrientChips(item)} />
                        </View>
                      ))}
                    </View>

                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityLabel={`${MEAL_TYPE_LABELS[meal.meal_type]}에 더 담기`}
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => openAppendMeal(meal)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          { backgroundColor: toneStyle.tint, borderColor: toneStyle.tint },
                          pressed && styles.pressed,
                        ]}>
                        <Text style={[styles.actionText, { color: toneStyle.text }]}>+ 더 담기</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => startEdit(meal)}
                        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                        <Text style={styles.actionText}>고치기</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => void confirmDelete(meal)}
                        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                        {deletingId === meal.id ? (
                          <ActivityIndicator color="#b8524e" size="small" />
                        ) : (
                          <Text style={[styles.actionText, styles.deleteText]}>지우기</Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ))
          )}

          {/* 빈 칸은 점선 — 코랄을 쓰지 않는다(벌이 아니다, DESIGN.md '탭 색·게임 톤'). */}
          {emptyMealTypes.length > 0 ? (
            <View style={styles.slotGrid}>
              {emptyMealTypes.map((type) => (
                <Pressable
                  key={type}
                  accessibilityLabel={`${MEAL_TYPE_LABELS[type]} 남기기`}
                  accessibilityRole="button"
                  onPress={() => openNewMeal(type)}
                  style={({ pressed }) => [styles.slot, pressed && styles.pressed]}>
                  <Text style={styles.slotLabel}>{MEAL_TYPE_LABELS[type]}</Text>
                  <Text style={styles.slotText}>남기기</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}

      <Text style={styles.disclaimer}>{INTAKE_ESTIMATE_NOTICE}</Text>
    </Screen>
  );
}

function selectEditMealType(value: string, setEditMealType: (value: MealType) => void) {
  if (isMealType(value)) {
    setEditMealType(value);
  }
}

// 저장된 항목 → 수치 칩.
//
// ⚠️ **기록 화면(compose)과 달리 serving_ratio 를 곱하지 않는다.** 저장된 스냅샷은 이미
// **먹은 양 기준**이기 때문이다(서버 `models/health_model.py` 리비전 0025 주석). compose 는
// 1인분 실측을 받아 화면에서 곱하지만 여기 값은 곱셈이 끝난 값이라, 또 곱하면 2인분을 먹은
// 것으로 보인다.
//
// 등급(tier)이 전부 null 이라 칩은 회색이다 — 등급은 굳히지 않고 조회 시점 규칙으로 다시
// 판정하기로 했고(`kcalAI-model/docs/CARE_LOOP.md` §0-3), 과거 기록에 그 재판정을 붙이는 것은
// 아직 하지 않았다. 상한 대비 위치는 위의 하루 누적 카드(게이지)가 말해 준다.
function itemNutrientChips(item: MealItem): NutrientChip[] {
  const chips: NutrientChip[] = [];

  const milligrams: [string, number | null][] = [
    [NUTRIENT_LABELS.sodium, item.sodium_mg],
    [NUTRIENT_LABELS.potassium, item.potassium_mg],
    [NUTRIENT_LABELS.phosphorus, item.phosphorus_mg],
  ];

  for (const [label, value] of milligrams) {
    // null 은 "실측을 못 찾았다"는 뜻이다. 0으로 그리면 먹지 않았다는 거짓말이 된다.
    if (value !== null) {
      chips.push({ label, value: `${Math.round(value).toLocaleString()}mg`, tier: null });
    }
  }

  // 당류만 단위가 g 다 (서버 경고 API 의 nutrient_unit 과 같은 규약).
  if (item.sugar_g !== null) {
    chips.push({
      label: NUTRIENT_LABELS.sugar,
      value: `${Math.round(item.sugar_g * 10) / 10}g`,
      tier: null,
    });
  }

  return chips;
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e4e2de',
    borderRadius: 12,
    borderWidth: 2,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 6,
  },
  actionRow: {
    borderTopColor: '#f7f6f4',
    borderTopWidth: 2,
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
  },
  actionText: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '800',
  },
  aiTag: {
    color: '#2a7d76',
    fontSize: 15,
    fontWeight: '800',
  },
  deleteText: {
    color: '#b8524e',
  },
  disclaimer: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  editAction: {
    flex: 1,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editBox: {
    gap: 10,
  },
  editSectionLabel: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '800',
  },
  // 이름·kcal 한 줄 아래에 수치 칩이 붙으므로 바깥은 세로, 안쪽 한 줄만 가로다.
  itemBlock: {
    backgroundColor: '#f7f6f4',
    borderRadius: 12,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemLabel: {
    color: '#22211f',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  itemList: {
    gap: 8,
  },
  itemMeta: {
    color: '#5c5b57',
    fontSize: 15,
  },
  itemRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  mealCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 10,
    padding: 14,
  },
  mealHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  mealKcal: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  mealTime: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '800',
  },
  mealTitle: {
    alignItems: 'baseline',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  mealTypeLabel: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
  },
  pressed: {
    opacity: 0.74,
  },
  slot: {
    alignItems: 'center',
    borderColor: '#a9a6a1',
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 2,
    flexBasis: '40%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    minHeight: 64,
    paddingHorizontal: 14,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  slotLabel: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
  },
  slotText: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '800',
  },
  // 도장 — 식단 탭 끼니 칸(home.tsx `stamp`)과 같은 모양을 한 치수 작게.
  stamp: {
    alignItems: 'center',
    backgroundColor: '#ffc83d',
    borderColor: '#d9a200',
    borderRadius: 17,
    borderWidth: 3,
    height: 34,
    justifyContent: 'center',
    transform: [{ rotate: '-12deg' }],
    width: 34,
  },
  stateBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 12,
    padding: 28,
  },
  stateText: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
