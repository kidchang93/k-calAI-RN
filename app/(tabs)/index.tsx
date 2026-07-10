import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { CALORIE_API_URL, Prediction, uploadFoodPhoto } from '@/services/calorie-api';
import {
  createMeal,
  estimateNutrition,
  MealType,
  NutritionEstimate,
  NutritionNotFoundError,
} from '@/services/health-api';

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'snack', label: '간식' },
];

const SERVING_RATIO_OPTIONS: { value: string; label: string; ratio: number }[] = [
  { value: '0.5', label: '0.5인분', ratio: 0.5 },
  { value: '1', label: '1인분', ratio: 1 },
  { value: '1.5', label: '1.5인분', ratio: 1.5 },
  { value: '2', label: '2인분', ratio: 2 },
];

// 서버 계약(MealItemInput.kcal)의 상한. 이 값을 넘는 수동 입력은 저장 버튼을 비활성화한다.
const MAX_KCAL = 100000;

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

export default function RecordScreen() {
  const router = useRouter();
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [nutrition, setNutrition] = useState<NutritionEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  // 404(DB 미매칭) 안내 문구. 서버 오류가 아니라 정상 분기라 에러 배너 대신 수동 입력으로 유도한다.
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>(() => defaultMealType());
  const [servingRatio, setServingRatio] = useState(1);
  const [manualKcal, setManualKcal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 라벨을 연속으로 탭했을 때 늦게 도착한 이전 응답이 현재 선택을 덮어쓰지 않게 한다.
  const estimateSeqRef = useRef(0);

  const topPrediction = predictions[0];
  const confidence = useMemo(() => {
    if (!topPrediction) {
      return null;
    }

    return `${Math.round(topPrediction.score * 100)}%`;
  }, [topPrediction]);

  // 저장에 쓸 최종 kcal. 추정 성공이면 1인분 kcal × 섭취량, 실패면 수동 입력값.
  const finalKcal = useMemo(() => {
    if (nutrition) {
      return Math.min(MAX_KCAL, Math.max(0, Math.round(nutrition.kcal_per_serving * servingRatio)));
    }

    const trimmed = manualKcal.trim();

    if (trimmed === '') {
      return null;
    }

    const parsed = Number(trimmed);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_KCAL) {
      return null;
    }

    return Math.round(parsed);
  }, [nutrition, servingRatio, manualKcal]);

  const clearConfirmState = () => {
    setSelectedPrediction(null);
    setNutrition(null);
    setNotFoundMessage(null);
    setManualKcal('');
    setServingRatio(1);
    setMealType(defaultMealType());
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('카메라 권한 필요', '음식 사진을 촬영하려면 카메라 권한을 허용해주세요.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.86,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0]);
      setPredictions([]);
      clearConfirmState();
      setErrorMessage(null);
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('사진 권한 필요', '앨범에서 음식 사진을 선택하려면 사진 접근 권한을 허용해주세요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.86,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0]);
      setPredictions([]);
      clearConfirmState();
      setErrorMessage(null);
    }
  };

  const analyzePhoto = async () => {
    if (!photo) {
      Alert.alert('사진이 필요해요', '분석할 음식 사진을 먼저 촬영하거나 선택해주세요.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const result = await uploadFoodPhoto({
        uri: photo.uri,
        fileName: photo.fileName,
        mimeType: photo.mimeType,
      });

      setPredictions(result.sort((a, b) => b.score - a.score));
      clearConfirmState();
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setPhoto(null);
    setPredictions([]);
    clearConfirmState();
    setErrorMessage(null);
  };

  const runEstimate = async (prediction: Prediction) => {
    const seq = ++estimateSeqRef.current;

    setIsEstimating(true);
    setErrorMessage(null);
    setNotFoundMessage(null);

    try {
      const result = await estimateNutrition(prediction.label);

      if (estimateSeqRef.current === seq) {
        setNutrition(result);
      }
    } catch (error) {
      if (estimateSeqRef.current === seq) {
        // 404(미매칭)는 오류가 아니라 정상 분기 — 배너 없이 수동 입력으로 자연스럽게 넘긴다.
        if (error instanceof NutritionNotFoundError) {
          setNotFoundMessage(error.message);
        } else {
          const message =
            error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
          setErrorMessage(message);
        }
      }
    } finally {
      if (estimateSeqRef.current === seq) {
        setIsEstimating(false);
      }
    }
  };

  const selectPrediction = async (prediction: Prediction) => {
    setSelectedPrediction(prediction);
    setNutrition(null);
    setNotFoundMessage(null);
    setManualKcal('');
    await runEstimate(prediction);
  };

  const selectMealType = (value: string) => {
    const option = MEAL_TYPE_OPTIONS.find((item) => item.value === value);

    if (option) {
      setMealType(option.value);
    }
  };

  const selectServingRatio = (value: string) => {
    const option = SERVING_RATIO_OPTIONS.find((item) => item.value === value);

    if (option) {
      setServingRatio(option.ratio);
    }
  };

  const saveMeal = async () => {
    if (!selectedPrediction || finalKcal === null) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await createMeal({
        meal_type: mealType,
        items: [
          {
            // 유사도 매칭 성공 시 매칭된 DB 이름으로 기록한다 — 사용자에게 보여준 이름과 일치시킨다.
            food_label: nutrition?.food_label ?? selectedPrediction.label,
            serving_ratio: servingRatio,
            kcal: finalKcal,
            source: 'ai',
            confidence: Math.max(0, Math.min(1, selectedPrediction.score)),
          },
        ],
      });

      reset();
      router.navigate('/home');
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  // 추정이 끝났는데 결과가 없으면 실패 상태 — 수동 입력으로 저장을 이어간다.
  const isEstimateFailed = selectedPrediction !== null && !isEstimating && nutrition === null;
  const canSave = selectedPrediction !== null && !isEstimating && !isSaving && finalKcal !== null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>K-Cal AI</Text>
            <Text style={styles.title}>사진 한 장으로{"\n"}식단을 기록해요</Text>
          </View>
          <View style={styles.logoMark}>
            <MaterialIcons name="restaurant" size={28} color="#ffffff" />
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>예상 음식</Text>
          <Text style={styles.summaryValue}>{topPrediction?.label ?? '아직 분석 전이에요'}</Text>
          <View style={styles.summaryFooter}>
            <Text style={styles.summaryCaption}>
              {confidence ? `신뢰도 ${confidence}` : '음식 사진을 서버로 보내 예측 결과를 받아옵니다'}
            </Text>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, predictions.length > 0 && styles.statusDotActive]} />
              <Text style={styles.statusText}>{predictions.length > 0 ? '완료' : '대기'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.photoCard}>
          {photo ? (
            <Image source={{ uri: photo.uri }} contentFit="cover" style={styles.photo} />
          ) : (
            <View style={styles.emptyPhoto}>
              <MaterialIcons name="add-a-photo" size={36} color="#8b95a1" />
              <Text style={styles.emptyTitle}>음식 사진을 추가해주세요</Text>
              <Text style={styles.emptyDescription}>촬영하거나 앨범에서 선택할 수 있어요.</Text>
            </View>
          )}
        </View>

        <View style={styles.actionGrid}>
          <ActionButton icon="photo-camera" label="촬영" onPress={pickFromCamera} />
          <ActionButton icon="photo-library" label="앨범" onPress={pickFromLibrary} />
        </View>

        <Pressable
          disabled={isUploading || !photo}
          onPress={analyzePhoto}
          style={({ pressed }) => [
            styles.primaryButton,
            (!photo || isUploading) && styles.primaryButtonDisabled,
            pressed && photo && !isUploading && styles.pressed,
          ]}>
          {isUploading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <MaterialIcons name="auto-awesome" size={20} color="#ffffff" />
              <Text style={styles.primaryButtonText}>칼로리 분석하기</Text>
            </>
          )}
        </Pressable>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={20} color="#e5484d" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {predictions.length > 0 ? (
          <View style={styles.resultSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>분석 결과</Text>
              <Pressable onPress={reset} hitSlop={10}>
                <Text style={styles.resetText}>다시 선택</Text>
              </Pressable>
            </View>
            <Text style={styles.resultGuide}>음식을 선택하면 영양 정보를 추정해 기록할 수 있어요.</Text>
            {predictions.map((prediction) => (
              <PredictionRow
                key={`${prediction.label}-${prediction.score}`}
                isSelected={selectedPrediction?.label === prediction.label}
                prediction={prediction}
                onPress={() => void selectPrediction(prediction)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.endpointCard}>
            <Text style={styles.endpointTitle}>연결 서버</Text>
            <Text style={styles.endpointUrl}>{CALORIE_API_URL}</Text>
          </View>
        )}

        {selectedPrediction ? (
          <View style={styles.confirmCard}>
            <View style={styles.confirmHeader}>
              <View>
                <Text style={styles.confirmLabel}>기록 확정</Text>
                <Text style={styles.confirmTitle}>
                  {nutrition?.food_label ?? selectedPrediction.label}
                </Text>
              </View>
              {isEstimating ? <ActivityIndicator color="#3182f6" /> : null}
            </View>

            {isEstimating ? (
              <Text style={styles.confirmPlaceholder}>선택한 음식의 영양 정보를 추정하고 있어요.</Text>
            ) : nutrition ? (
              <View style={styles.nutritionBox}>
                {nutrition.food_label !== selectedPrediction.label ? (
                  <Text style={styles.matchedNote}>
                    {`'${selectedPrediction.label}' 대신 가장 비슷한 '${nutrition.food_label}'의 영양 정보를 찾았어요.`}
                  </Text>
                ) : null}
                <Text style={styles.nutritionKcal}>
                  {`${nutrition.serving_desc} 기준 약 ${Math.round(nutrition.kcal_per_serving).toLocaleString()} kcal`}
                </Text>
                <View style={styles.nutrientRow}>
                  <NutrientItem label="탄수화물" grams={nutrition.carbs_g} />
                  <NutrientItem label="단백질" grams={nutrition.protein_g} />
                  <NutrientItem label="지방" grams={nutrition.fat_g} />
                </View>
              </View>
            ) : (
              <View style={styles.manualBox}>
                <Text style={styles.manualGuide}>
                  {notFoundMessage ??
                    '영양 정보를 불러오지 못했어요. 칼로리를 직접 입력하면 저장할 수 있어요.'}
                </Text>
                {/* 미매칭(404)은 결정적 결과라 재시도해도 같다 — 재시도 버튼은 일반 오류에만 보인다. */}
                {notFoundMessage === null ? (
                  <Pressable
                    onPress={() => void runEstimate(selectedPrediction)}
                    style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                    <Text style={styles.retryButtonText}>다시 추정하기</Text>
                  </Pressable>
                ) : null}
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={setManualKcal}
                  placeholder="섭취 칼로리 (kcal)"
                  placeholderTextColor="#8b95a1"
                  style={styles.manualInput}
                  value={manualKcal}
                />
              </View>
            )}

            <View style={styles.choiceSection}>
              <Text style={styles.choiceLabel}>끼니</Text>
              <ChipGroup
                options={MEAL_TYPE_OPTIONS}
                selectedValues={[mealType]}
                onToggle={selectMealType}
              />
            </View>

            <View style={styles.choiceSection}>
              <Text style={styles.choiceLabel}>섭취량</Text>
              <ChipGroup
                options={SERVING_RATIO_OPTIONS}
                selectedValues={[String(servingRatio)]}
                onToggle={selectServingRatio}
              />
            </View>

            <View style={styles.confirmFooter}>
              <Text style={styles.finalKcalLabel}>기록될 칼로리</Text>
              <Text style={styles.finalKcalValue}>
                {finalKcal !== null
                  ? `${finalKcal.toLocaleString()} kcal`
                  : isEstimateFailed
                    ? '칼로리를 입력해주세요'
                    : '추정 중'}
              </Text>
            </View>

            <Pressable
              disabled={!canSave}
              onPress={saveMeal}
              style={({ pressed }) => [
                styles.primaryButton,
                !canSave && styles.primaryButtonDisabled,
                pressed && canSave && styles.pressed,
              ]}>
              {isSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <MaterialIcons name="check" size={20} color="#ffffff" />
                  <Text style={styles.primaryButtonText}>기록 저장</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
      <View style={styles.actionIcon}>
        <MaterialIcons name={icon} size={24} color="#3182f6" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function PredictionRow({
  isSelected,
  prediction,
  onPress,
}: {
  isSelected: boolean;
  prediction: Prediction;
  onPress: () => void;
}) {
  const percent = Math.max(0, Math.min(100, prediction.score * 100));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.predictionRow,
        isSelected && styles.predictionRowSelected,
        pressed && styles.pressed,
      ]}>
      <View style={styles.predictionTopLine}>
        <Text style={styles.predictionLabel}>{prediction.label}</Text>
        <View style={styles.predictionMeta}>
          <Text style={styles.predictionScore}>{percent.toFixed(1)}%</Text>
          <MaterialIcons name="chevron-right" size={20} color="#8b95a1" />
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
    </Pressable>
  );
}

function NutrientItem({ label, grams }: { label: string; grams: number | null }) {
  return (
    <View style={styles.nutrientItem}>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <Text style={styles.nutrientValue}>{grams !== null ? `${grams}g` : '정보 없음'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  container: {
    gap: 18,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 18,
  },
  kicker: {
    color: '#3182f6',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 39,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 20,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 22,
  },
  summaryLabel: {
    color: '#6b7684',
    fontSize: 14,
    fontWeight: '700',
  },
  summaryValue: {
    color: '#191f28',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 35,
  },
  summaryFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryCaption: {
    color: '#8b95a1',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  statusPill: {
    alignItems: 'center',
    backgroundColor: '#f2f4f6',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusDot: {
    backgroundColor: '#d1d6db',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusDotActive: {
    backgroundColor: '#20c997',
  },
  statusText: {
    color: '#4e5968',
    fontSize: 12,
    fontWeight: '800',
  },
  photoCard: {
    aspectRatio: 4 / 3,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  photo: {
    height: '100%',
    width: '100%',
  },
  emptyPhoto: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: '#333d4b',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 14,
  },
  emptyDescription: {
    color: '#8b95a1',
    fontSize: 14,
    marginTop: 6,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: '#edf6ff',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  actionLabel: {
    color: '#333d4b',
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 58,
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#b4c7e7',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
  },
  errorBox: {
    alignItems: 'flex-start',
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 14,
  },
  errorText: {
    color: '#e5484d',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  resultSection: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 14,
    padding: 18,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#191f28',
    fontSize: 19,
    fontWeight: '900',
  },
  resultGuide: {
    color: '#8b95a1',
    fontSize: 13,
    lineHeight: 18,
  },
  resetText: {
    color: '#3182f6',
    fontSize: 14,
    fontWeight: '800',
  },
  predictionRow: {
    borderColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 12,
  },
  predictionRowSelected: {
    backgroundColor: '#f5f9ff',
    borderColor: '#3182f6',
  },
  predictionTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  predictionLabel: {
    color: '#333d4b',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  predictionScore: {
    color: '#4e5968',
    fontSize: 15,
    fontWeight: '800',
  },
  predictionMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  progressTrack: {
    backgroundColor: '#e5e8eb',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#3182f6',
    borderRadius: 999,
    height: '100%',
  },
  endpointCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 6,
    padding: 16,
  },
  endpointTitle: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '800',
  },
  endpointUrl: {
    color: '#4e5968',
    fontSize: 13,
    lineHeight: 18,
  },
  confirmCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 16,
    padding: 18,
  },
  confirmHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmLabel: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  confirmTitle: {
    color: '#191f28',
    fontSize: 22,
    fontWeight: '900',
  },
  confirmPlaceholder: {
    color: '#8b95a1',
    fontSize: 14,
    lineHeight: 21,
  },
  nutritionBox: {
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    gap: 12,
    padding: 14,
  },
  nutritionKcal: {
    color: '#191f28',
    fontSize: 17,
    fontWeight: '900',
  },
  nutrientRow: {
    flexDirection: 'row',
    gap: 8,
  },
  nutrientItem: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flex: 1,
    gap: 4,
    paddingVertical: 10,
  },
  nutrientLabel: {
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '700',
  },
  nutrientValue: {
    color: '#333d4b',
    fontSize: 15,
    fontWeight: '800',
  },
  manualBox: {
    gap: 10,
  },
  matchedNote: {
    color: '#3182f6',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  manualGuide: {
    color: '#6b7684',
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#edf6ff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#3182f6',
    fontSize: 14,
    fontWeight: '800',
  },
  manualInput: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    color: '#191f28',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  choiceSection: {
    gap: 8,
  },
  choiceLabel: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '800',
  },
  confirmFooter: {
    alignItems: 'center',
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  finalKcalLabel: {
    color: '#6b7684',
    fontSize: 14,
    fontWeight: '700',
  },
  finalKcalValue: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
});
