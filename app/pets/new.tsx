import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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
import { PlanLimitBanner } from '@/components/plan-limit-banner';
import { PlanLimitError } from '@/services/http';
import { createPet } from '@/services/pet-api';

export default function PetNewScreen() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 402(반려동물 등록 한도) 전용 — 재시도가 아니라 요금제 화면으로 보낸다.
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState<PetFormValue | null>(null);

  const save = async (value: PetFormValue) => {
    setLastValue(value);
    setIsSaving(true);
    setErrorMessage(null);
    setPlanLimitMessage(null);

    try {
      const pet = await createPet(value);

      // 뒤로가기가 이 폼으로 돌아오지 않도록 상세로 교체 이동한다. 목록은 포커스 시 재조회된다.
      router.replace({ pathname: '/pets/[id]', params: { id: String(pet.id) } });
    } catch (error) {
      if (error instanceof PlanLimitError) {
        setPlanLimitMessage(error.message);
      } else {
        setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      }
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
              <Text style={styles.title}>반려동물 등록</Text>
              <Text style={styles.subtitle}>이름과 종류만 있으면 바로 시작할 수 있어요.</Text>
            </View>

            {errorMessage ? (
              <ErrorBanner
                message={errorMessage}
                onRetry={() => {
                  if (lastValue !== null) {
                    void save(lastValue);
                  }
                }}
              />
            ) : null}

            {planLimitMessage ? (
              <PlanLimitBanner message={planLimitMessage} onUpgrade={() => router.push('/plan')} />
            ) : null}

            <PetForm isSaving={isSaving} onSubmit={(value) => void save(value)} submitLabel="등록하기" />
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
