import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { MedicalDisclaimer } from '@/components/medical-disclaimer';
import { confirmDialog } from '@/services/dialog';
import { formatDateParam } from '@/services/health-api';
import {
  deleteLabResult,
  LabPanel,
  LabResult,
  listLabPanels,
  listLabResults,
  saveLabResult,
} from '@/services/lab-api';
import { ConsentRequiredError } from '@/services/onboarding-api';

// 검사 수치 (서버 `docs/CARE_LOOP.md` §4).
//
// **이 화면은 판정하지 않는다.** 수치를 그대로 두고 지침의 범위를 옆에 적을 뿐이다 —
// "정상입니다"라고 말하는 순간 진단이 된다. 색으로 좋고 나쁨을 칠하지 않는 것도 같은 이유다.
export default function LabsScreen() {
  const router = useRouter();
  const [panels, setPanels] = useState<LabPanel[]>([]);
  const [results, setResults] = useState<LabResult[]>([]);
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);

  // 입력 폼
  const [selectedPanel, setSelectedPanel] = useState<LabPanel | null>(null);
  const [valueText, setValueText] = useState('');
  const [measuredOn, setMeasuredOn] = useState(() => formatDateParam(new Date()));
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setNeedsConsent(false);

    try {
      const [panelResult, listResult] = await Promise.all([listLabPanels(), listLabResults()]);

      setPanels(panelResult.panels);
      setResults(listResult.results);
      setNotice(listResult.notice || panelResult.notice);
    } catch (error) {
      if (error instanceof ConsentRequiredError) {
        setNeedsConsent(true);
      } else {
        setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const save = async () => {
    if (selectedPanel === null) {
      return;
    }

    const value = Number(valueText);

    if (!Number.isFinite(value) || value <= 0) {
      setErrorMessage('수치를 숫자로 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await saveLabResult({
        measured_on: measuredOn,
        panel: selectedPanel.code,
        value,
        note: noteText.trim() || null,
      });

      setValueText('');
      setNoteText('');
      setSelectedPanel(null);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (result: LabResult) => {
    const confirmed = await confirmDialog({
      title: '기록 삭제',
      message: `${result.measured_on} ${result.label} ${result.value}${result.unit} 기록을 삭제할까요?`,
      confirmLabel: '삭제',
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteLabResult(result.id);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '삭제하지 못했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>검사 수치</Text>
            {/* '측정'이 아니라 '옮겨 적는다'로 쓴다 — 우리는 측정하지 않는다. */}
            <Text style={styles.subtitle}>
              병원 검사 결과지나 가정용 혈압계에서 본 값을 옮겨 적어 두면, 식단 기록과 함께
              진료 때 보여드릴 수 있어요.
            </Text>
          </View>

          {needsConsent ? (
            <View style={styles.consentBox}>
              <MaterialIcons color="#3182f6" name="lock-outline" size={24} />
              <Text style={styles.consentText}>
                검사 수치는 민감정보라 수집 동의가 필요해요.
              </Text>
              <Pressable
                onPress={() => router.push('/me/consents')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>동의 설정으로 이동</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {errorMessage !== null ? (
                <ErrorBanner message={errorMessage} onRetry={() => void load()} />
              ) : null}

              <AddForm
                measuredOn={measuredOn}
                noteText={noteText}
                onChangeDate={setMeasuredOn}
                onChangeNote={setNoteText}
                onChangeValue={setValueText}
                onSave={() => void save()}
                onSelectPanel={setSelectedPanel}
                panels={panels}
                isSaving={isSaving}
                selectedPanel={selectedPanel}
                valueText={valueText}
              />

              {isLoading ? (
                <View style={styles.stateBox}>
                  <ActivityIndicator color="#3182f6" />
                  <Text style={styles.stateText}>불러오는 중입니다.</Text>
                </View>
              ) : results.length === 0 ? (
                <View style={styles.stateBox}>
                  <MaterialIcons color="#b0b8c1" name="science" size={32} />
                  <Text style={styles.stateText}>
                    아직 기록이 없어요. 가장 최근 검사 결과부터 남겨보세요.
                  </Text>
                </View>
              ) : (
                <View style={styles.section}>
                  {results.map((result) => (
                    <ResultRow key={result.id} onDelete={() => void remove(result)} result={result} />
                  ))}
                </View>
              )}

              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              <MedicalDisclaimer tone="strong" />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AddForm({
  panels,
  selectedPanel,
  onSelectPanel,
  valueText,
  onChangeValue,
  measuredOn,
  onChangeDate,
  noteText,
  onChangeNote,
  onSave,
  isSaving,
}: {
  panels: LabPanel[];
  selectedPanel: LabPanel | null;
  onSelectPanel: (panel: LabPanel | null) => void;
  valueText: string;
  onChangeValue: (value: string) => void;
  measuredOn: string;
  onChangeDate: (value: string) => void;
  noteText: string;
  onChangeNote: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>수치 추가</Text>

      {/* 항목은 **하나씩 따로** 넣는다. 전 항목을 필수로 요구하면 결과지에 있는 것만 옮겨
          적을 수가 없다 — 학회 앱 '하이디'의 리뷰 불만이 정확히 그것이었다
          (서버 `docs/COMPETITIVE_LANDSCAPE.md` §2). */}
      <View style={styles.panelGrid}>
        {panels.map((panel) => (
          <Pressable
            key={panel.code}
            onPress={() => onSelectPanel(selectedPanel?.code === panel.code ? null : panel)}
            style={({ pressed }) => [
              styles.panelChip,
              selectedPanel?.code === panel.code && styles.panelChipActive,
              pressed && styles.pressed,
            ]}>
            <Text
              style={[
                styles.panelChipText,
                selectedPanel?.code === panel.code && styles.panelChipTextActive,
              ]}>
              {panel.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {selectedPanel !== null ? (
        <View style={styles.form}>
          {selectedPanel.reference !== null ? (
            <Text style={styles.reference}>{selectedPanel.reference}</Text>
          ) : null}

          <View style={styles.valueRow}>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={onChangeValue}
              placeholder="수치"
              placeholderTextColor="#b0b8c1"
              style={styles.valueInput}
              value={valueText}
            />
            <Text style={styles.unit}>{selectedPanel.unit}</Text>
          </View>

          <TextInput
            onChangeText={onChangeDate}
            placeholder="검사일 (YYYY-MM-DD)"
            placeholderTextColor="#b0b8c1"
            style={styles.input}
            value={measuredOn}
          />

          <TextInput
            onChangeText={onChangeNote}
            placeholder="메모 (선택) — 예: OO내과 정기검사"
            placeholderTextColor="#b0b8c1"
            style={styles.input}
            value={noteText}
          />

          <Pressable
            disabled={isSaving}
            onPress={onSave}
            style={({ pressed }) => [
              styles.primaryButton,
              isSaving && styles.buttonDisabled,
              pressed && !isSaving && styles.pressed,
            ]}>
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>저장</Text>
            )}
          </Pressable>

          <Text style={styles.sourceNote}>{`출처: ${selectedPanel.source}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ResultRow({ result, onDelete }: { result: LabResult; onDelete: () => void }) {
  return (
    <View style={styles.resultRow}>
      <View style={styles.resultBody}>
        <View style={styles.resultHead}>
          <Text style={styles.resultLabel}>{result.label}</Text>
          {/* 값에 색을 칠하지 않는다 — 색은 곧 판정이다. */}
          <Text style={styles.resultValue}>{`${result.value} ${result.unit}`}</Text>
        </View>
        <Text style={styles.resultMeta}>
          {result.note ? `${result.measured_on} · ${result.note}` : result.measured_on}
        </Text>
        {result.reference !== null ? (
          <Text style={styles.resultReference}>{result.reference}</Text>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel="이 기록 삭제"
        hitSlop={8}
        onPress={onDelete}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <MaterialIcons color="#e5484d" name="delete-outline" size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonDisabled: {
    backgroundColor: '#b4c7e7',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 14,
    padding: 18,
  },
  cardTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  consentBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 28,
  },
  consentText: {
    color: '#4e5968',
    fontSize: 14,
    textAlign: 'center',
  },
  container: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 720,
    width: '100%',
  },
  form: {
    gap: 10,
  },
  header: {
    gap: 6,
  },
  iconButton: {
    padding: 4,
  },
  input: {
    backgroundColor: '#f7f8fa',
    borderRadius: 8,
    color: '#191f28',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notice: {
    color: '#8b95a1',
    fontSize: 12,
    lineHeight: 18,
  },
  panelChip: {
    backgroundColor: '#f2f4f6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  panelChipActive: {
    backgroundColor: '#3182f6',
  },
  panelChipText: {
    color: '#4e5968',
    fontSize: 13,
    fontWeight: '700',
  },
  panelChipTextActive: {
    color: '#ffffff',
  },
  panelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  reference: {
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 19,
  },
  resultBody: {
    flex: 1,
    gap: 4,
  },
  resultHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  resultLabel: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
  },
  resultMeta: {
    color: '#8b95a1',
    fontSize: 12,
  },
  resultReference: {
    color: '#6b7684',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  resultRow: {
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  resultValue: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    gap: 8,
  },
  sourceNote: {
    color: '#b0b8c1',
    fontSize: 11,
    lineHeight: 16,
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
    textAlign: 'center',
  },
  subtitle: {
    color: '#6b7684',
    fontSize: 14,
    lineHeight: 21,
  },
  title: {
    color: '#191f28',
    fontSize: 26,
    fontWeight: '900',
  },
  unit: {
    color: '#6b7684',
    fontSize: 15,
    fontWeight: '700',
  },
  valueInput: {
    backgroundColor: '#f7f8fa',
    borderRadius: 8,
    color: '#191f28',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  valueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});
