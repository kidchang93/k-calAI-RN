import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChunkyButton } from '@/components/chunky-button';
import { DetailHeader } from '@/components/detail-header';
import { ErrorBanner } from '@/components/error-banner';
import { MedicalDisclaimer } from '@/components/medical-disclaimer';
import { QuantityEditor, QuantityValue } from '@/components/quantity-editor';
import { NutrientChip, NutrientChips } from '@/components/nutrient-chips';
import { Screen } from '@/components/screen';
import { AI_USE_NOTICE } from '@/constants/ai-notice';
import { isMealType, MEAL_TYPE_LABELS, MealType, mealTypeAt } from '@/constants/meal';
import { NUTRIENT_LABELS, NUTRIENT_TIER_LABELS } from '@/constants/nutrition';
import { TAB_TONES } from '@/constants/tab-tone';
import { DISPLAY_FONT } from '@/constants/typography';
import { FoodDetection, PhotoAsset, uploadFoodPhoto } from '@/services/calorie-api';
import { notifyDialog } from '@/services/dialog';
import { formatFoodLabel } from '@/services/food-label';
import { formatFullDate, formatMonthDay, formatShortDate, formatTakenAt } from '@/services/format';
import {
  checkFoodWarnings,
  createMeal,
  dayAnchorLoggedAt,
  estimateNutrition,
  FoodWarning,
  FoodWarningNutrient,
  FoodWarningTier,
  formatDateParam,
  getMeals,
  MealItem,
  MealItemSource,
  MealLog,
  NutritionEstimate,
  NutritionNotFoundError,
  toMealItemInput,
  updateMeal,
} from '@/services/health-api';
import { PlanLimitError } from '@/services/http';
import { pickPhoto } from '@/services/photo-picker';
import { readPhotoTakenAt } from '@/services/photo-time';
import { nextMealType } from '@/services/recommendation-api';

// 상세 화면은 들어온 탭(식단)의 색을 이어 쓴다 (constants/tab-tone.ts).
const MEAL_TONE = TAB_TONES.meal;

// 경고 배너 색 — docs/DESIGN.md '영양 등급 3단계'의 보통·높음. 낮음(민트)은 쓰지 않는다:
// 경고 배너가 초록이면 "괜찮다"로 읽힌다.
const WARNING_TONES = {
  mid: { background: '#fbeee7', border: '#ed9c89', text: '#a4603f' },
  high: { background: '#fbeaea', border: '#ea8989', text: '#b8524e' },
} as const;

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: MEAL_TYPE_LABELS.breakfast },
  { value: 'lunch', label: MEAL_TYPE_LABELS.lunch },
  { value: 'dinner', label: MEAL_TYPE_LABELS.dinner },
  { value: 'snack', label: MEAL_TYPE_LABELS.snack },
];

// 서버 계약(MealItemInput.kcal)의 상한.
const MAX_KCAL = 100000;

// 초안 항목. 양 편집 상태(food_label·kcalText·serving_ratio·unit·serving_size_g·basePerServing)는
// QuantityEditor와 공유하는 QuantityValue로, 저장 페이로드에는 serving_ratio + kcal만 나간다.
type Draft = QuantityValue & {
  key: string;
  source: MealItemSource;
  confidence: number | null;
  portion_g: number | null;
  // 1인분 기준 실측 나트륨·칼륨·인 (estimate 응답). 표시할 때 선택한 양을 곱한다.
  // 미측정·AI 추정 음식이면 null — 그때는 칩을 그리지 않는다.
  nutrients: DraftNutrients | null;
  // 칼로리가 식약처 DB 실측이 아니라 생성형 AI 추정값인가 (estimate 응답 source === 'llm').
  // 사용자가 칼로리를 직접 고치면 그 값은 사용자 값이라 false 로 내린다.
  aiEstimatedKcal: boolean;
};

type DraftNutrients = {
  sodium_mg: number | null;
  potassium_mg: number | null;
  phosphorus_mg: number | null;
};

// 셋 다 없으면 null 로 접는다 — 빈 칩 줄을 만들지 않기 위해서다.
function nutrientsOf(estimate: NutritionEstimate): DraftNutrients | null {
  if (
    estimate.sodium_mg === null &&
    estimate.potassium_mg === null &&
    estimate.phosphorus_mg === null
  ) {
    return null;
  }

  return {
    sodium_mg: estimate.sodium_mg,
    potassium_mg: estimate.potassium_mg,
    phosphorus_mg: estimate.phosphorus_mg,
  };
}

let draftKeySeq = 0;
function nextDraftKey(): string {
  draftKeySeq += 1;

  return `draft-${Date.now()}-${draftKeySeq}`;
}

// 초안 → 저장·표시용 총 kcal. kcalText가 이미 '선택 인분의 총 kcal'이라 × ratio 하지 않는다.
// 유효하지 않으면 null (저장 버튼 비활성 조건).
function draftKcal(draft: Draft): number | null {
  const trimmed = draft.kcalText.trim();

  if (trimmed === '') {
    return null;
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.min(MAX_KCAL, Math.max(0, Math.round(value)));
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
    photoTakenAt?: string;
    // 추천 화면의 '이걸로 먹었어요' — 그 음식을 검색 추가와 같은 경로로 담아 둔다(저장은 사람이).
    food_label?: string;
    // 케어 탭 도장판(그날의 식탁)에서 들어오면 'care' — 뒤로가기가 '← 케어'라고 말한다.
    from?: string;
  }>();
  const headerTone = params.from === 'care' ? 'care' : 'meal';

  // 홈·캘린더·기록관리가 넘긴 날짜(YYYY-MM-DD)만 신뢰한다. 형식이 다르면 오늘로 폴백.
  const today = formatDateParam(new Date());
  const paramDate =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;
  // 오늘이 아닌 날짜가 넘어왔으면 사용자가 **그날을 골라** 들어온 것이다(캘린더·지난 기록).
  // 기록 탭은 오늘을 넘기므로 고른 것으로 치지 않는다 — 사진 날짜가 그 기본값을 이긴다.
  const isDateChosen = paramDate !== null && paramDate !== today;
  const [date, setDate] = useState(paramDate ?? today);

  const mealId =
    typeof params.meal_id === 'string' && /^\d+$/.test(params.meal_id)
      ? Number(params.meal_id)
      : null;
  const isAppend = mealId !== null;

  const paramMealType = isMealType(params.meal_type) ? params.meal_type : null;
  const isMealTypeChosen = paramMealType !== null;
  const initialMealType = paramMealType ?? mealTypeAt(new Date());

  const [mealType, setMealType] = useState<MealType>(initialMealType);
  // 사용자가 끼니를 직접 고른 뒤에는 사진 시각으로 덮지 않는다.
  const mealTypeTouchedRef = useRef(isMealTypeChosen);
  // 사진 촬영 시각과 그것으로 **실제로 바꾼 것**. 자동으로 정한 값이라는 사실을 화면에 밝히는 근거다.
  const [photoTime, setPhotoTime] = useState<{
    takenAt: Date;
    appliedMealType: boolean;
    appliedDate: boolean;
  } | null>(null);
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
  // 등급 경고와 함께 내려오는 고지문(서버 단일 진실). 등급 근거가 정책값이라는 사실을 숨기지 않는다.
  const [warningNotice, setWarningNotice] = useState<string | null>(null);
  // 질환 축을 판정하지 못한 음식. 경고가 없는 것과 안전한 것은 다르다 — 침묵을 안전으로
  // 읽지 않도록 그 사실을 그대로 보여준다 (서버 PRODUCT_STRATEGY.md §0-1).
  const [unmeasured, setUnmeasured] = useState<string[]>([]);
  // 새 끼니 저장에 성공하면 바로 돌아가지 않고 도장을 보여 준다. 저장 시점의 값을 굳혀 둔다.
  // 도장은 잘 먹어서가 아니라 **남겨서** 받는다 — 나트륨·kcal 로 문구나 색을 바꾸지 않는다.
  const [savedStamp, setSavedStamp] = useState<{
    date: string;
    mealType: MealType;
    labels: string[];
  } | null>(null);

  // 사진 자동 분석은 마운트 시 1회만. 라벨이 바뀌면 늦게 온 경고 응답을 무시한다.
  const autoAnalyzedRef = useRef(false);
  // food_label 파라미터(추천 '이걸로 먹었어요')도 마운트 시 1회만 담는다.
  const foodLabelAddedRef = useRef(false);
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
      setWarningNotice(null);

      return;
    }

    checkFoodWarnings(deduped)
      .then((result) => {
        if (warningSeqRef.current === seq) {
          setWarnings(result.warnings);
          setWarningNotice(result.notice);
          setUnmeasured(result.unmeasured);
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

  // QuantityEditor가 양 편집(이름·kcal·인분/g·basePerServing 절대계산)을 마친 값을 그대로 병합한다.
  // key·source·confidence·portion_g는 QuantityValue 밖이라 보존된다.
  const applyQuantity = (key: string, next: QuantityValue) => {
    setDrafts((prev) =>
      prev.map((draft) => {
        if (draft.key !== key) {
          return draft;
        }

        // 양은 그대로인데 칼로리만 바뀌었으면 사용자가 직접 고친 것이다 — AI 추정 표시를 뗀다.
        const kcalEditedByUser =
          next.kcalText !== draft.kcalText && next.serving_ratio === draft.serving_ratio;

        return {
          ...draft,
          ...next,
          aiEstimatedKcal: kcalEditedByUser ? false : draft.aiEstimatedKcal,
        };
      })
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
            ? {
                ...item,
                // kcalText는 현재 인분의 총 kcal이므로 1인분 값에 현재 ratio를 곱한다.
                kcalText: String(Math.round(estimate.kcal_per_serving * item.serving_ratio)),
                // 1인분 기준을 확보했으니 이후 인분/g 스케일은 절대 계산한다.
                basePerServing: Math.round(estimate.kcal_per_serving),
                // 조회로 1회 제공량을 알게 됐으니 g 입력을 열어 준다.
                serving_size_g: estimate.serving_size_g,
                nutrients: nutrientsOf(estimate),
                aiEstimatedKcal: estimate.source === 'llm',
              }
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

        // 사진 1장에서 인식된 여러 음식을 각각 항목으로 나눈다(2026-07-22). 한식 한 상(밥·국·
        // 반찬)이면 대표 1개만 담고 나머지를 손으로 넣어야 해서 기록이 느려진다 — 끼니당 30초를
        // 넘기면 리텐션이 급락한다(docs/PRODUCT_STRATEGY.md §2). 사진 1장의 비전 쿼터는 음식
        // 개수와 무관하게 1건이라(DATA_MODEL 22장) 몇 개로 나누든 쿼터 부담은 같다. 각 음식은
        // 식약처 DB로 kcal을 조회한다(쿼터 0). 일부가 실패해도 나머지는 살린다.
        const added = await Promise.all(result.foods.map(foodToDraft));
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

  // 사진 한 장마다 끼니·날짜 기본값을 다시 정한다. 촬영 시각이 없으면(카메라·EXIF 없음) 지금 시각과
  // 오늘로 되돌린다 — 앞 사진이 옮겨 둔 날짜가 설명 없이 남으면 틀린 날에 저장된다.
  const applyPhotoTime = useCallback(
    (takenAt: Date | null) => {
      if (isAppend) {
        return;
      }

      const appliedMealType = !mealTypeTouchedRef.current;
      const appliedDate = !isDateChosen;

      if (appliedMealType) {
        setMealType(mealTypeAt(takenAt ?? new Date()));
      }

      if (appliedDate) {
        setDate(takenAt !== null ? formatDateParam(takenAt) : formatDateParam(new Date()));
      }

      setPhotoTime(takenAt !== null ? { takenAt, appliedMealType, appliedDate } : null);
    },
    [isAppend, isDateChosen]
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
    // 기록 탭 런처가 촬영 시각을 미리 읽어 넘긴다 — 이 화면에는 원본 파일이 오지 않는다.
    applyPhotoTime(parseTakenAtParam(params.photoTakenAt));
  }, [
    applyPhotoTime,
    selectPhoto,
    params.photoMime,
    params.photoName,
    params.photoTakenAt,
    params.photoUri,
  ]);

  // 촬영 시각은 **앨범일 때만** 읽는다 — 방금 찍은 사진은 지금이 촬영 시각이라 의미가 없다
  // (기록 탭 런처와 같은 규칙, services/photo-picker.ts).
  const pickAndSelect = async (source: 'camera' | 'library') => {
    const asset = await pickPhoto(source);

    if (asset === null) {
      return;
    }

    selectPhoto(toPhotoAsset(asset));
    applyPhotoTime(source === 'library' ? await readPhotoTakenAt(asset) : null);
  };

  // 이름 하나 → estimate(쿼터 0) → 초안. 검색창과 추천 '이걸로 먹었어요'가 같은 경로를 쓴다.
  // 담았으면(미매칭으로 빈 kcal 초안을 담은 경우 포함) true — 검색창은 그때만 비운다.
  const addFoodByName = useCallback(
    async (name: string): Promise<boolean> => {
      setIsSearching(true);
      setErrorMessage(null);

      try {
        const estimate = await estimateNutrition(name);
        appendDrafts([makeDraft('manual', name, estimate)]);

        return true;
      } catch (error) {
        if (error instanceof NutritionNotFoundError) {
          // 미매칭은 오류가 아니다 — 입력한 이름으로 빈 kcal 초안을 추가해 직접 입력을 잇는다.
          appendDrafts([makeDraft('manual', name, null)]);
          notifyDialog('영양 정보를 찾지 못했어요', '칼로리를 직접 입력해주세요.');

          return true;
        }

        // 일시 장애(NutritionUnavailableError)도 일반 오류와 같은 메시지를 그대로 보여준다.
        setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');

        return false;
      } finally {
        setIsSearching(false);
      }
    },
    [appendDrafts]
  );

  const addBySearch = async () => {
    const name = searchText.trim();

    if (name === '') {
      return;
    }

    if (await addFoodByName(name)) {
      setSearchText('');
    }
  };

  // 추천 화면에서 고른 음식. 담기만 하고 저장하지 않는다 — 양을 고치거나 더 담을 수 있게.
  useEffect(() => {
    const label =
      !foodLabelAddedRef.current && typeof params.food_label === 'string'
        ? params.food_label.trim()
        : '';

    if (label === '') {
      return;
    }

    foodLabelAddedRef.current = true;
    void addFoodByName(label);
  }, [addFoodByName, params.food_label]);

  const addManual = () => {
    setErrorMessage(null);
    appendDrafts([makeDraft('manual', '', null)]);
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
        const preserved = existingItems.map(toMealItemInput);

        // logged_at 생략 → 서버가 기존 기록 시각을 유지한다 (전체 교체의 유일한 예외).
        await updateMeal(mealId, {
          meal_type: existingMealType ?? mealType,
          items: [...preserved, ...newItems],
        });
      } else {
        // **같은 날 같은 끼니가 이미 있으면 새로 만들지 않고 합친다.**
        // 캘린더·기록 탭의 '추가'는 meal_id 없이 들어오는데(trends.tsx의 onPressAdd), 그때마다
        // 새 끼니를 만들면 저녁이 두 개로 쪼개진다 — 사용자는 같은 끼니에 항목을 더한 줄 알았는데
        // 기존 끼니는 그대로여서 "반영이 안 됐다"고 느낀다.
        // 조회 실패는 무시하고 신규 생성으로 간다(합치기는 편의이지 저장의 전제가 아니다).
        const sameDayMeals = await getMeals(date).catch(() => [] as MealLog[]);
        const sameMeal = sameDayMeals.find((meal) => meal.meal_type === mealType);

        if (sameMeal) {
          // logged_at 생략 → 서버가 기존 기록 시각을 유지한다.
          await updateMeal(sameMeal.id, {
            meal_type: mealType,
            items: [...sameMeal.items.map(toMealItemInput), ...newItems],
          });
        } else {
          // 과거 날짜 셀에서도 그 날짜로 보이도록 UTC 정오로 앵커한다 (services/health-api.ts).
          await createMeal({
            meal_type: mealType,
            logged_at: dayAnchorLoggedAt(date),
            items: newItems,
          });
        }

        // 새 끼니는 도장을 보여 준 뒤 '확인'으로 돌아간다(같은 끼니에 합친 경우도 칸은 채워졌다).
        setSavedStamp({
          date,
          mealType,
          labels: newItems.map((item) => item.food_label),
        });

        return;
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
  // 나트륨 합은 실측이 있는 항목만 더한다. 빠진 항목이 있으면 그 사실을 함께 적는다 —
  // 없는 값을 0으로 읽으면 실제보다 적어 보인다.
  const sodiumDrafts = drafts.filter(
    (draft) => draft.nutrients !== null && draft.nutrients.sodium_mg !== null
  );
  const totalSodium = sodiumDrafts.reduce(
    (sum, draft) => sum + (draft.nutrients?.sodium_mg ?? 0) * draft.serving_ratio,
    0
  );
  // 경고에 실린 등급을 (음식, 영양소)로 찾을 수 있게 정리한다 — 칩 색과 경고 문구가 어긋나지 않게.
  const tierByLabel = buildTierLookup(warnings);
  const warningTone = WARNING_TONES[warningLevel(warnings)];
  const existingTotal = existingItems.reduce((sum, item) => sum + item.kcal, 0);
  const mealLabel = MEAL_TYPE_LABELS[isAppend ? (existingMealType ?? mealType) : mealType];

  if (savedStamp !== null) {
    const stampLabel = MEAL_TYPE_LABELS[savedStamp.mealType];

    return (
      <Screen
        footer={<ChunkyButton label="확인" onPress={() => router.back()} tone="meal" />}
        gap={16}>
        <DetailHeader
          caption={formatFullDate(savedStamp.date)}
          title={`${stampLabel} 남기기`}
          tone={headerTone}
        />

        <View style={styles.stampCard}>
          <View accessibilityLabel={`${stampLabel} 도장`} style={styles.stampOuter}>
            <View style={styles.stampInner}>
              <Text style={styles.stampLabel}>{stampLabel}</Text>
              <Text style={styles.stampDate}>{formatShortDate(savedStamp.date)}</Text>
            </View>
          </View>
          <Text accessibilityRole="header" style={styles.stampTitle}>
            {savedStamp.date === today
              ? `${stampLabel} 칸을 채웠어요`
              : `${formatMonthDay(savedStamp.date)} ${stampLabel} 칸을 채웠어요`}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>방금 남긴 것</Text>
          <Text style={styles.stampFoods}>
            {savedStamp.labels.map(formatFoodLabel).join(' · ')}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>{`합계 ${totalKcal.toLocaleString()} kcal`}</Text>
            {sodiumDrafts.length > 0 ? (
              <Text style={styles.totalText}>
                {`나트륨 ${Math.round(totalSodium).toLocaleString()}mg${
                  sodiumDrafts.length < drafts.length
                    ? ` (${drafts.length}개 중 ${sodiumDrafts.length}개만)`
                    : ''
                }`}
              </Text>
            ) : null}
          </View>
          <ChunkyButton
            disabled={!canSave}
            label={isAppend ? '항목 추가 저장' : `저장하고 ${mealLabel} 도장 받기`}
            loading={isSaving}
            onPress={() => void saveMeal()}
            tone="meal"
          />
        </>
      }
      gap={16}
      keyboard="persistTaps">
      <DetailHeader
        caption={formatFullDate(date)}
        title={isAppend ? `${mealLabel}에 더 담기` : `${mealLabel} 남기기`}
        tone={headerTone}
      />

      {isLoadingExisting ? (
        <View style={[styles.card, styles.stateCard]}>
          <ActivityIndicator color={MEAL_TONE.text} />
          <Text style={styles.bodyText}>기존 끼니를 불러오는 중입니다.</Text>
        </View>
      ) : null}

      {isAppend && existingItems.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.cardHeadRow}>
            <Text style={styles.cardTitle}>기존 항목</Text>
            <Text style={styles.existingTotal}>{`${existingTotal.toLocaleString()} kcal`}</Text>
          </View>
          {existingItems.map((item) => (
            <View key={item.id} style={styles.existingRow}>
              <Text style={styles.existingLabel} numberOfLines={1}>
                {formatFoodLabel(item.food_label)}
              </Text>
              <Text style={styles.existingKcal}>{`${item.kcal.toLocaleString()} kcal`}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {isAppend ? null : (
        <View style={styles.choiceSection}>
          <View accessibilityLabel="끼니" style={styles.mealPills}>
            {MEAL_TYPE_OPTIONS.map((option) => {
              const isSelected = option.value === mealType;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option.value}
                  onPress={() => {
                    mealTypeTouchedRef.current = true;
                    setMealType(option.value);
                  }}
                  style={({ pressed }) => [
                    styles.mealPill,
                    isSelected && styles.mealPillSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.mealPillText, isSelected && styles.mealPillTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {photoTime !== null ? (
            <PhotoTimeNotice
              photoTime={photoTime}
              date={date}
              today={today}
              onMoveToday={() => {
                setDate(today);
                setPhotoTime({ ...photoTime, appliedDate: false });
              }}
              onMoveToPhotoDate={() => {
                setDate(formatDateParam(photoTime.takenAt));
                setPhotoTime({ ...photoTime, appliedDate: true });
              }}
            />
          ) : null}
        </View>
      )}

      {previewUri ? (
        <View style={styles.previewCard}>
          <Image resizeMode="cover" source={{ uri: previewUri }} style={styles.previewImage} />
          <View style={styles.previewBody}>
            {/* "저장되지 않아요"만 쓰면 사진이 기기 밖으로 안 나가는 것으로 읽힌다 — 실제로는
                서버를 거쳐 AI 인식 서비스로 전송된다(저장만 하지 않는다). 전송 사실을 먼저 쓴다.
                근거: services/calorie-api.ts 가 FormData 로 업로드 → 서버가 메모리에서 Gemini 로
                넘기고 폐기(kcalAI-model/api/predict_api.py). 처리방침 2·6항과 같은 내용이다. */}
            <Text style={styles.previewCaption}>
              AI 인식을 위해 전송돼요 · 서버에 저장되지 않아요
            </Text>

            {pendingAsset ? (
              <ChunkyButton
                label="이 사진 분석하기"
                loading={isAnalyzing}
                onPress={runAnalyze}
                tone="meal"
              />
            ) : null}

            {isAnalyzing ? (
              <View style={styles.analyzingRow}>
                <ActivityIndicator color={MEAL_TONE.text} size="small" />
                <Text style={styles.bodyText}>사진 속 음식을 분석하고 있어요.</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>항목 추가</Text>
        <Text style={styles.bodyText}>
          한 끼에 여러 메뉴를 담을 수 있어요. 사진은 고른 뒤 분석 버튼을 눌러야 생성형 AI(Google Gemini)가 인식하고, 인식 1건당 1건이 차감돼요.
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
            onPress={() => void pickAndSelect('camera')}
          />
          <AddActionButton
            disabled={isAnalyzing}
            icon="photo-library"
            label="앨범"
            onPress={() => void pickAndSelect('library')}
          />
        </View>

        <View style={styles.searchRow}>
          <TextInput
            onChangeText={setSearchText}
            onSubmitEditing={() => void addBySearch()}
            placeholder="음식 이름으로 검색 (무료)"
            placeholderTextColor="#a9a6a1"
            returnKeyType="search"
            style={styles.searchInput}
            value={searchText}
          />
          <ChunkyButton
            disabled={searchText.trim() === ''}
            label="추가"
            loading={isSearching}
            onPress={() => void addBySearch()}
            tone="meal"
            variant="outline"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={addManual}
          style={({ pressed }) => [styles.manualAddButton, pressed && styles.pressed]}>
          <MaterialIcons color={MEAL_TONE.text} name="edit" size={20} />
          <Text style={styles.manualAddText}>직접 입력으로 추가</Text>
        </Pressable>
      </View>

      {planLimitMessage ? (
        <ErrorBanner
          actionLabel="확인"
          message={planLimitMessage}
          onRetry={() => setPlanLimitMessage(null)}
        />
      ) : null}

      {errorMessage ? (
        <ErrorBanner
          message={errorMessage}
          onRetry={existingLoadFailed ? () => void loadExisting() : () => setErrorMessage(null)}
        />
      ) : null}

      {drafts.length === 0 ? (
        <View style={styles.emptyDraftBox}>
          <MaterialIcons color="#5c5b57" name="restaurant" size={28} />
          <Text style={styles.emptyDraftText}>
            위에서 사진·검색·직접 입력으로 먹은 메뉴를 추가해주세요.
          </Text>
        </View>
      ) : (
        <View style={styles.draftSection}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {`담은 것 ${drafts.length}`}
          </Text>
          {drafts.map((draft) => (
            <View key={draft.key} style={styles.draftCard}>
              <QuantityEditor
                value={draft}
                isLookingUp={lookupKey === draft.key}
                portionHint={draft.portion_g}
                onChange={(next) => applyQuantity(draft.key, next)}
                onLabelBlur={() => void lookupDraftKcal(draft.key)}
                onRemove={() => removeDraft(draft.key)}
              />
              <View style={styles.draftMeta}>
                <AiProvenance
                  recognized={draft.source === 'ai'}
                  estimatedKcal={draft.aiEstimatedKcal}
                />
                {/* 먹은 음식의 실측 나트륨·칼륨·인. 미측정 음식은 아무것도 그리지 않는다. */}
                <NutrientChips chips={draftNutrientChips(draft, tierByLabel)} />
              </View>
            </View>
          ))}
        </View>
      )}

      {warnings.length > 0 ? (
        <View
          style={[
            styles.warningBox,
            { backgroundColor: warningTone.background, borderColor: warningTone.border },
          ]}>
          {warnings.map((warning) => (
            <View
              key={`${warning.source}-${warning.code}-${warning.matched_label}`}
              style={styles.warningLine}>
              <Text style={[styles.warningText, { color: warningTone.text }]}>
                {formatWarning(warning)}
              </Text>

              {/* **경고를 이해할 수 있게 한다.** "칼륨이 높아요"만으로는 왜 줄여야 하는지,
                  내 병기에서도 그런지 알 수 없다 — 실사용에서 "내 질환 정보를 찾기 너무
                  힘들다"로 나온 지점이다 (서버 `docs/CARE_LOOP.md` §0-3·§5-2).
                  `nutrient` 가 있는 경고만 축 가이드가 있다(알러지·임신·암은 없다).
                  서버 테스트 `test_every_axis_warning_condition_has_a_guide` 가 이 대응을 건다. */}
              {warning.nutrient !== null ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/guides/[condition]',
                      params: { condition: warning.code, axis: warning.nutrient as string },
                    })
                  }
                  style={({ pressed }) => [
                    styles.warningPill,
                    { borderColor: warningTone.border },
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.warningPillText, { color: warningTone.text }]}>왜?</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {/* 등급 근거가 지침 컷오프가 아니라 정책값이라는 고지. 서버가 문구를 정한다. */}
          {warningNotice ? <Text style={styles.warningNotice}>{warningNotice}</Text> : null}

          {/* 경고가 뜬 순간이 사용자가 식이 결정을 내리는 순간이다 — 최종 판단자가
              누구인지 여기서 말해야 한다 (Apple 1.4.1). */}
          <MedicalDisclaimer />

          {/* 경고를 막다른 길로 두지 않는다 — "먹지 마세요" 다음에는 "그럼 뭘 먹지"가
              와야 한다. 기록을 막지 않으므로 이건 대안 제시일 뿐이고, 이미 먹은 것을
              지우라는 뜻이 아니다(그래서 문구가 '다음 끼니'다). */}
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/recommendations',
                params: { meal_type: nextMealType() },
              })
            }
            style={({ pressed }) => [
              styles.warningPill,
              styles.warningAction,
              { borderColor: warningTone.border },
              pressed && styles.pressed,
            ]}>
            <MaterialIcons color={warningTone.text} name="restaurant-menu" size={18} />
            <Text style={[styles.warningPillText, { color: warningTone.text }]}>
              다음 끼니에 맞는 메뉴 보기
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* **경고가 없는 것과 안전한 것은 다르다.** 실측이 없는 음식은 판정 자체가 안 되는데,
          아무 말도 하지 않으면 사용자는 "괜찮다"로 읽는다 — 신장병 환자의 돈까스·보쌈이
          그랬다. 경고와 다른 톤(주의색이 아닌 회색)으로, 사실만 전한다. */}
      {unmeasured.length > 0 ? (
        <View style={styles.unmeasuredBox}>
          <MaterialIcons color="#5c5b57" name="help-outline" size={20} />
          <Text style={styles.unmeasuredText}>
            {`${unmeasured.map(formatFoodLabel).join(', ')}은(는) 영양 정보가 없어 확인하지 못했어요. 안전하다는 뜻은 아니에요.`}
          </Text>
        </View>
      ) : null}

      <Text style={styles.disclaimer}>{AI_USE_NOTICE}</Text>
    </Screen>
  );
}

// AI기본법 제31조② — 생성형 AI가 만든 결과물이라는 사실을 **그 결과물 옆에** 표시한다(KCAL-17).
// 인식은 사진 분석(Gemini), 칼로리 추정은 식약처 DB에 없는 음식을 Gemini 가 1회 추정한 값이다
// (서버 DATA_MODEL 19장). 식약처 실측값에는 붙이지 않는다 — 전부 AI 라고 쓰면 그것도 틀린 고지다.
function AiProvenance({ recognized, estimatedKcal }: { recognized: boolean; estimatedKcal: boolean }) {
  if (!recognized && !estimatedKcal) {
    return null;
  }

  return (
    <View style={styles.aiRow}>
      {recognized ? (
        <View style={styles.aiBadge}>
          <MaterialIcons color="#5c5b57" name="auto-awesome" size={14} />
          <Text style={styles.aiBadgeText}>AI가 사진에서 인식</Text>
        </View>
      ) : null}
      {estimatedKcal ? (
        <View style={styles.aiBadge}>
          <MaterialIcons color="#5c5b57" name="auto-awesome" size={14} />
          <Text style={styles.aiBadgeText}>칼로리는 AI 추정값 · 식약처 DB에 없는 음식</Text>
        </View>
      ) : null}
    </View>
  );
}

// 사진 촬영 시각으로 무엇을 정했는지 밝히고 되돌릴 수 있게 한다. 자동으로 채운 값을 말없이 두면
// 사용자는 이미 맞춰졌다고 믿고 지나친다(KCAL-20).
function PhotoTimeNotice({
  photoTime,
  date,
  today,
  onMoveToday,
  onMoveToPhotoDate,
}: {
  photoTime: { takenAt: Date; appliedMealType: boolean; appliedDate: boolean };
  date: string;
  today: string;
  onMoveToday: () => void;
  onMoveToPhotoDate: () => void;
}) {
  const photoDate = formatDateParam(photoTime.takenAt);
  const applied = [
    photoTime.appliedMealType ? '끼니' : null,
    photoTime.appliedDate && photoDate !== today ? '날짜' : null,
  ].filter((part): part is string => part !== null);
  const takenLabel = formatTakenAt(photoTime.takenAt);

  return (
    <View style={styles.photoTimeNotice}>
      <MaterialIcons color={MEAL_TONE.text} name="schedule" size={20} />
      <View style={styles.photoTimeBody}>
        <Text style={styles.photoTimeText}>
          {applied.length > 0
            ? `사진 찍은 시각(${takenLabel})으로 ${applied.join('와 ')}를 정했어요.`
            : `사진은 ${takenLabel}에 찍었어요.`}
        </Text>
        {photoTime.appliedDate && date !== today ? (
          <Pressable
            accessibilityRole="button"
            onPress={onMoveToday}
            style={({ pressed }) => [styles.photoTimeLink, pressed && styles.pressed]}>
            <Text style={styles.photoTimeLinkText}>오늘 기록으로 바꾸기</Text>
          </Pressable>
        ) : null}
        {!photoTime.appliedDate && photoDate !== date ? (
          <Pressable
            accessibilityRole="button"
            onPress={onMoveToPhotoDate}
            style={({ pressed }) => [styles.photoTimeLink, pressed && styles.pressed]}>
            <Text style={styles.photoTimeLinkText}>{`사진 찍은 날(${formatMonthDay(photoDate)}) 기록으로 옮기기`}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function parseTakenAtParam(value: string | undefined): Date | null {
  if (typeof value !== 'string' || value === '') {
    return null;
  }

  const time = new Date(value);

  return Number.isNaN(time.getTime()) ? null : time;
}

function toPhotoAsset(asset: ImagePicker.ImagePickerAsset): PhotoAsset {
  return { uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType };
}

// 인식된 음식 1건 → 초안. estimate 성공이면 매칭 DB 이름·kcal을, 실패(404/503/기타)면 라벨만
// 살리고 kcal은 비워 직접 입력을 유도한다 (일부 실패해도 나머지를 살린다).
async function foodToDraft(food: FoodDetection): Promise<Draft> {
  try {
    return makeDraft('ai', food.label, await estimateNutrition(food.label), food);
  } catch {
    return makeDraft('ai', food.label, null, food);
  }
}

// 초안 생성 — 검색·직접입력·사진 인식(성공/실패) 5곳이 같은 12필드를 채우던 것을 줄인다.
// estimate 가 있으면 DB 매칭값(이름·kcal·1인분 정보)을 쓰고, 없으면 label 그대로 칼로리 미입력
// 초안이 된다. food(사진 인식 결과)가 있으면 신뢰도·portion_g 를 함께 싣는다.
function makeDraft(
  source: MealItemSource,
  label: string,
  estimate: NutritionEstimate | null,
  food?: FoodDetection
): Draft {
  return {
    key: nextDraftKey(),
    food_label: estimate?.food_label ?? label,
    kcalText: estimate === null ? '' : String(Math.round(estimate.kcal_per_serving)),
    serving_ratio: 1,
    unit: 'serving',
    source,
    confidence: food === undefined ? null : Math.max(0, Math.min(1, food.score)),
    portion_g: food?.portion_g ?? null,
    serving_size_g: estimate?.serving_size_g ?? null,
    basePerServing: estimate === null ? null : Math.round(estimate.kcal_per_serving),
    nutrients: estimate === null ? null : nutrientsOf(estimate),
    aiEstimatedKcal: estimate !== null && estimate.source === 'llm',
  };
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
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.addActionButton,
        disabled && styles.addActionButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <MaterialIcons color={MEAL_TONE.text} name={icon} size={24} />
      <Text style={styles.addActionLabel}>{label}</Text>
    </Pressable>
  );
}

// 경고 배너 색. 알러지나 '높음' 등급이 하나라도 있으면 높음, 그 외(보통·이름 분류·당류)는 보통.
function warningLevel(warnings: FoodWarning[]): keyof typeof WARNING_TONES {
  if (warnings.some((warning) => warning.source === 'allergy')) {
    return 'high';
  }

  return warnings.some((warning) => warning.tier === 'high') ? 'high' : 'mid';
}

function buildTierLookup(warnings: FoodWarning[]): Map<string, FoodWarningTier> {
  const lookup = new Map<string, FoodWarningTier>();

  for (const warning of warnings) {
    if (warning.nutrient !== null && warning.tier !== null) {
      lookup.set(`${warning.matched_label}:${warning.nutrient}`, warning.tier);
    }
  }

  return lookup;
}

// 초안 → 수치 칩. 값은 **선택한 양**을 곱해 보여준다(kcal 과 같은 규칙).
// 등급은 음식 자체의 성질이라 1인분 기준 판정을 그대로 쓴다 — 양을 줄여도 고칼륨 식품은
// 고칼륨이다. 등급은 경고에 실려 온 것만 있으므로, 경고가 없는 음식은 회색 칩이 된다.
function draftNutrientChips(draft: Draft, tiers: Map<string, FoodWarningTier>): NutrientChip[] {
  if (draft.nutrients === null) {
    return [];
  }

  const axes: [FoodWarningNutrient, number | null][] = [
    ['sodium', draft.nutrients.sodium_mg],
    ['potassium', draft.nutrients.potassium_mg],
    ['phosphorus', draft.nutrients.phosphorus_mg],
  ];

  const chips: NutrientChip[] = [];

  for (const [nutrient, perServing] of axes) {
    if (perServing === null) {
      continue;
    }

    chips.push({
      label: NUTRIENT_LABELS[nutrient],
      value: `${Math.round(perServing * draft.serving_ratio).toLocaleString()}mg`,
      tier: tiers.get(`${draft.food_label}:${nutrient}`) ?? null,
    });
  }

  return chips;
}

// 경고 1건 → 1줄. allergy는 "계란 알러지: …", condition은 "당뇨 주의: …" (DATA_MODEL.md 16장).
function formatWarning(warning: FoodWarning): string {
  const prefix = warning.source === 'allergy' ? `${warning.label} 알러지` : `${warning.label} 주의`;

  // 영양소 축 경고(신장병·고혈압)는 어느 영양소가 높은지 알려준다 — 대한신장학회 지침 분류.
  if (warning.nutrient !== null) {
    const nutrientLabel = NUTRIENT_LABELS[warning.nutrient];

    // 실측이 있으면 근거 수치를 함께 준다 — '높은 편'만으로는 사용자가 판단할 수 없다.
    // 1인분 기준값이라 사용자가 고른 양과 다를 수 있어 그 기준을 밝힌다 (CKD_NUTRITION.md 3-5).
    const measured =
      warning.nutrient_mg !== null
        ? ` (1인분 ${Math.round(warning.nutrient_mg).toLocaleString()}${warning.nutrient_unit ?? 'mg'}${
            warning.tier !== null ? ` · ${NUTRIENT_TIER_LABELS[warning.tier]}` : ''
          })`
        : '';
    const name = formatFoodLabel(warning.matched_label);

    // **당류는 등급이 없다** — 서버가 이름 축(가당음료·간식)으로만 판정하기 때문이다. 지침 대상이
    // 총당류가 아니라 첨가당이라 수치로 단정할 수 없다(서버 CHRONIC_NUTRITION_SOURCES.md §2-2).
    // 그래서 '높은 편'이라 말하지 않고 무엇에 걸렸는지를 그대로 말한다.
    if (warning.nutrient === 'sugar') {
      return `${prefix}: '${name}'은(는) 첨가당이 들어간 식품이에요${measured}`;
    }

    // **근거에 따라 단정 수위를 나눈다.** 경고는 두 축에서 발동한다(CKD_NUTRITION.md 3-5) —
    // 실측 등급(tier)과 지침의 이름 분류. 둘을 한 문장으로 뭉치면 "'라면'은 나트륨이 높은
    // 편이에요 (1인분 290mg)"처럼 **문구와 수치가 서로를 반박**한다(실측 사례). 수치가 낮게
    // 나오는 이유는 DB 행이 그 음식을 잘 대표하지 못해서일 수도 있어 경고를 없애면 안 되고,
    // 대신 "지침이 주의 식품으로 분류했다"는 사실 그대로를 말한다.
    if (warning.tier === 'high' || warning.nutrient_mg === null) {
      return `${prefix}: '${name}'은(는) ${nutrientLabel}이 높은 편이에요${measured}`;
    }

    return `${prefix}: '${name}'은(는) 지침에서 ${nutrientLabel} 주의 식품으로 분류돼요${measured}`;
  }

  return `${prefix}: '${formatFoodLabel(warning.matched_label)}'에 ${warning.matched_keyword}${subjectParticle(warning.matched_keyword)} 포함될 수 있어요`;
}

// 주격 조사(이/가) — 마지막 글자의 받침 유무로 고른다. 한글이 아니면 병기 폴백.
function subjectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1);

  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 === 0 ? '가' : '이';
  }

  return '이(가)';
}

const styles = StyleSheet.create({
  addActionButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 4,
    borderColor: MEAL_TONE.shade,
    borderRadius: 14,
    borderWidth: 2,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 52,
  },
  addActionButtonDisabled: {
    opacity: 0.5,
  },
  addActionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  addActionLabel: {
    color: MEAL_TONE.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
  },
  aiBadge: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#a9a6a1',
    borderRadius: 6,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aiBadgeText: {
    color: '#5c5b57',
    fontSize: 13,
    fontWeight: '800',
  },
  aiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  analyzingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bodyText: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 12,
    padding: 16,
  },
  cardHeadRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
  },
  choiceSection: {
    gap: 10,
  },
  disclaimer: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  draftCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  draftMeta: {
    gap: 6,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  draftSection: {
    gap: 12,
  },
  emptyDraftBox: {
    alignItems: 'center',
    borderColor: '#a9a6a1',
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 2,
    gap: 10,
    padding: 28,
  },
  emptyDraftText: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  existingKcal: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '700',
  },
  existingLabel: {
    color: '#22211f',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  existingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  existingTotal: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 18,
  },
  manualAddButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
  },
  manualAddText: {
    color: MEAL_TONE.text,
    fontSize: 15,
    fontWeight: '800',
  },
  mealPill: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e4e2de',
    borderRadius: 999,
    borderWidth: 2,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  mealPillSelected: {
    backgroundColor: MEAL_TONE.fill,
    borderColor: MEAL_TONE.shade,
  },
  mealPillText: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '800',
  },
  mealPillTextSelected: {
    color: '#ffffff',
  },
  mealPills: {
    flexDirection: 'row',
    gap: 8,
  },
  photoTimeBody: {
    flex: 1,
    gap: 2,
  },
  photoTimeLink: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
  },
  photoTimeLinkText: {
    color: MEAL_TONE.text,
    fontSize: 15,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  photoTimeNotice: {
    alignItems: 'flex-start',
    backgroundColor: MEAL_TONE.tint,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  photoTimeText: {
    color: '#22211f',
    fontSize: 15,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.74,
  },
  previewBody: {
    gap: 12,
    padding: 14,
  },
  previewCaption: {
    color: '#5c5b57',
    fontSize: 13,
    fontWeight: '700',
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  previewImage: {
    aspectRatio: 4 / 3,
    backgroundColor: '#e4e2de',
    width: '100%',
  },
  searchInput: {
    backgroundColor: '#f7f6f4',
    borderColor: '#e4e2de',
    borderRadius: 16,
    borderWidth: 2,
    color: '#22211f',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    minHeight: 56,
    paddingHorizontal: 14,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
  },
  stampCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  stampDate: {
    color: MEAL_TONE.text,
    fontSize: 15,
    fontWeight: '800',
  },
  stampFoods: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  stampInner: {
    alignItems: 'center',
    borderColor: MEAL_TONE.fill,
    borderRadius: 47,
    borderStyle: 'dashed',
    borderWidth: 2,
    gap: 2,
    height: 94,
    justifyContent: 'center',
    width: 94,
  },
  stampLabel: {
    color: MEAL_TONE.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 32,
    lineHeight: 36,
  },
  stampOuter: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: MEAL_TONE.fill,
    borderRadius: 58,
    borderWidth: 5,
    height: 116,
    justifyContent: 'center',
    transform: [{ rotate: '-10deg' }],
    width: 116,
  },
  stampTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 27,
    textAlign: 'center',
  },
  stateCard: {
    alignItems: 'center',
    padding: 24,
  },
  totalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  totalText: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '800',
  },
  unmeasuredBox: {
    alignItems: 'flex-start',
    backgroundColor: '#e4e2de',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    padding: 14,
  },
  unmeasuredText: {
    color: '#22211f',
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  usageText: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '700',
  },
  warningAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
  },
  warningBox: {
    borderBottomWidth: 5,
    borderRadius: 20,
    borderWidth: 2,
    gap: 10,
    padding: 14,
  },
  warningLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  warningNotice: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  warningPill: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  warningPillText: {
    fontSize: 15,
    fontWeight: '800',
  },
  warningText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 22,
  },
});
