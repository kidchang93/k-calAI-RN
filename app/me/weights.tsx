import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChunkyButton } from '@/components/chunky-button';
import { DetailHeader } from '@/components/detail-header';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { DISPLAY_FONT } from '@/constants/typography';
import { formatMeasuredAt } from '@/services/format';
import { createWeight, getWeights, WeightLog } from '@/services/health-api';

// 최근 기록만 보여준다. 그래프는 케어 탭에 있다 — 이 화면의 범위가 아니다.
const RECENT_LIMIT = 30;

export default function WeightsScreen() {
  // 최근 측정이 앞에 온다. 화면에는 RECENT_LIMIT 개만 그리지만, 마지막 줄의 '직전 대비'를 셀 수
  // 있도록 전부 들고 있는다.
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
      const sorted = [...result].sort((a, b) => b.measured_at.localeCompare(a.measured_at));

      setWeights(sorted);
      // 비어 있을 때만 가장 최근 값으로 채운다 — ± 로 조금씩 맞추면 된다. 입력 중인 값은 덮지 않는다.
      setWeightText((current) =>
        current === '' && sorted.length > 0 ? String(sorted[0].weight_kg) : current,
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
  // Number('') 는 0 이라 빈칸에서 ± 를 누르면 0.1 이 된다 — 빈칸·숫자 아님에서는 막는다.
  const canStep = weightText.trim() !== '' && Number.isFinite(weight);

  // 0.1kg 씩. 10배 정수로 더해 0.30000000000000004 같은 부동소수 꼬리를 남기지 않는다.
  const step = (tenths: number) => {
    setWeightText(((Math.round(weight * 10) + tenths) / 10).toFixed(1));
  };

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
    <Screen
      footer={
        <ChunkyButton
          disabled={!isValid}
          label="오늘 몸무게 적기"
          loading={isSaving}
          onPress={() => void save()}
          tone="care"
        />
      }
      keyboard="avoid">
      <DetailHeader caption="잰 날만 적어요" title="체중 기록" tone="care" />

      <View style={[styles.card, styles.inputCard]}>
        <Text style={styles.inputLabel}>오늘 몸무게</Text>
        <View style={styles.stepper}>
          <StepButton
            disabled={!canStep}
            label="0.1킬로그램 빼기"
            onPress={() => step(-1)}
            symbol="−"
          />
          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel="오늘 몸무게(킬로그램)"
              keyboardType="numeric"
              onChangeText={setWeightText}
              placeholder="70.5"
              placeholderTextColor="#a9a6a1"
              style={styles.input}
              value={weightText}
            />
            <Text style={styles.unit}>kg</Text>
          </View>
          <StepButton
            disabled={!canStep}
            label="0.1킬로그램 더하기"
            onPress={() => step(1)}
            symbol="+"
          />
        </View>
        {weights.length > 0 ? (
          <Text style={styles.inputHint}>지난번 값에서 시작해요. ± 로 조금씩 맞추면 돼요.</Text>
        ) : null}
      </View>

      {errorMessage ? (
        <ErrorBanner message={errorMessage} onRetry={() => void loadWeights()} />
      ) : null}

      <View style={[styles.card, styles.listCard]}>
        <Text style={styles.sectionTitle}>최근 기록</Text>

        {isLoading ? (
          <LoadingState label="체중 기록을 불러오는 중입니다." />
        ) : weights.length === 0 ? (
          <View style={styles.stateBox}>
            <MaterialIcons color="#a9a6a1" name="monitor-weight" size={32} />
            <Text style={styles.stateText}>아직 기록이 없어요. 첫 체중을 기록해보세요.</Text>
          </View>
        ) : (
          weights.slice(0, RECENT_LIMIT).map((log, index) => {
            const previous = weights[index + 1];

            return (
              <View key={log.id} style={styles.weightRow}>
                <Text style={styles.weightDate}>{formatMeasuredAt(log.measured_at)}</Text>
                <Text style={styles.weightValue}>{`${log.weight_kg.toLocaleString()} kg`}</Text>
                {previous !== undefined ? (
                  <Text style={styles.weightDiff}>{formatDiff(log.weight_kg, previous.weight_kg)}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* 서버에 체중 수정·삭제 라우트가 없다(POST·GET 만). */}
      <Text style={styles.notice}>
        변화는 색 없이 숫자로만 보여 드려요. 적은 값은 고치거나 지울 수 없어서, 잘못 적었으면 다시
        적으면 최신 값이 보여요.
      </Text>
    </Screen>
  );
}

// 직전 기록 대비. 색·화살표 없이 숫자만 — 늘고 준 것을 앱이 좋다 나쁘다 판정하지 않는다.
function formatDiff(current: number, previous: number): string {
  const tenths = Math.round((current - previous) * 10);

  if (tenths === 0) {
    return '±0';
  }

  return `${tenths > 0 ? '+' : '−'}${(Math.abs(tenths) / 10).toFixed(1)}`;
}

function StepButton({
  disabled,
  label,
  onPress,
  symbol,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  symbol: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.stepSymbol}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
  },
  disabled: {
    opacity: 0.5,
  },
  input: {
    backgroundColor: '#eef7f5',
    borderColor: '#bee2dd',
    borderRadius: 16,
    borderWidth: 2,
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 40,
    height: 64,
    paddingHorizontal: 8,
    paddingVertical: 0,
    textAlign: 'center',
    width: 128,
  },
  inputCard: {
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  inputHint: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  inputLabel: {
    alignSelf: 'flex-start',
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  listCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notice: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.74,
  },
  sectionTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
    paddingBottom: 6,
  },
  stateBox: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  stateText: {
    color: '#5c5b57',
    fontSize: 15,
    textAlign: 'center',
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 4,
    borderColor: '#e4e2de',
    borderRadius: 26,
    borderWidth: 2,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  stepSymbol: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 24,
  },
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  unit: {
    color: '#5c5b57',
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
  },
  weightDate: {
    color: '#5c5b57',
    flex: 1,
    fontSize: 15,
  },
  weightDiff: {
    color: '#5c5b57',
    fontSize: 15,
    minWidth: 40,
    textAlign: 'right',
  },
  weightRow: {
    alignItems: 'center',
    borderTopColor: '#e4e2de',
    borderTopWidth: 2,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
  },
  weightValue: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '800',
  },
});
