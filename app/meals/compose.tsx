import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ChipGroup } from '@/components/chip-group';
import { ErrorBanner } from '@/components/error-banner';
import { PlanLimitBanner } from '@/components/plan-limit-banner';
import { FoodDetection, PhotoAsset, uploadFoodPhoto } from '@/services/calorie-api';
import { notifyDialog } from '@/services/dialog';
import {
  checkFoodWarnings,
  createMeal,
  dayAnchorLoggedAt,
  estimateNutrition,
  FoodWarning,
  formatDateParam,
  getMeals,
  MealItem,
  MealItemSource,
  MealType,
  NutritionNotFoundError,
  NutritionUnavailableError,
  updateMeal,
} from '@/services/health-api';
import { PlanLimitError } from '@/services/http';

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'snack', label: '간식' },
];

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

const SERVING_RATIO_OPTIONS: { value: string; label: string; ratio: number }[] = [
  { value: '0.5', label: '0.5인분', ratio: 0.5 },
  { value: '1', label: '1인분', ratio: 1 },
  { value: '1.5', label: '1.5인분', ratio: 1.5 },
  { value: '2', label: '2인분', ratio: 2 },
];

// 서버 계약(MealItemInput.kcal)의 상한.
const MAX_KCAL = 100000;

// 사진 1장에서 인식된 여러 음식을 각각 항목으로 나눌지. 분할 로직(foods[] → 항목 N개)은
// 구현돼 있으나 지금은 원래대로 '한 객체(대표 음식 1개)'로 담는다. true 로 바꾸면 켜진다.
const MULTI_FOOD_SPLIT = false;

// 초안 항목. kcalText는 **1인분 기준** kcal(문자열, 편집 가능)이고, 저장·표시 kcal은
// round(kcalText × serving_ratio)로 파생한다.
type Draft = {
  key: string;
  food_label: string;
  kcalText: string;
  serving_ratio: number;
  source: MealItemSource;
  confidence: number | null;
  portion_g: number | null;
};

// 현재 시각 기준 끼니 기본값. 사용자가 칩에서 언제든 바꿀 수 있다.
function defaultMealType(): MealType {
  const hour = new Date().getHours();

  if (hour < 11) {
    return 'breakfast';
  }

  if (hour < 16) {
    return 'lunch';
  }

  if (hour < 22) {
    return 'dinner';
  }

  return 'snack';
}

let draftKeySeq = 0;
function nextDraftKey(): string {
  draftKeySeq += 1;

  return `draft-${Date.now()}-${draftKeySeq}`;
}

// 초안 → 저장·표시용 총 kcal. 유효하지 않으면 null (저장 버튼 비활성 조건).
function draftKcal(draft: Draft): number | null {
  const trimmed = draft.kcalText.trim();

  if (trimmed === '') {
    return null;
  }

  const per = Number(trimmed);

  if (!Number.isFinite(per) || per < 0) {
    return null;
  }

  return Math.min(MAX_KCAL, Math.max(0, Math.round(per * draft.serving_ratio)));
}

function isDraftValid(draft: Draft): boolean {
  return draft.food_label.trim().length > 0 && draftKcal(draft) !== null;
}

export default function MealComposeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    date?: string;
    meal_type?: string;
    meal_id?: string;
    photoUri?: string;
    photoName?: string;
    photoMime?: string;
  }>();

  // 홈·캘린더·기록관리가 넘긴 날짜(YYYY-MM-DD)만 신뢰한다. 형식이 다르면 오늘로 폴백.
  const date =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : formatDateParam(new Date());

  const mealId =
    typeof params.meal_id === 'string' && /^\d+$/.test(params.meal_id)
      ? Number(params.meal_id)
      : null;
  const isAppend = mealId !== null;

  const initialMealType = MEAL_TYPE_OPTIONS.some((option) => option.value === params.meal_type)
    ? (params.meal_type as MealType)
    : defaultMealType();

  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [searchText, setSearchText] = useState('');
  // 방금 업로드한 사진(로컬 URI). 화면에 보여주기만 하고 서버엔 저장하지 않는다.
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  // 고른 뒤 아직 분석하지 않은 사진. '분석' 버튼을 눌러야 API 요청한다(쿼터 오용 방지).
  const [pendingAsset, setPendingAsset] = useState<PhotoAsset | null>(null);
  // 직접 입력 항목의 이름으로 DB 칼로리를 조회 중인 draft key(로딩 표시용).
  const [lookupKey, setLookupKey] = useState<string | null>(null);

  // append 모드: 기존 끼니 항목은 그대로 보존해 다시 보낸다 (PUT은 전체 교체).
  const [existingItems, setExistingItems] = useState<MealItem[]>([]);
  const [existingMealType, setExistingMealType] = useState<MealType | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(isAppend);
  const [existingLoadFailed, setExistingLoadFailed] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);
  const [visionUsage, setVisionUsage] = useState<{ used: number; limit: number } | null>(null);
  const [warnings, setWarnings] = useState<FoodWarning[]>([]);

  // 사진 자동 분석은 마운트 시 1회만. 라벨이 바뀌면 늦게 온 경고 응답을 무시한다.
  const autoAnalyzedRef = useRef(false);
  const warningSeqRef = useRef(0);
  // 항목 추가·삭제 시점의 '현재 초안'을 setState 업데이터 밖에서 읽기 위한 미러 (경고 조회용).
  const draftsRef = useRef<Draft[]>([]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const loadExisting = useCallback(async () => {
    if (mealId === null) {
      return;
    }

    setIsLoadingExisting(true);
    setExistingLoadFailed(false);
    setErrorMessage(null);

    try {
      const meals = await getMeals(date);
      const target = meals.find((meal) => meal.id === mealId);

      if (target) {
        setExistingItems(target.items);
        setExistingMealType(target.meal_type);
      } else {
        // 이미 삭제됐거나 다른 날짜의 끼니 — 안전하게 실패로 처리한다 (덮어쓰기 방지).
        setExistingLoadFailed(true);
        setErrorMessage('기존 끼니를 찾지 못했습니다. 목록에서 다시 시도해주세요.');
      }
    } catch (error) {
      setExistingLoadFailed(true);
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoadingExisting(false);
    }
  }, [date, mealId]);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  // 라벨 확정 시 백그라운드로 경고를 조회한다 (HEALTHCARE_EXPANSION 12장 — 경고이지 차단이 아니다).
  // 401/403/네트워크 오류는 조용히 스킵한다 (배너 없음).
  const runWarningCheck = useCallback((labels: string[]) => {
    const seq = ++warningSeqRef.current;

    const deduped = Array.from(
      new Set(labels.map((label) => label.trim()).filter((label) => label.length > 0))
    ).slice(0, 10);

    if (deduped.length === 0) {
      setWarnings([]);

      return;
    }

    checkFoodWarnings(deduped)
      .then((result) => {
        if (warningSeqRef.current === seq) {
          setWarnings(result);
        }
      })
      .catch(() => {
        // 경고는 부가 기능 — 실패해도 기록 흐름을 방해하지 않는다.
      });
  }, []);

  const appendDrafts = useCallback(
    (added: Draft[]) => {
      if (added.length === 0) {
        return;
      }

      const next = [...draftsRef.current, ...added];
      draftsRef.current = next;
      setDrafts(next);
      runWarningCheck(next.map((draft) => draft.food_label));
    },
    [runWarningCheck]
  );

  const updateDraft = (key: string, patch: Partial<Pick<Draft, 'food_label' | 'kcalText'>>) => {
    setDrafts((prev) => prev.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
  };

  const setDraftServing = (key: string, ratio: number) => {
    setDrafts((prev) =>
      prev.map((draft) => (draft.key === key ? { ...draft, serving_ratio: ratio } : draft))
    );
  };

  const removeDraft = (key: string) => {
    const next = draftsRef.current.filter((draft) => draft.key !== key);
    draftsRef.current = next;
    setDrafts(next);
    runWarningCheck(next.map((draft) => draft.food_label));
  };

  // 직접 입력 항목: 이름을 다 쓰면 데이터셋에서 칼로리를 조회해 채운다(쿼터 0). kcal이 이미
  // 있으면 덮지 않는다(AI·사용자 값 보존). 404(미매칭)·오류면 조용히 두고 직접 입력하게 한다.
  const lookupDraftKcal = useCallback(async (key: string) => {
    const draft = draftsRef.current.find((item) => item.key === key);

    if (draft === undefined) {
      return;
    }

    const name = draft.food_label.trim();

    if (name === '' || draft.kcalText.trim() !== '') {
      return;
    }

    setLookupKey(key);

    try {
      const estimate = await estimateNutrition(name);
      setDrafts((prev) =>
        prev.map((item) =>
          item.key === key
            ? { ...item, kcalText: String(Math.round(estimate.kcal_per_serving)) }
            : item
        )
      );
    } catch {
      // 미매칭(404)·일시 장애(503)·오류면 그대로 둔다 — 사용자가 직접 칼로리를 입력한다.
    } finally {
      setLookupKey((current) => (current === key ? null : current));
    }
  }, []);

  const analyzePhoto = useCallback(
    async (asset: PhotoAsset) => {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setPlanLimitMessage(null);
      setPreviewUri(asset.uri);

      try {
        const result = await uploadFoodPhoto(asset);

        setVisionUsage(
          result.vision_used !== null && result.vision_limit !== null
            ? { used: result.vision_used, limit: result.vision_limit }
            : null
        );
        setPendingAsset(null); // 분석 완료 — 대기 사진 소비(재분석하려면 다시 고른다).

        if (result.foods.length === 0) {
          notifyDialog('음식을 찾지 못했어요', '다른 사진으로 다시 시도하거나 직접 추가해주세요.');

          return;
        }

        // 분할 로직은 유지하되 기본은 대표 음식 1개만 담는다(MULTI_FOOD_SPLIT). 각 음식은
        // 식약처 DB로 kcal을 조회한다(쿼터 0). 일부가 실패해도 나머지는 살린다.
        const foods = MULTI_FOOD_SPLIT ? result.foods : result.foods.slice(0, 1);
        const added = await Promise.all(foods.map(foodToDraft));
        appendDrafts(added);
      } catch (error) {
        if (error instanceof PlanLimitError) {
          setPlanLimitMessage(error.message);
        } else {
          setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
        }
      } finally {
        setIsAnalyzing(false);
      }
    },
    [appendDrafts]
  );

  // 사진을 고르면 미리보기만 하고, 분석은 '분석' 버튼을 눌러야 시작한다(자동 요청 안 함).
  const selectPhoto = useCallback((asset: PhotoAsset) => {
    setPreviewUri(asset.uri);
    setPendingAsset(asset);
    setErrorMessage(null);
    setPlanLimitMessage(null);
  }, []);

  const runAnalyze = () => {
    if (pendingAsset !== null && !isAnalyzing) {
      void analyzePhoto(pendingAsset);
    }
  };

  // photoUri 파라미터(기록 탭 런처)로 넘어온 사진은 미리보기만 하고, 분석은 버튼으로 시작한다.
  useEffect(() => {
    if (autoAnalyzedRef.current || typeof params.photoUri !== 'string' || params.photoUri === '') {
      return;
    }

    autoAnalyzedRef.current = true;
    selectPhoto({
      uri: params.photoUri,
      fileName: typeof params.photoName === 'string' ? params.photoName : null,
      mimeType: typeof params.photoMime === 'string' ? params.photoMime : null,
    });
  }, [selectPhoto, params.photoMime, params.photoName, params.photoUri]);

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      notifyDialog('카메라 권한 필요', '음식 사진을 촬영하려면 카메라 권한을 허용해주세요.');

      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.86,
    });

    if (!result.canceled) {
      selectPhoto(toPhotoAsset(result.assets[0]));
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      notifyDialog('사진 권한 필요', '앨범에서 음식 사진을 선택하려면 사진 접근 권한을 허용해주세요.');

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.86,
    });

    if (!result.canceled) {
      selectPhoto(toPhotoAsset(result.assets[0]));
    }
  };

  const addBySearch = async () => {
    const name = searchText.trim();

    if (name === '') {
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);

    try {
      const estimate = await estimateNutrition(name);
      appendDrafts([
        {
          key: nextDraftKey(),
          food_label: estimate.food_label,
          kcalText: String(Math.round(estimate.kcal_per_serving)),
          serving_ratio: 1,
          source: 'manual',
          confidence: null,
          portion_g: null,
        },
      ]);
      setSearchText('');
    } catch (error) {
      if (error instanceof NutritionNotFoundError) {
        // 미매칭은 오류가 아니다 — 입력한 이름으로 빈 kcal 초안을 추가해 직접 입력을 잇는다.
        appendDrafts([
          {
            key: nextDraftKey(),
            food_label: name,
            kcalText: '',
            serving_ratio: 1,
            source: 'manual',
            confidence: null,
            portion_g: null,
          },
        ]);
        setSearchText('');
        notifyDialog('영양 정보를 찾지 못했어요', '칼로리를 직접 입력해주세요.');
      } else if (error instanceof NutritionUnavailableError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const addManual = () => {
    setErrorMessage(null);
    appendDrafts([
      {
        key: nextDraftKey(),
        food_label: '',
        kcalText: '',
        serving_ratio: 1,
        source: 'manual',
        confidence: null,
        portion_g: null,
      },
    ]);
  };

  const canSave =
    drafts.length > 0 &&
    drafts.every(isDraftValid) &&
    !isSaving &&
    !isAnalyzing &&
    !isLoadingExisting &&
    !existingLoadFailed;

  const saveMeal = async () => {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const newItems = drafts.map((draft) => ({
        food_label: draft.food_label.trim(),
        serving_ratio: draft.serving_ratio,
        kcal: draftKcal(draft) ?? 0,
        source: draft.source,
        confidence: draft.confidence,
      }));

      if (isAppend && mealId !== null) {
        const preserved = existingItems.map((item) => ({
          food_label: item.food_label,
          serving_ratio: item.serving_ratio,
          kcal: item.kcal,
          source: item.source,
          confidence: item.confidence,
        }));

        // logged_at 생략 → 서버가 기존 기록 시각을 유지한다 (전체 교체의 유일한 예외).
        await updateMeal(mealId, {
          meal_type: existingMealType ?? mealType,
          items: [...preserved, ...newItems],
        });
      } else {
        // 과거 날짜 셀에서도 그 날짜로 보이도록 UTC 정오로 앵커한다 (services/health-api.ts).
        await createMeal({
          meal_type: mealType,
          logged_at: dayAnchorLoggedAt(date),
          items: newItems,
        });
      }

      // 이전 화면(기록관리·캘린더·기록 탭)이 useFocusEffect로 재조회한다.
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalKcal = drafts.reduce((sum, draft) => sum + (draftKcal(draft) ?? 0), 0);
  const existingTotal = existingItems.reduce((sum, item) => sum + item.kcal, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>{isAppend ? '항목 추가' : '기록 추가'}</Text>
            <Text style={styles.subtitle}>
              {isAppend
                ? `${formatDateTitle(date)} · ${existingMealType ? MEAL_TYPE_LABELS[existingMealType] : ''} 끼니에 더하기`
                : `${formatDateTitle(date)}에 새 끼니를 남겨요`}
            </Text>
          </View>

          {isLoadingExisting ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>기존 끼니를 불러오는 중입니다.</Text>
            </View>
          ) : null}

          {isAppend && existingItems.length > 0 ? (
            <View style={styles.existingCard}>
              <View style={styles.existingHeadRow}>
                <Text style={styles.existingTitle}>기존 항목</Text>
                <Text style={styles.existingTotal}>{`${existingTotal.toLocaleString()} kcal`}</Text>
              </View>
              {existingItems.map((item) => (
                <View key={item.id} style={styles.existingRow}>
                  <Text style={styles.existingLabel} numberOfLines={1}>
                    {item.food_label}
                  </Text>
                  <Text style={styles.existingKcal}>{`${item.kcal.toLocaleString()} kcal`}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {isAppend ? null : (
            <View style={styles.choiceSection}>
              <Text style={styles.choiceLabel}>끼니</Text>
              <ChipGroup
                options={MEAL_TYPE_OPTIONS}
                selectedValues={[mealType]}
                onToggle={(value) => selectMealType(value, setMealType)}
              />
            </View>
          )}

          {previewUri ? (
            <View style={styles.previewCard}>
              <Image resizeMode="cover" source={{ uri: previewUri }} style={styles.previewImage} />
              <Text style={styles.previewCaption}>분석한 사진 · 서버에 저장되지 않아요</Text>
            </View>
          ) : null}

          <View style={styles.addCard}>
            <Text style={styles.addTitle}>항목 추가</Text>
            <Text style={styles.addHint}>
              한 끼에 여러 메뉴를 담을 수 있어요. 사진은 고른 뒤 분석 버튼을 눌러야 인식되고, 인식 1건당 1건이 차감돼요.
            </Text>

            {visionUsage !== null ? (
              <Text style={styles.usageText}>
                {`오늘 사진 인식 ${visionUsage.used}/${visionUsage.limit}건 · ${Math.max(visionUsage.limit - visionUsage.used, 0)}건 남음`}
              </Text>
            ) : null}

            <View style={styles.addActionGrid}>
              <AddActionButton
                disabled={isAnalyzing}
                icon="photo-camera"
                label="촬영"
                onPress={() => void pickFromCamera()}
              />
              <AddActionButton
                disabled={isAnalyzing}
                icon="photo-library"
                label="앨범"
                onPress={() => void pickFromLibrary()}
              />
            </View>

            {pendingAsset ? (
              <Pressable
                disabled={isAnalyzing}
                onPress={runAnalyze}
                style={({ pressed }) => [
                  styles.analyzeButton,
                  isAnalyzing && styles.analyzeButtonDisabled,
                  pressed && !isAnalyzing && styles.pressed,
                ]}>
                <MaterialIcons color="#ffffff" name="restaurant-menu" size={18} />
                <Text style={styles.analyzeButtonText}>이 사진 분석하기</Text>
              </Pressable>
            ) : null}

            {isAnalyzing ? (
              <View style={styles.analyzingRow}>
                <ActivityIndicator color="#3182f6" size="small" />
                <Text style={styles.analyzingText}>사진 속 음식을 분석하고 있어요.</Text>
              </View>
            ) : null}

            <View style={styles.searchRow}>
              <TextInput
                onChangeText={setSearchText}
                onSubmitEditing={() => void addBySearch()}
                placeholder="음식 이름으로 검색 (무료)"
                placeholderTextColor="#8b95a1"
                returnKeyType="search"
                style={styles.searchInput}
                value={searchText}
              />
              <Pressable
                disabled={isSearching || searchText.trim() === ''}
                onPress={() => void addBySearch()}
                style={({ pressed }) => [
                  styles.searchButton,
                  (isSearching || searchText.trim() === '') && styles.searchButtonDisabled,
                  pressed && styles.pressed,
                ]}>
                {isSearching ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.searchButtonText}>추가</Text>
                )}
              </Pressable>
            </View>

            <Pressable
              onPress={addManual}
              style={({ pressed }) => [styles.manualAddButton, pressed && styles.pressed]}>
              <MaterialIcons color="#3182f6" name="edit" size={18} />
              <Text style={styles.manualAddText}>직접 입력으로 추가</Text>
            </Pressable>
          </View>

          {planLimitMessage ? (
            <PlanLimitBanner message={planLimitMessage} onUpgrade={() => router.push('/plan')} />
          ) : null}

          {errorMessage ? (
            <ErrorBanner
              message={errorMessage}
              onRetry={existingLoadFailed ? () => void loadExisting() : () => setErrorMessage(null)}
            />
          ) : null}

          {warnings.length > 0 ? (
            <View style={styles.warningBox}>
              <MaterialIcons color="#e5484d" name="warning-amber" size={20} />
              <View style={styles.warningBody}>
                {warnings.map((warning) => (
                  <Text
                    key={`${warning.source}-${warning.code}-${warning.matched_label}`}
                    style={styles.warningText}>
                    {formatWarning(warning)}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          {drafts.length === 0 ? (
            <View style={styles.emptyDraftBox}>
              <MaterialIcons color="#b0b8c1" name="restaurant" size={28} />
              <Text style={styles.emptyDraftText}>
                위에서 사진·검색·직접 입력으로 먹은 메뉴를 추가해주세요.
              </Text>
            </View>
          ) : (
            <View style={styles.draftSection}>
              {drafts.map((draft) => (
                <DraftCard
                  key={draft.key}
                  draft={draft}
                  isLookingUp={lookupKey === draft.key}
                  onChangeKcal={(text) => updateDraft(draft.key, { kcalText: text })}
                  onChangeLabel={(text) => updateDraft(draft.key, { food_label: text })}
                  onLookupKcal={() => void lookupDraftKcal(draft.key)}
                  onRemove={() => removeDraft(draft.key)}
                  onSelectServing={(ratio) => setDraftServing(draft.key, ratio)}
                  total={draftKcal(draft)}
                />
              ))}
            </View>
          )}

          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>합계</Text>
              <Text style={styles.totalValue}>{`${totalKcal.toLocaleString()} kcal`}</Text>
            </View>
            <Pressable
              disabled={!canSave}
              onPress={() => void saveMeal()}
              style={({ pressed }) => [
                styles.saveButton,
                !canSave && styles.saveButtonDisabled,
                pressed && canSave && styles.pressed,
              ]}>
              {isSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <MaterialIcons color="#ffffff" name="check" size={20} />
                  <Text style={styles.saveButtonText}>{isAppend ? '항목 추가 저장' : '기록 저장'}</Text>
                </>
              )}
            </Pressable>
          </View>

          <Text style={styles.disclaimer}>AI 추정값이며 실제와 다를 수 있습니다.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function selectMealType(value: string, setMealType: (value: MealType) => void) {
  const option = MEAL_TYPE_OPTIONS.find((item) => item.value === value);

  if (option) {
    setMealType(option.value);
  }
}

function toPhotoAsset(asset: ImagePicker.ImagePickerAsset): PhotoAsset {
  return { uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType };
}

// 인식된 음식 1건 → 초안. estimate 성공이면 매칭 DB 이름·kcal을, 실패(404/503/기타)면 라벨만
// 살리고 kcal은 비워 직접 입력을 유도한다 (일부 실패해도 나머지를 살린다).
async function foodToDraft(food: FoodDetection): Promise<Draft> {
  const confidence = Math.max(0, Math.min(1, food.score));

  try {
    const estimate = await estimateNutrition(food.label);

    return {
      key: nextDraftKey(),
      food_label: estimate.food_label,
      kcalText: String(Math.round(estimate.kcal_per_serving)),
      serving_ratio: 1,
      source: 'ai',
      confidence,
      portion_g: food.portion_g,
    };
  } catch {
    return {
      key: nextDraftKey(),
      food_label: food.label,
      kcalText: '',
      serving_ratio: 1,
      source: 'ai',
      confidence,
      portion_g: food.portion_g,
    };
  }
}

function AddActionButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.addActionButton,
        disabled && styles.addActionButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <MaterialIcons color="#3182f6" name={icon} size={22} />
      <Text style={styles.addActionLabel}>{label}</Text>
    </Pressable>
  );
}

function DraftCard({
  draft,
  total,
  isLookingUp,
  onChangeLabel,
  onChangeKcal,
  onLookupKcal,
  onSelectServing,
  onRemove,
}: {
  draft: Draft;
  total: number | null;
  isLookingUp: boolean;
  onChangeLabel: (text: string) => void;
  onChangeKcal: (text: string) => void;
  onLookupKcal: () => void;
  onSelectServing: (ratio: number) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.draftCard}>
      <View style={styles.draftHeadRow}>
        <TextInput
          maxLength={100}
          onChangeText={onChangeLabel}
          onEndEditing={onLookupKcal}
          placeholder="음식 이름 (입력하면 칼로리 자동)"
          placeholderTextColor="#b0b8c1"
          style={styles.draftNameInput}
          value={draft.food_label}
        />
        <Pressable
          hitSlop={8}
          onPress={onRemove}
          style={({ pressed }) => [styles.draftRemoveButton, pressed && styles.pressed]}>
          <MaterialIcons color="#e5484d" name="delete-outline" size={20} />
        </Pressable>
      </View>

      {draft.portion_g !== null ? (
        <Text style={styles.draftPortion}>{`대략 ${Math.round(draft.portion_g)}g 정도로 보여요`}</Text>
      ) : null}

      <ChipGroup
        options={SERVING_RATIO_OPTIONS}
        selectedValues={[String(draft.serving_ratio)]}
        onToggle={(value) => onSelectServing(servingRatioOf(value))}
      />

      <View style={styles.draftKcalRow}>
        <View style={styles.draftKcalField}>
          <TextInput
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={onChangeKcal}
            placeholder="1인분 kcal"
            placeholderTextColor="#b0b8c1"
            style={styles.draftKcalInput}
            value={draft.kcalText}
          />
          <Text style={styles.draftKcalUnit}>kcal/인분</Text>
        </View>
        <Text style={styles.draftTotal}>
          {isLookingUp
            ? '칼로리 찾는 중…'
            : total !== null
              ? `${total.toLocaleString()} kcal`
              : '칼로리 입력'}
        </Text>
      </View>
    </View>
  );
}

function servingRatioOf(value: string): number {
  const option = SERVING_RATIO_OPTIONS.find((item) => item.value === value);

  return option ? option.ratio : 1;
}

// 경고 1건 → 1줄. allergy는 "계란 알러지: …", condition은 "당뇨 주의: …" (DATA_MODEL.md 16장).
function formatWarning(warning: FoodWarning): string {
  const prefix = warning.source === 'allergy' ? `${warning.label} 알러지` : `${warning.label} 주의`;

  return `${prefix}: '${warning.matched_label}'에 ${warning.matched_keyword}${subjectParticle(warning.matched_keyword)} 포함될 수 있어요`;
}

// 주격 조사(이/가) — 마지막 글자의 받침 유무로 고른다. 한글이 아니면 병기 폴백.
function subjectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1);

  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 === 0 ? '가' : '이';
  }

  return '이(가)';
}

// YYYY-MM-DD → 'M월 D일'
function formatDateTitle(date: string): string {
  const [, month, day] = date.split('-');

  return `${Number(month)}월 ${Number(day)}일`;
}

const styles = StyleSheet.create({
  addActionButton: {
    alignItems: 'center',
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  addActionButtonDisabled: {
    opacity: 0.5,
  },
  addActionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  addActionLabel: {
    color: '#3182f6',
    fontSize: 15,
    fontWeight: '800',
  },
  addCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 16,
  },
  addHint: {
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 18,
  },
  addTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '800',
  },
  analyzeButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#b4c7e7',
  },
  analyzeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  analyzingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  analyzingText: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  choiceLabel: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '800',
  },
  choiceSection: {
    gap: 8,
  },
  container: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 720,
    width: '100%',
  },
  disclaimer: {
    color: '#8b95a1',
    fontSize: 13,
    textAlign: 'center',
  },
  draftCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 16,
  },
  draftHeadRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  draftKcalField: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e8eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
  },
  draftKcalInput: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '700',
    minWidth: 56,
    paddingVertical: 10,
    textAlign: 'right',
  },
  draftKcalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  draftKcalUnit: {
    color: '#8b95a1',
    fontSize: 12,
    fontWeight: '700',
  },
  draftNameInput: {
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
  draftPortion: {
    color: '#8b95a1',
    fontSize: 12,
    fontWeight: '700',
  },
  draftRemoveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
  },
  draftSection: {
    gap: 10,
  },
  draftTotal: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyDraftBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 28,
  },
  emptyDraftText: {
    color: '#8b95a1',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  existingCard: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    gap: 8,
    padding: 16,
  },
  existingHeadRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  existingKcal: {
    color: '#4e5968',
    fontSize: 13,
    fontWeight: '700',
  },
  existingLabel: {
    color: '#333d4b',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  existingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  existingTitle: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '800',
  },
  existingTotal: {
    color: '#4e5968',
    fontSize: 13,
    fontWeight: '800',
  },
  footer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 16,
  },
  header: {
    gap: 4,
  },
  manualAddButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 4,
  },
  manualAddText: {
    color: '#3182f6',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.74,
  },
  previewCaption: {
    color: '#8b95a1',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    aspectRatio: 4 / 3,
    backgroundColor: '#f2f4f6',
    width: '100%',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 54,
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#b4c7e7',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 36,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 60,
    paddingHorizontal: 16,
  },
  searchButtonDisabled: {
    backgroundColor: '#b4c7e7',
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  searchInput: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    color: '#191f28',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stateBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 24,
  },
  stateText: {
    color: '#6b7684',
    fontSize: 14,
  },
  subtitle: {
    color: '#6b7684',
    fontSize: 14,
  },
  title: {
    color: '#191f28',
    fontSize: 28,
    fontWeight: '900',
  },
  totalLabel: {
    color: '#6b7684',
    fontSize: 14,
    fontWeight: '700',
  },
  totalRow: {
    alignItems: 'center',
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  totalValue: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
  usageText: {
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '700',
  },
  warningBody: {
    flex: 1,
    gap: 4,
  },
  warningBox: {
    alignItems: 'flex-start',
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 14,
  },
  warningText: {
    color: '#e5484d',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
