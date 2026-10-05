import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChunkyButton } from '@/components/chunky-button';
import { DetailHeader } from '@/components/detail-header';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { MedicalDisclaimer } from '@/components/medical-disclaimer';
import { Screen } from '@/components/screen';
import { DISPLAY_FONT } from '@/constants/typography';
import { confirmDialog } from '@/services/dialog';
import { formatYearMonthDay } from '@/services/format';
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
//
// 2026-10-05: 결과지 한 장을 한 번에 옮겨 적는다. 내 질환 항목마다 칸을 펼쳐 두고, 값이 있는 칸만
// 기존 저장 API(POST /api/me/labs, 한 건씩)로 순서대로 보낸다 — 서버 계약은 그대로다.
export default function LabsScreen() {
  const router = useRouter();
  const [panels, setPanels] = useState<LabPanel[]>([]);
  const [results, setResults] = useState<LabResult[]>([]);
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);

  const [measuredOn, setMeasuredOn] = useState(() => formatDateParam(new Date()));
  // 항목 코드 → 입력한 글자. 비운 칸은 저장하지 않는다.
  const [values, setValues] = useState<Record<string, string>>({});
  const [noteText, setNoteText] = useState('');
  const [isOthersOpen, setIsOthersOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveOutcome, setSaveOutcome] = useState<SaveOutcome | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setNeedsConsent(false);

    try {
      const [panelResult, listResult] = await Promise.all([listLabPanels(), listLabResults()]);

      setPanels(panelResult.panels);
      setResults(listResult.results);
      setNotice(listResult.notice !== '' ? listResult.notice : panelResult.notice);
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

  const filledPanels = panels.filter((panel) => (values[panel.code] ?? '').trim() !== '');

  const saveAll = async () => {
    const invalid = filledPanels.filter((panel) => {
      const value = Number(values[panel.code]);

      return !(Number.isFinite(value) && value > 0);
    });

    if (invalid.length > 0) {
      setErrorMessage(`${invalid.map((panel) => panel.label).join(' · ')}: 수치를 숫자로 입력해주세요.`);
      return;
    }

    setErrorMessage(null);
    setSaveOutcome(null);
    setIsSaving(true);

    const trimmedNote = noteText.trim();
    const savedCodes = new Set<string>();
    const outcome: SaveOutcome = { saved: [], failed: [] };

    try {
      // 서버는 한 건씩 받는다. 순서대로 보내야 어느 칸이 실패했는지 칸 단위로 알릴 수 있다.
      for (const panel of filledPanels) {
        try {
          await saveLabResult({
            measured_on: measuredOn,
            panel: panel.code,
            value: Number(values[panel.code]),
            // 메모는 이번에 저장하는 모든 항목에 붙인다.
            note: trimmedNote === '' ? null : trimmedNote,
          });
          savedCodes.add(panel.code);
          outcome.saved.push(panel.label);
        } catch (error) {
          outcome.failed.push({
            label: panel.label,
            message: error instanceof Error ? error.message : '저장하지 못했습니다.',
          });
        }
      }
    } finally {
      // 저장된 칸만 비운다. 실패한 칸의 값과 메모는 남겨 다시 누르면 그대로 재시도된다.
      setValues((current) =>
        Object.fromEntries(Object.entries(current).filter(([code]) => !savedCodes.has(code)))
      );

      if (outcome.failed.length === 0) {
        setNoteText('');
      }

      setSaveOutcome(outcome);
      setIsSaving(false);
    }

    if (savedCodes.size > 0) {
      void load();
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

  // 서버가 내 질환 항목을 앞으로 정렬해 준다. 내 항목이 하나도 없으면(질환 미등록) 전부 펼친다.
  const minePanels = panels.filter((panel) => panel.is_mine);
  const mainPanels = minePanels.length > 0 ? minePanels : panels;
  const otherPanels = minePanels.length > 0 ? panels.filter((panel) => !panel.is_mine) : [];
  const latestByPanel = latestResults(results);

  const setValue = (code: string, text: string) =>
    setValues((current) => ({ ...current, [code]: text }));

  return (
    <Screen
      gap={14}
      keyboard="avoid"
      footer={
        needsConsent ? null : (
          <ChunkyButton
            disabled={filledPanels.length === 0}
            label="적은 결과 저장"
            loading={isSaving}
            onPress={() => void saveAll()}
            tone="visit"
          />
        )
      }>
      <DetailHeader caption="결과지를 보고 옮겨 적어요" title="검사 결과" tone="visit" />

      {/* '측정'이 아니라 '옮겨 적는다'로 쓴다 — 우리는 측정하지 않는다. */}
      <Text style={styles.subtitle}>
        병원 검사 결과지나 가정용 혈압계에서 본 값을 옮겨 적어 두면, 식단 기록과 함께
        진료 때 보여드릴 수 있어요.
      </Text>

      {needsConsent ? (
        <View style={styles.consentBox}>
          <MaterialIcons color="#1e4290" name="lock-outline" size={28} />
          <Text style={styles.consentText}>검사 수치는 민감정보라 수집 동의가 필요해요.</Text>
          <View style={styles.consentButton}>
            <ChunkyButton
              label="동의 설정으로 이동"
              onPress={() => router.push('/me/consents')}
              tone="visit"
            />
          </View>
        </View>
      ) : (
        <>
          {errorMessage !== null ? (
            <ErrorBanner message={errorMessage} onRetry={() => void load()} />
          ) : null}

          {panels.length > 0 ? (
            <View style={styles.card}>
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>검사일</Text>
                <TextInput
                  accessibilityLabel="검사일"
                  onChangeText={setMeasuredOn}
                  placeholder="검사일 (YYYY-MM-DD)"
                  placeholderTextColor="#a9a6a1"
                  style={[styles.input, styles.dateInput]}
                  value={measuredOn}
                />
              </View>

              {/* 칸은 **비워 둬도 된다** — 값이 있는 칸만 저장한다. 전 항목을 필수로 요구하면 결과지에
                  있는 것만 옮겨 적을 수가 없다 — 학회 앱 '하이디'의 리뷰 불만이 정확히 그것이었다
                  (서버 `docs/COMPETITIVE_LANDSCAPE.md` §2). */}
              {mainPanels.map((panel) => (
                <PanelField
                  key={panel.code}
                  latest={latestByPanel.get(panel.code) ?? null}
                  onChange={(text) => setValue(panel.code, text)}
                  panel={panel}
                  value={values[panel.code] ?? ''}
                />
              ))}

              {otherPanels.length === 0 ? null : isOthersOpen ? (
                otherPanels.map((panel) => (
                  <PanelField
                    key={panel.code}
                    latest={latestByPanel.get(panel.code) ?? null}
                    onChange={(text) => setValue(panel.code, text)}
                    panel={panel}
                    value={values[panel.code] ?? ''}
                  />
                ))
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsOthersOpen(true)}
                  style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
                  <Text style={styles.moreButtonText}>{`+ 다른 항목 ${otherPanels.length}개`}</Text>
                </Pressable>
              )}

              <View style={styles.noteField}>
                <Text style={styles.fieldLabel}>메모 (선택)</Text>
                <TextInput
                  accessibilityLabel="메모 (선택)"
                  onChangeText={setNoteText}
                  placeholder="예: OO내과 정기검사"
                  placeholderTextColor="#a9a6a1"
                  style={styles.input}
                  value={noteText}
                />
                <Text style={styles.fieldHint}>이번에 저장하는 모든 항목에 함께 붙어요.</Text>
              </View>

              {saveOutcome !== null ? <SaveOutcomeBox outcome={saveOutcome} /> : null}
            </View>
          ) : null}

          {isLoading ? (
            <LoadingState label="불러오는 중입니다." />
          ) : (
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                지난 결과
              </Text>
              {results.length === 0 ? (
                <View style={styles.stateBox}>
                  <MaterialIcons color="#a9a6a1" name="science" size={32} />
                  <Text style={styles.stateText}>
                    아직 기록이 없어요. 가장 최근 검사 결과부터 남겨보세요.
                  </Text>
                </View>
              ) : (
                groupByPanel(results).map(([code, panelResults]) => (
                  <ResultGroup
                    key={code}
                    onDelete={(result) => void remove(result)}
                    results={panelResults}
                  />
                ))
              )}
            </View>
          )}

          <Text style={styles.footnote}>
            저희는 수치를 재거나 판정하지 않아요. 옮겨 적은 값은 진료 리포트에 나란히 실려요.
          </Text>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <MedicalDisclaimer tone="strong" />
        </>
      )}
    </Screen>
  );
}

type SaveOutcome = {
  saved: string[];
  failed: { label: string; message: string }[];
};

function PanelField({
  panel,
  value,
  latest,
  onChange,
}: {
  panel: LabPanel;
  value: string;
  latest: LabResult | null;
  onChange: (text: string) => void;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldRow}>
        <View style={styles.fieldBody}>
          <Text style={styles.fieldLabel}>
            {panel.label}
            <Text style={styles.fieldUnit}>{`  ${panel.unit}`}</Text>
          </Text>
          {latest !== null ? (
            <Text style={styles.fieldHint}>
              {`지난번 ${latest.value} · ${formatYearMonthDay(latest.measured_on)}`}
            </Text>
          ) : null}
        </View>
        <TextInput
          accessibilityLabel={`${panel.label} 수치 (${panel.unit})`}
          keyboardType="decimal-pad"
          onChangeText={onChange}
          placeholder="숫자"
          placeholderTextColor="#a9a6a1"
          style={styles.valueInput}
          value={value}
        />
      </View>
      {/* 범위 문장은 서버가 지침에서 옮긴 그대로다 — 앱이 값과 비교하지 않는다. */}
      {panel.reference !== null ? <Text style={styles.reference}>{panel.reference}</Text> : null}
      <Text style={styles.sourceNote}>{`출처: ${panel.source}`}</Text>
    </View>
  );
}

function SaveOutcomeBox({ outcome }: { outcome: SaveOutcome }) {
  return (
    <View style={styles.outcomeBox}>
      {outcome.saved.length > 0 ? (
        <Text style={styles.outcomeSaved}>{`저장했어요: ${outcome.saved.join(' · ')}`}</Text>
      ) : null}
      {outcome.failed.map((failure) => (
        <Text key={failure.label} style={styles.outcomeFailed}>
          {`저장하지 못했어요: ${failure.label} — ${failure.message}`}
        </Text>
      ))}
      {outcome.failed.length > 0 ? (
        <Text style={styles.fieldHint}>못 한 칸은 값을 남겨 뒀어요. 다시 저장을 누르면 그 칸만 보내요.</Text>
      ) : null}
    </View>
  );
}

function ResultGroup({
  results,
  onDelete,
}: {
  results: LabResult[];
  onDelete: (result: LabResult) => void;
}) {
  const head = results[0];

  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{head.label}</Text>
      {head.reference !== null ? <Text style={styles.reference}>{head.reference}</Text> : null}
      {results.map((result) => (
        <View key={result.id} style={styles.resultRow}>
          <View style={styles.resultBody}>
            <Text style={styles.resultDate}>{formatYearMonthDay(result.measured_on)}</Text>
            {result.note ? <Text style={styles.resultNote}>{result.note}</Text> : null}
          </View>
          {/* 값에 색을 칠하지 않는다 — 색은 곧 판정이다. */}
          <Text style={styles.resultValue}>{`${result.value} ${result.unit}`}</Text>
          <Pressable
            accessibilityLabel="이 기록 삭제"
            accessibilityRole="button"
            onPress={() => onDelete(result)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <MaterialIcons color="#b8524e" name="delete-outline" size={22} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// 서버가 검사일 내림차순으로 준다 — 항목별 첫 기록이 가장 최근이다.
function latestResults(results: LabResult[]): Map<string, LabResult> {
  const map = new Map<string, LabResult>();

  for (const result of results) {
    if (!map.has(result.panel)) {
      map.set(result.panel, result);
    }
  }

  return map;
}

function groupByPanel(results: LabResult[]): [string, LabResult[]][] {
  const map = new Map<string, LabResult[]>();

  for (const result of results) {
    map.set(result.panel, [...(map.get(result.panel) ?? []), result]);
  }

  return [...map.entries()];
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#c9d6f2',
    borderRadius: 20,
    borderWidth: 2,
    gap: 14,
    padding: 16,
  },
  cardTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 21,
  },
  consentBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#c9d6f2',
    borderRadius: 20,
    borderWidth: 2,
    gap: 14,
    padding: 24,
  },
  consentButton: {
    alignSelf: 'stretch',
  },
  consentText: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  dateInput: {
    flex: 1,
    fontWeight: '800',
  },
  dateLabel: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
  },
  dateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    borderTopColor: '#e4e2de',
    borderTopWidth: 2,
    gap: 4,
    paddingTop: 12,
  },
  fieldBody: {
    flex: 1,
    gap: 2,
  },
  fieldHint: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 18,
  },
  fieldLabel: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  fieldRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  fieldUnit: {
    color: '#5c5b57',
    fontSize: 13,
    fontWeight: '600',
  },
  footnote: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 22,
  },
  group: {
    borderTopColor: '#e4e2de',
    borderTopWidth: 2,
    gap: 4,
    paddingTop: 10,
  },
  groupTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#c9d6f2',
    borderRadius: 12,
    borderWidth: 2,
    color: '#22211f',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  moreButton: {
    alignItems: 'center',
    borderColor: '#a9a6a1',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 48,
  },
  moreButtonText: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '800',
  },
  noteField: {
    gap: 6,
  },
  notice: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  outcomeBox: {
    backgroundColor: '#e3ebfb',
    borderRadius: 12,
    gap: 6,
    padding: 12,
  },
  outcomeFailed: {
    color: '#b8524e',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  outcomeSaved: {
    color: '#1e4290',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.74,
  },
  reference: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
  resultBody: {
    flex: 1,
    gap: 2,
  },
  resultDate: {
    color: '#22211f',
    fontSize: 15,
  },
  resultNote: {
    color: '#5c5b57',
    fontSize: 13,
  },
  resultRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
  },
  resultValue: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
  },
  sourceNote: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 18,
  },
  stateBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  stateText: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  subtitle: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 22,
  },
  valueInput: {
    backgroundColor: '#ffffff',
    borderColor: '#c9d6f2',
    borderRadius: 12,
    borderWidth: 2,
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
    minHeight: 50,
    paddingHorizontal: 12,
    width: 112,
  },
});
