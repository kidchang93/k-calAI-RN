import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { formatMeasuredAt } from '@/services/format';
import { createWeight, getWeights, WeightLog } from '@/services/health-api';

// 최근 기록만 보여준다. 그래프는 진료 탭에 있다 — 이 화면의 범위가 아니다.
const RECENT_LIMIT = 30;

export default function WeightsScreen() {
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weightText, setWeightText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWeights = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await getWeights();

      // 서버 정렬을 신뢰하지 않는다 — 최근 측정이 위로 오게 정렬한다.
      setWeights(
        [...result]
          .sort((a, b) => b.measured_at.localeCompare(a.measured_at))
          .slice(0, RECENT_LIMIT),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWeights();
  }, [loadWeights]);

  // 검증 범위는 프로필의 몸무게 입력과 동일하다.
  const weight = Number(weightText);
  const isValid = Number.isFinite(weight) && weight >= 20 && weight <= 300;

  const save = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await createWeight({ weight_kg: weight });
      setWeightText('');
      await loadWeights();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen keyboard="avoid">
      <BackButton />

      <View style={styles.header}>
        <Text style={styles.title}>체중 기록</Text>
        <Text style={styles.subtitle}>오늘 잰 몸무게를 기록해두면 변화를 볼 수 있어요.</Text>
      </View>

      <View style={styles.formRow}>
        <View style={styles.inputRow}>
          <TextInput
            keyboardType="numeric"
            onChangeText={setWeightText}
            placeholder="70.5"
            placeholderTextColor="#a9a6a1"
            style={styles.input}
            value={weightText}
          />
          <Text style={styles.unit}>kg</Text>
        </View>
        <Pressable
          disabled={!isValid || isSaving}
          onPress={() => void save()}
          style={({ pressed }) => [
            styles.primaryButton,
            (!isValid || isSaving) && styles.primaryButtonDisabled,
            pressed && styles.pressed,
          ]}>
          {isSaving ? (
            <ActivityIndicator color="#22211f" />
          ) : (
            <Text style={styles.primaryButtonText}>기록</Text>
          )}
        </Pressable>
      </View>

      {errorMessage ? (
        <ErrorBanner message={errorMessage} onRetry={() => void loadWeights()} />
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>최근 기록</Text>

        {isLoading ? (
          <LoadingState label="체중 기록을 불러오는 중입니다." />
        ) : weights.length === 0 ? (
          <View style={styles.stateBox}>
            <MaterialIcons color="#a9a6a1" name="monitor-weight" size={32} />
            <Text style={styles.stateText}>아직 기록이 없어요. 첫 체중을 기록해보세요.</Text>
          </View>
        ) : (
          weights.map((log) => (
            <View key={log.id} style={styles.weightRow}>
              <MaterialIcons color="#5c5b57" name="monitor-weight" size={18} />
              <Text style={styles.weightDate}>{formatMeasuredAt(log.measured_at)}</Text>
              <Text style={styles.weightValue}>{`${log.weight_kg.toLocaleString()} kg`}</Text>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  header: {
    gap: 4,
  },
  input: {
    color: '#22211f',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    paddingVertical: 14,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e4e2de',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#60beb8',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  primaryButtonDisabled: {
    backgroundColor: '#99d2ce',
  },
  primaryButtonText: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '800',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: '#22211f',
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
    color: '#5c5b57',
    fontSize: 14,
    textAlign: 'center',
  },
  subtitle: {
    color: '#5c5b57',
    fontSize: 14,
  },
  title: {
    color: '#22211f',
    fontSize: 30,
    fontWeight: '900',
  },
  unit: {
    color: '#a9a6a1',
    fontSize: 14,
    fontWeight: '700',
  },
  weightDate: {
    color: '#5c5b57',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  weightRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  weightValue: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '800',
  },
});
