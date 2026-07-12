import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { getPets, PetResponse, PetSpecies } from '@/services/pet-api';

const SPECIES_LABELS: Record<PetSpecies, string> = {
  dog: '강아지',
  cat: '고양이',
  other: '기타',
};

export default function PetsScreen() {
  const router = useRouter();
  const [pets, setPets] = useState<PetResponse[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPets = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setPets(await getPets());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 등록·수정·삭제 화면에서 돌아왔을 때 목록을 갱신하기 위해 포커스마다 다시 읽는다 (홈 화면 패턴).
  useFocusEffect(
    useCallback(() => {
      void loadPets();
    }, [loadPets])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>내 반려동물</Text>
            <Text style={styles.subtitle}>한 보호자가 여러 마리를 등록할 수 있어요.</Text>
          </View>

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>반려동물 목록을 불러오는 중입니다.</Text>
            </View>
          ) : errorMessage ? (
            <ErrorBanner message={errorMessage} onRetry={() => void loadPets()} />
          ) : pets === null || pets.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialIcons color="#3182f6" name="pets" size={28} />
              <Text style={styles.emptyTitle}>아직 등록한 반려동물이 없어요</Text>
              <Text style={styles.emptyText}>등록하면 급여 기록을 남길 수 있습니다.</Text>
            </View>
          ) : (
            <View style={styles.petList}>
              {pets.map((pet) => (
                <PetRow
                  key={pet.id}
                  pet={pet}
                  onPress={() =>
                    router.push({ pathname: '/pets/[id]', params: { id: String(pet.id) } })
                  }
                />
              ))}
            </View>
          )}

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              반려동물은 사람과 칼로리 계산식이 다릅니다. 지금은 급여량(g)만 기록해요.
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/pets/new')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>반려동물 등록</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PetRow({ pet, onPress }: { pet: PetResponse; onPress: () => void }) {
  const metaParts = [SPECIES_LABELS[pet.species]];

  if (pet.breed !== null) {
    metaParts.push(pet.breed);
  }

  if (pet.birth_year !== null) {
    metaParts.push(`${pet.birth_year}년생`);
  }

  if (pet.weight_kg !== null) {
    metaParts.push(`${pet.weight_kg}kg`);
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.petRow, pressed && styles.pressed]}>
      <MaterialIcons color="#3182f6" name="pets" size={24} />
      <View style={styles.petBody}>
        <Text style={styles.petName}>{pet.name}</Text>
        <Text style={styles.petMeta}>{metaParts.join(' · ')}</Text>
      </View>
      <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    padding: 24,
  },
  emptyText: {
    color: '#6b7684',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#191f28',
    fontSize: 19,
    fontWeight: '900',
  },
  header: {
    gap: 4,
  },
  noteBox: {
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    padding: 16,
  },
  noteText: {
    color: '#4e5968',
    fontSize: 13,
    lineHeight: 19,
  },
  petBody: {
    flex: 1,
    gap: 2,
  },
  petList: {
    gap: 10,
  },
  petMeta: {
    color: '#6b7684',
    fontSize: 13,
  },
  petName: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '800',
  },
  petRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
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
