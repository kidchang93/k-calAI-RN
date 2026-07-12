import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { PetForm, PetFormValue } from '@/components/pet-form';
import { getPets, PetResponse, updatePet } from '@/services/pet-api';

export default function PetEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const petId = Number(params.id);
  const isValidId = Number.isInteger(petId) && petId > 0;

  const [pet, setPet] = useState<PetResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState<PetFormValue | null>(null);

  const loadPet = useCallback(async () => {
    if (!isValidId) {
      setIsLoading(false);
      setErrorMessage('반려동물을 찾을 수 없습니다.');

      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 단건 조회 API가 없어(9장 계약) 목록에서 찾는다.
      const pets = await getPets();
      const found = pets.find((item) => item.id === petId) ?? null;

      if (found === null) {
        setErrorMessage('반려동물을 찾을 수 없습니다.');

        return;
      }

      setPet(found);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [isValidId, petId]);

  // 편집 도중 목록이 바뀌어도 폼 입력을 잃지 않도록, 포커스 재조회 없이 마운트 시 1회만 읽는다.
  useEffect(() => {
    void loadPet();
  }, [loadPet]);

  const save = async (value: PetFormValue) => {
    setLastValue(value);
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updatePet(petId, value);
      // 상세 화면은 포커스 시 재조회하므로 돌아가기만 하면 된다.
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

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

            <View style={styles.header}>
              <Text style={styles.title}>정보 수정</Text>
              <Text style={styles.subtitle}>비워둔 선택 항목은 지워집니다.</Text>
            </View>

            {errorMessage ? (
              <ErrorBanner
                message={errorMessage}
                onRetry={() => {
                  if (lastValue !== null) {
                    void save(lastValue);
                  } else {
                    void loadPet();
                  }
                }}
              />
            ) : null}

            {isLoading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color="#3182f6" />
                <Text style={styles.stateText}>반려동물 정보를 불러오는 중입니다.</Text>
              </View>
            ) : pet === null ? null : (
              <PetForm
                initial={{
                  name: pet.name,
                  species: pet.species,
                  breed: pet.breed,
                  birth_year: pet.birth_year,
                  weight_kg: pet.weight_kg,
                  is_neutered: pet.is_neutered,
                }}
                isSaving={isSaving}
                onSubmit={(value) => void save(value)}
                submitLabel="저장하기"
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  header: {
    gap: 4,
  },
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
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
});
