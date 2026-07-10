import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { formatDateParam } from '@/services/health-api';
import {
  createFeeding,
  deletePet,
  FeedingResponse,
  getFeedings,
  getPets,
  PetResponse,
  PetSpecies,
} from '@/services/pet-api';

const SPECIES_LABELS: Record<PetSpecies, string> = {
  dog: '강아지',
  cat: '고양이',
  other: '기타',
};

export default function PetDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const petId = Number(params.id);
  const isValidId = Number.isInteger(petId) && petId > 0;

  const [pet, setPet] = useState<PetResponse | null>(null);
  const [feedings, setFeedings] = useState<FeedingResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [foodLabel, setFoodLabel] = useState('');
  const [amountText, setAmountText] = useState('');
  const [isSavingFeeding, setIsSavingFeeding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadPet = useCallback(async () => {
    if (!isValidId) {
      setIsLoading(false);
      setErrorMessage('반려동물을 찾을 수 없습니다.');

      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 단건 조회 API가 없어(9장 계약) 목록에서 찾는다. soft delete 된 펫은 목록에 없다.
      const pets = await getPets();
      const found = pets.find((item) => item.id === petId) ?? null;

      if (found === null) {
        setPet(null);
        setErrorMessage('반려동물을 찾을 수 없습니다.');

        return;
      }

      setPet(found);
      // 하루 경계는 서버 기준 UTC지만, 조회 파라미터는 기존 홈(끼니)과 같은 로컬 날짜 규칙을 쓴다.
      setFeedings(await getFeedings(petId, formatDateParam(new Date())));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [isValidId, petId]);

  // 수정 화면에서 돌아왔을 때 갱신되도록 포커스마다 다시 읽는다 (홈 화면 패턴).
  useFocusEffect(
    useCallback(() => {
      void loadPet();
    }, [loadPet])
  );

  const amount = Number(amountText);
  const isFeedingValid =
    foodLabel.trim().length > 0 && Number.isFinite(amount) && amount > 0 && amount <= 99999;

  const saveFeeding = async () => {
    setIsSavingFeeding(true);
    setErrorMessage(null);

    try {
      await createFeeding(petId, { food_label: foodLabel.trim(), amount_g: amount });
      setFoodLabel('');
      setAmountText('');
      setFeedings(await getFeedings(petId, formatDateParam(new Date())));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSavingFeeding(false);
    }
  };

  const confirmDelete = (target: PetResponse) => {
    Alert.alert('반려동물 삭제', `'${target.name}' 기록을 삭제할까요? 되돌릴 수 없습니다.`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void removePet() },
    ]);
  };

  const removePet = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deletePet(petId);
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalAmount = feedings.reduce((sum, feeding) => sum + feeding.amount_g, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.container}>
            <BackButton />

            {isLoading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color="#3182f6" />
                <Text style={styles.stateText}>반려동물 정보를 불러오는 중입니다.</Text>
              </View>
            ) : pet === null ? (
              errorMessage ? (
                <ErrorBanner message={errorMessage} onRetry={() => void loadPet()} />
              ) : null
            ) : (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>{pet.name}</Text>
                  <Text style={styles.subtitle}>{buildPetMeta(pet)}</Text>
                </View>

                {errorMessage ? (
                  <ErrorBanner message={errorMessage} onRetry={() => void loadPet()} />
                ) : null}

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>오늘 급여</Text>
                    <Text style={styles.sectionMeta}>
                      {feedings.length === 0 ? '기록 없음' : `총 ${totalAmount.toLocaleString()}g`}
                    </Text>
                  </View>

                  {feedings.map((feeding) => (
                    <View key={feeding.id} style={styles.feedingRow}>
                      <MaterialIcons color="#4e5968" name="restaurant" size={18} />
                      <View style={styles.feedingBody}>
                        <Text style={styles.feedingLabel}>{feeding.food_label}</Text>
                        <Text style={styles.feedingMeta}>{formatTime(feeding.fed_at)}</Text>
                      </View>
                      <Text style={styles.feedingAmount}>{`${feeding.amount_g.toLocaleString()}g`}</Text>
                    </View>
                  ))}

                  <View style={styles.feedingForm}>
                    <View style={styles.inputRow}>
                      <TextInput
                        maxLength={100}
                        onChangeText={setFoodLabel}
                        placeholder="사료 이름"
                        placeholderTextColor="#b0b8c1"
                        style={styles.input}
                        value={foodLabel}
                      />
                    </View>
                    <View style={styles.amountRow}>
                      <View style={styles.inputRowSmall}>
                        <TextInput
                          keyboardType="numeric"
                          onChangeText={setAmountText}
                          placeholder="60"
                          placeholderTextColor="#b0b8c1"
                          style={styles.input}
                          value={amountText}
                        />
                        <Text style={styles.unit}>g</Text>
                      </View>
                      <Pressable
                        disabled={!isFeedingValid || isSavingFeeding}
                        onPress={() => void saveFeeding()}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          (!isFeedingValid || isSavingFeeding) && styles.primaryButtonDisabled,
                          pressed && styles.pressed,
                        ]}>
                        {isSavingFeeding ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={styles.primaryButtonText}>급여 기록</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                </View>

                <View style={styles.section}>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/pets/[id]/edit', params: { id: String(pet.id) } })
                    }
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <MaterialIcons color="#4e5968" name="edit" size={20} />
                    <Text style={styles.rowLabel}>정보 수정</Text>
                    <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
                  </Pressable>

                  <Pressable
                    disabled={isDeleting}
                    onPress={() => confirmDelete(pet)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <MaterialIcons color="#e5484d" name="delete-outline" size={20} />
                    {isDeleting ? (
                      <ActivityIndicator color="#e5484d" size="small" />
                    ) : (
                      <Text style={styles.deleteLabel}>삭제</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function buildPetMeta(pet: PetResponse): string {
  const parts = [SPECIES_LABELS[pet.species]];

  if (pet.breed !== null) {
    parts.push(pet.breed);
  }

  if (pet.birth_year !== null) {
    parts.push(`${pet.birth_year}년생`);
  }

  if (pet.weight_kg !== null) {
    parts.push(`${pet.weight_kg}kg`);
  }

  return parts.join(' · ');
}

// 서버의 UTC ISO 문자열을 기기 로컬 시각(HH:MM)으로 표시한다.
function formatTime(isoText: string): string {
  const date = new Date(isoText);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

const styles = StyleSheet.create({
  amountRow: {
    flexDirection: 'row',
    gap: 10,
  },
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  deleteLabel: {
    color: '#e5484d',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  feedingAmount: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
  },
  feedingBody: {
    flex: 1,
    gap: 2,
  },
  feedingForm: {
    gap: 10,
  },
  feedingLabel: {
    color: '#333d4b',
    fontSize: 15,
    fontWeight: '700',
  },
  feedingMeta: {
    color: '#8b95a1',
    fontSize: 12,
  },
  feedingRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  header: {
    gap: 4,
  },
  input: {
    color: '#191f28',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 12,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e8eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  inputRowSmall: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e8eb',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  keyboardView: {
    flex: 1,
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonDisabled: {
    backgroundColor: '#b4c7e7',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  rowLabel: {
    color: '#191f28',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionMeta: {
    color: '#6b7684',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#191f28',
    fontSize: 17,
    fontWeight: '800',
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
  unit: {
    color: '#8b95a1',
    fontSize: 14,
    fontWeight: '700',
  },
});
