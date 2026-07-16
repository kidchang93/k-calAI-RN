import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { confirmDialog } from '@/services/dialog';
import {
  deleteMeal,
  formatDateParam,
  getMeals,
  MealItemSource,
  MealLog,
  MealType,
  updateMeal,
} from '@/services/health-api';

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

const MEAL_TYPE_ICONS: Record<MealType, keyof typeof MaterialIcons.glyphMap> = {
  breakfast: 'wb-sunny',
  lunch: 'restaurant',
  dinner: 'dinner-dining',
  snack: 'cookie',
};

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// 인라인 수정 폼의 항목. serving_ratio·source·confidence는 그대로 보존하고
// 이름·kcal만 고친다 (PUT은 전체 교체라 보존 필드도 함께 보내야 한다).
type EditItem = {
  key: number;
  food_label: string;
  kcalText: string;
  serving_ratio: number;
  source: MealItemSource;
  confidence: number | null;
};

export default function MealListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  // 홈·캘린더가 넘긴 날짜(YYYY-MM-DD)만 신뢰한다. 형식이 다르면 오늘로 폴백.
  const date =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : formatDateParam(new Date());

  // 새 끼니: compose(meal_id 없음). 기존 끼니에 항목 더하기: compose append(meal_id·meal_type).
  const openAddMeal = () => router.push({ pathname: '/meals/compose', params: { date } });
  const openAppendMeal = (meal: MealLog) =>
    router.push({
      pathname: '/meals/compose',
      params: { date, meal_id: String(meal.id), meal_type: meal.meal_type },
    });

  const [meals, setMeals] = useState<MealLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [editMealType, setEditMealType] = useState<MealType>('breakfast');
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadMeals = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await getMeals(date);

      // 서버 정렬을 신뢰하지 않는다 — 먹은 시각 순으로 보여준다.
      setMeals([...result].sort((a, b) => a.logged_at.localeCompare(b.logged_at)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  // 기록 탭에서 저장하고 돌아왔을 때 갱신되도록 포커스마다 다시 읽는다 (홈 화면 패턴).
  useFocusEffect(
    useCallback(() => {
      void loadMeals();
    }, [loadMeals])
  );

  const startEdit = (meal: MealLog) => {
    setEditingMealId(meal.id);
    setEditMealType(meal.meal_type);
    setEditItems(
      meal.items.map((item) => ({
        key: item.id,
        food_label: item.food_label,
        kcalText: String(item.kcal),
        serving_ratio: item.serving_ratio,
        source: item.source,
        confidence: item.confidence,
      }))
    );
  };

  const cancelEdit = () => {
    setEditingMealId(null);
    setEditItems([]);
  };

  const updateEditItem = (key: number, patch: Partial<Pick<EditItem, 'food_label' | 'kcalText'>>) => {
    setEditItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
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
      setEditingMealId(null);
      setEditItems([]);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>{formatDateTitle(date)}</Text>
            <Text style={styles.subtitle}>
              {meals.length === 0
                ? '이날 저장된 끼니 기록을 보여드려요.'
                : `총 ${totalKcal.toLocaleString()} kcal · ${meals.length}건`}
            </Text>
          </View>

          {/* 빈 날짜에도 새 끼니를 남길 수 있어야 한다 — 항상 노출한다. */}
          <Pressable
            onPress={openAddMeal}
            style={({ pressed }) => [styles.addMealButton, pressed && styles.pressed]}>
            <MaterialIcons color="#ffffff" name="add" size={20} />
            <Text style={styles.addMealButtonText}>기록 추가</Text>
          </Pressable>

          {errorMessage ? (
            <ErrorBanner message={errorMessage} onRetry={() => void loadMeals()} />
          ) : null}

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>끼니 기록을 불러오는 중입니다.</Text>
            </View>
          ) : meals.length === 0 ? (
            <View style={styles.stateBox}>
              <MaterialIcons color="#b0b8c1" name="no-meals" size={32} />
              <Text style={styles.stateText}>
                아직 기록이 없어요. 기록 탭에서 사진으로 남겨보세요.
              </Text>
            </View>
          ) : (
            <View style={styles.section}>
              {meals.map((meal) => (
                <View key={meal.id} style={styles.mealCard}>
                  <View style={styles.mealHeader}>
                    <View style={styles.mealIconWrap}>
                      <MaterialIcons
                        color="#3182f6"
                        name={MEAL_TYPE_ICONS[meal.meal_type]}
                        size={18}
                      />
                    </View>
                    <View style={styles.mealHeaderBody}>
                      <Text style={styles.mealTypeLabel}>{MEAL_TYPE_LABELS[meal.meal_type]}</Text>
                      <Text style={styles.mealTime}>{formatTime(meal.logged_at)}</Text>
                    </View>
                    <Text style={styles.mealKcal}>{`${meal.total_kcal.toLocaleString()} kcal`}</Text>
                    <Pressable
                      accessibilityLabel="이 끼니에 항목 추가"
                      disabled={deletingId !== null || isSavingEdit}
                      hitSlop={8}
                      onPress={() => openAppendMeal(meal)}
                      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                      <MaterialIcons color="#3182f6" name="add-circle-outline" size={20} />
                    </Pressable>
                    <Pressable
                      disabled={deletingId !== null || isSavingEdit}
                      hitSlop={8}
                      onPress={() => (editingMealId === meal.id ? cancelEdit() : startEdit(meal))}
                      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                      <MaterialIcons
                        color={editingMealId === meal.id ? '#3182f6' : '#6b7684'}
                        name={editingMealId === meal.id ? 'close' : 'edit'}
                        size={20}
                      />
                    </Pressable>
                    <Pressable
                      disabled={deletingId !== null || isSavingEdit}
                      hitSlop={8}
                      onPress={() => confirmDelete(meal)}
                      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                      {deletingId === meal.id ? (
                        <ActivityIndicator color="#e5484d" size="small" />
                      ) : (
                        <MaterialIcons color="#e5484d" name="delete-outline" size={20} />
                      )}
                    </Pressable>
                  </View>

                  {editingMealId === meal.id ? (
                    <View style={styles.editBox}>
                      <View style={styles.mealTypeRow}>
                        {MEAL_TYPES.map((type) => (
                          <Pressable
                            key={type}
                            onPress={() => setEditMealType(type)}
                            style={({ pressed }) => [
                              styles.mealTypeChip,
                              editMealType === type && styles.mealTypeChipSelected,
                              pressed && styles.pressed,
                            ]}>
                            <Text
                              style={[
                                styles.mealTypeChipText,
                                editMealType === type && styles.mealTypeChipTextSelected,
                              ]}>
                              {MEAL_TYPE_LABELS[type]}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      {editItems.map((item) => (
                        <View key={item.key} style={styles.editItemRow}>
                          <TextInput
                            maxLength={100}
                            onChangeText={(text) => updateEditItem(item.key, { food_label: text })}
                            placeholder="음식 이름"
                            placeholderTextColor="#b0b8c1"
                            style={styles.editNameInput}
                            value={item.food_label}
                          />
                          <View style={styles.editKcalWrap}>
                            <TextInput
                              keyboardType="numeric"
                              maxLength={5}
                              onChangeText={(text) => updateEditItem(item.key, { kcalText: text })}
                              placeholder="0"
                              placeholderTextColor="#b0b8c1"
                              style={styles.editKcalInput}
                              value={item.kcalText}
                            />
                            <Text style={styles.editKcalUnit}>kcal</Text>
                          </View>
                        </View>
                      ))}

                      <View style={styles.editActions}>
                        <Pressable
                          disabled={isSavingEdit}
                          onPress={cancelEdit}
                          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                          <Text style={styles.cancelButtonText}>취소</Text>
                        </Pressable>
                        <Pressable
                          disabled={!isEditValid || isSavingEdit}
                          onPress={() => void saveEdit()}
                          style={({ pressed }) => [
                            styles.saveButton,
                            (!isEditValid || isSavingEdit) && styles.saveButtonDisabled,
                            pressed && styles.pressed,
                          ]}>
                          {isSavingEdit ? (
                            <ActivityIndicator color="#ffffff" size="small" />
                          ) : (
                            <Text style={styles.saveButtonText}>저장</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    meal.items.map((item) => (
                      <View key={item.id} style={styles.itemRow}>
                        <Text style={styles.itemLabel}>{item.food_label}</Text>
                        <Text style={styles.itemMeta}>
                          {`${item.serving_ratio}인분 · ${item.kcal.toLocaleString()} kcal`}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              ))}
            </View>
          )}

          <Text style={styles.disclaimer}>AI 추정값이며 실제와 다를 수 있습니다.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// YYYY-MM-DD → 'M월 D일 기록'
function formatDateTitle(date: string): string {
  const [, month, day] = date.split('-');

  return `${Number(month)}월 ${Number(day)}일 기록`;
}

// 서버의 UTC ISO 문자열을 기기 로컬 시각(HH:MM)으로 표시한다.
function formatTime(isoText: string): string {
  const parsed = new Date(isoText);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

const styles = StyleSheet.create({
  addMealButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    height: 50,
    justifyContent: 'center',
  },
  addMealButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#4e5968',
    fontSize: 15,
    fontWeight: '800',
  },
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  disclaimer: {
    color: '#8b95a1',
    fontSize: 13,
    textAlign: 'center',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editBox: {
    gap: 10,
  },
  editItemRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editKcalInput: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '700',
    minWidth: 48,
    paddingVertical: 10,
    textAlign: 'right',
  },
  editKcalUnit: {
    color: '#8b95a1',
    fontSize: 13,
    fontWeight: '700',
  },
  editKcalWrap: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e8eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
  },
  editNameInput: {
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
  header: {
    gap: 4,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
  },
  itemLabel: {
    color: '#333d4b',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  itemMeta: {
    color: '#6b7684',
    fontSize: 13,
  },
  itemRow: {
    alignItems: 'center',
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mealCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 16,
  },
  mealHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  mealHeaderBody: {
    flex: 1,
    gap: 2,
  },
  mealIconWrap: {
    alignItems: 'center',
    backgroundColor: '#edf6ff',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  mealKcal: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
  },
  mealTime: {
    color: '#8b95a1',
    fontSize: 12,
  },
  mealTypeChip: {
    alignItems: 'center',
    backgroundColor: '#f2f4f6',
    borderRadius: 999,
    flex: 1,
    paddingVertical: 8,
  },
  mealTypeChipSelected: {
    backgroundColor: '#edf6ff',
  },
  mealTypeChipText: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  mealTypeChipTextSelected: {
    color: '#3182f6',
  },
  mealTypeLabel: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pressed: {
    opacity: 0.74,
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#b4c7e7',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    gap: 10,
  },
  stateBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 32,
  },
  stateText: {
    color: '#6b7684',
    fontSize: 14,
    textAlign: 'center',
  },
  subtitle: {
    color: '#6b7684',
    fontSize: 14,
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
});
