import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  CALORIE_API_URL,
  CALORIE_DETAIL_API_URL,
  Prediction,
  requestCalorieDetail,
  uploadFoodPhoto,
} from '@/services/calorie-api';

export default function HomeScreen() {
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calorieResult, setCalorieResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const topPrediction = predictions[0];
  const confidence = useMemo(() => {
    if (!topPrediction) {
      return null;
    }

    return `${Math.round(topPrediction.score * 100)}%`;
  }, [topPrediction]);

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
      setSelectedPrediction(null);
      setCalorieResult(null);
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
      setSelectedPrediction(null);
      setCalorieResult(null);
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
      setSelectedPrediction(null);
      setCalorieResult(null);
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
    setSelectedPrediction(null);
    setCalorieResult(null);
    setErrorMessage(null);
  };

  const calculateCalories = async (prediction: Prediction) => {
    setSelectedPrediction(prediction);
    setCalorieResult(null);
    setIsCalculating(true);
    setErrorMessage(null);

    try {
      const result = await requestCalorieDetail(prediction.label);
      setCalorieResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      setErrorMessage(message);
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>K-Cal AI</Text>
            <Text style={styles.title}>사진 한 장으로{"\n"}식단을 확인해요</Text>
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
            <Text style={styles.resultGuide}>음식을 선택하면 예상 칼로리를 계산합니다.</Text>
            {predictions.map((prediction) => (
              <PredictionRow
                key={`${prediction.label}-${prediction.score}`}
                isSelected={selectedPrediction?.label === prediction.label}
                prediction={prediction}
                onPress={() => calculateCalories(prediction)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.endpointCard}>
            <Text style={styles.endpointTitle}>연결 서버</Text>
            <Text style={styles.endpointUrl}>{CALORIE_API_URL}</Text>
          </View>
        )}

        {selectedPrediction || isCalculating || calorieResult ? (
          <View style={styles.calorieCard}>
            <View style={styles.calorieHeader}>
              <View>
                <Text style={styles.calorieLabel}>칼로리 계산</Text>
                <Text style={styles.calorieTitle}>{selectedPrediction?.label ?? '음식을 선택해주세요'}</Text>
              </View>
              {isCalculating ? <ActivityIndicator color="#3182f6" /> : null}
            </View>
            {calorieResult ? (
              <Text style={styles.calorieResult}>{calorieResult}</Text>
            ) : (
              <Text style={styles.caloriePlaceholder}>
                {isCalculating ? '선택한 음식의 칼로리를 계산하고 있어요.' : '분석 결과 중 하나를 선택해주세요.'}
              </Text>
            )}
            <Text style={styles.endpointCaption}>{CALORIE_DETAIL_API_URL}</Text>
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
  calorieCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 14,
    padding: 18,
  },
  calorieHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calorieLabel: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  calorieTitle: {
    color: '#191f28',
    fontSize: 22,
    fontWeight: '900',
  },
  calorieResult: {
    color: '#333d4b',
    fontSize: 15,
    lineHeight: 23,
  },
  caloriePlaceholder: {
    color: '#8b95a1',
    fontSize: 14,
    lineHeight: 21,
  },
  endpointCaption: {
    color: '#b0b8c1',
    fontSize: 12,
    lineHeight: 17,
  },
});
