import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TabHeader } from '@/components/tab-header';
import { PathWeek, VisitPath } from '@/components/visit-path';
import { DISPLAY_FONT } from '@/constants/typography';
import { confirmDialog } from '@/services/dialog';
import { formatFullDate, formatMonthDay } from '@/services/format';
import { formatDateParam, getTrends, recentDateRange, TrendsResponse } from '@/services/health-api';
import { clearNextVisit, daysUntil, getNextVisit, setNextVisit } from '@/services/visit-api';

const PATH_DAYS = 28;
const WEEK_LABELS = ['3주 전', '2주 전', '지난주', '이번 주'];

// 진료 탭 (2026-10-05 화면 재구성). 사용자가 말한 '병원 연계'가 이 탭이다.
//
// ⚠️ **연계는 예약·중개가 아니라 준비다.** 우리가 환자를 병원에 보내는 게 아니라, 환자가 병원에서
// 받아 온 것을 이어받는다(서버 `docs/CARE_LOOP.md` §3 — 방향이 반대라 알선이 성립하지 않는다).
// 그래서 버튼은 '예약'이 아니라 '적기'이고, 아이콘은 십자가 아니라 가방이다.
//
// 한 바퀴(케어 루프 §1) = 진료일 적기 → 길을 따라 기록 → 진료 가방 챙기기 → 다녀와서 받아 온 것
// 적기 → 다음 진료일 적기. 예전엔 '돌아보기' 탭 맨 아래 한 묶음이었다(KCAL-34).
export default function VisitScreen() {
  const router = useRouter();
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [visitOutcome, setVisitOutcome] = useState<string | null>(null);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const loadTrends = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { start_date, end_date } = recentDateRange(PATH_DAYS);

      setTrends(await getTrends(start_date, end_date));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 기록·검사 수치 화면에서 돌아오면 길과 가방이 갱신돼 있어야 하므로 포커스마다 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      void getNextVisit()
        .then(({ scheduled_on, outcome }) => {
          setVisitDate(scheduled_on);
          setVisitOutcome(outcome);
        })
        // 진료일 조회 실패로 이 탭을 막지 않는다 — 없는 것과 같이 취급한다.
        .catch(() => {
          setVisitDate(null);
          setVisitOutcome(null);
        });

      void loadTrends();
    }, [loadTrends])
  );

  const weeks = useMemo(() => (trends === null ? [] : toWeeks(trends)), [trends]);
  const recordedDays = weeks.reduce((acc, week) => acc + week.recorded, 0);
  const remaining = visitDate === null ? null : daysUntil(visitDate);

  const openReport = () => {
    // **길에 적힌 기간을 그대로 리포트에 넘긴다.** 리포트 화면은 파라미터가 없으면 자체 기본 기간을
    // 쓰는데, 그러면 가방에 적힌 '22/28일'과 리포트 안의 기록 일수가 서로 달라진다.
    router.push({
      pathname: '/report',
      params: trends === null ? {} : { start_date: trends.start_date, end_date: trends.end_date },
    });
  };

  return (
    <Screen gap={16} keyboard="avoid">
      <TabHeader title="진료 준비" />

      {isEditing ? (
        <VisitEditor
          scheduledOn={visitDate}
          outcome={visitOutcome}
          onClose={() => setIsEditing(false)}
          onSaved={(date, note) => {
            setVisitDate(date);
            setVisitOutcome(note);
            setIsEditing(false);
          }}
        />
      ) : remaining !== null && remaining < 0 ? (
        <AfterVisitCard
          visitDate={visitDate ?? ''}
          onPressLabs={() => router.push('/labs')}
          onPressWrite={() => setIsEditing(true)}
        />
      ) : (
        <DdayCard
          visitDate={visitDate}
          remaining={remaining}
          onPressEdit={() => setIsEditing(true)}
          onPressReport={openReport}
        />
      )}

      {isLoading ? (
        <LoadingState label="지난 4주 기록을 불러오는 중입니다." />
      ) : errorMessage ? (
        <ErrorBanner message={errorMessage} onRetry={() => void loadTrends()} />
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              진료까지의 길
            </Text>
            <Text style={styles.cardMeta}>{`지난 4주 · ${recordedDays}일 남김`}</Text>
          </View>
          <VisitPath
            weeks={weeks}
            remainingDays={remaining}
            // 지난 진료일은 도착점이 아니다 — 다음 날짜를 적을 차례라 '진료일 적기'로 둔다.
            visitLabel={
              visitDate === null || remaining === null || remaining < 0
                ? null
                : formatMonthDay(visitDate)
            }
            onPressFinish={() => setIsEditing(true)}
          />
        </View>
      )}

      <View style={styles.bag}>
        <View style={styles.cardHead}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            진료 가방
          </Text>
          <Text style={styles.cardMeta}>진료 날 챙길 것</Text>
        </View>

        <BagRow
          icon="description"
          title="4주 기록 리포트"
          hint={
            recordedDays === 0
              ? '기록이 쌓이면 진료에 가져갈 수 있게 정리해 드려요'
              : `${PATH_DAYS}일 중 ${recordedDays}일 · 진료실에서 바로 보여 줄 수 있어요`
          }
          onPress={openReport}
        />
        {/* 검사 수치는 **우리가 재지 않는다** — 결과지를 옮겨 적는 곳이다(CLAUDE.md '검사 수치'). */}
        <BagRow
          icon="science"
          title="검사 결과"
          hint="병원에서 받은 결과지를 옮겨 적으면 리포트에 함께 실려요"
          onPress={() => router.push('/labs')}
        />
        {/* 진료에서 들은 것. 처방을 대신 적는 곳이 아니라 **옮겨 적는 곳**이다. */}
        <BagRow
          icon="chat-bubble-outline"
          title="진료에서 들은 것"
          hint={
            visitOutcome !== null && visitOutcome !== ''
              ? visitOutcome
              : '다녀와서 적어 두면 다음 진료 때 꺼내 볼 수 있어요'
          }
          onPress={() => setIsEditing(true)}
        />
      </View>
    </Screen>
  );
}

// 오늘 포함 최근 28일을 7일씩 네 칸으로. 서버가 기록 없는 날을 빼고 줄 수 있어 날짜로 맞춘다.
function toWeeks(trends: TrendsResponse): PathWeek[] {
  const recordedDates = new Set(
    trends.days.filter((day) => day.meal_count > 0).map((day) => day.date),
  );
  const today = new Date();

  return WEEK_LABELS.map((label, weekIndex) => {
    let recorded = 0;

    for (let offset = 0; offset < 7; offset += 1) {
      const daysAgo = (WEEK_LABELS.length - 1 - weekIndex) * 7 + (6 - offset);
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);

      if (recordedDates.has(formatDateParam(date))) {
        recorded += 1;
      }
    }

    return { label, recorded, total: 7 };
  });
}

function DdayCard({
  visitDate,
  remaining,
  onPressEdit,
  onPressReport,
}: {
  visitDate: string | null;
  remaining: number | null;
  onPressEdit: () => void;
  onPressReport: () => void;
}) {
  if (visitDate === null || remaining === null) {
    return (
      <View style={styles.hero}>
        <View style={styles.heroBody}>
          <Text style={styles.heroKicker}>다음 진료일</Text>
          <Text style={styles.heroTitle}>언제 가세요?</Text>
          <Text style={styles.heroText}>적어 두면 진료까지 남은 길을 보여 드려요</Text>
        </View>
        <HeroButton label="적기" onPress={onPressEdit} />
      </View>
    );
  }

  if (remaining === 0) {
    return (
      <View style={styles.hero}>
        <View style={styles.heroBody}>
          <Text style={styles.heroKicker}>오늘 진료일이에요</Text>
          <Text style={styles.heroTitle}>리포트를 챙기세요</Text>
          <Text style={styles.heroText}>진료실에서 이 화면의 리포트를 바로 보여 줄 수 있어요</Text>
        </View>
        <HeroButton label="리포트" onPress={onPressReport} />
      </View>
    );
  }

  return (
    <View style={styles.hero}>
      <View style={styles.heroBody}>
        <Text style={styles.heroKicker}>다음 진료</Text>
        <Text style={styles.heroTitle}>{formatFullDate(visitDate)}</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onPressEdit}>
          <Text style={styles.heroLink}>날짜 바꾸기</Text>
        </Pressable>
      </View>
      <Text style={styles.dday}>{`D-${remaining}`}</Text>
    </View>
  );
}

// 진료일이 지나면 D-day 자리가 바뀐다 — **한 바퀴를 닫는 곳**이다. 받아 온 것을 적고 다음 진료일을
// 적으면 새 길이 시작된다(케어 루프 ⑤→⑥→①). '지났어요'로 끝내면 앱이 할 일이 없어진다(§0-2).
function AfterVisitCard({
  visitDate,
  onPressLabs,
  onPressWrite,
}: {
  visitDate: string;
  onPressLabs: () => void;
  onPressWrite: () => void;
}) {
  return (
    <View style={styles.afterCard}>
      <View style={styles.afterHead}>
        <View style={styles.afterBadge}>
          <MaterialIcons color="#ffffff" name="flag" size={28} />
        </View>
        <View style={styles.heroBody}>
          <Text style={styles.afterKicker}>{`한 바퀴 완주 · ${formatMonthDay(visitDate)} 진료`}</Text>
          <Text style={styles.afterTitle}>받아 온 것을 적어 두세요</Text>
        </View>
      </View>
      <StepButton index="①" label="검사 결과 옮겨 적기" onPress={onPressLabs} />
      <StepButton index="②" label="들은 말 · 다음 진료일 적기" onPress={onPressWrite} />
    </View>
  );
}

function StepButton({ index, label, onPress }: { index: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
      <Text style={styles.stepIndex}>{index}</Text>
      <Text style={styles.stepLabel}>{label}</Text>
      <MaterialIcons color="#2f5fc4" name="chevron-right" size={22} />
    </Pressable>
  );
}

function HeroButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
      <Text style={styles.heroButtonText}>{label}</Text>
    </Pressable>
  );
}

function BagRow({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.bagRow, pressed && styles.pressed]}>
      <View style={styles.bagIcon}>
        <MaterialIcons color="#2f5fc4" name={icon} size={22} />
      </View>
      <View style={styles.bagBody}>
        <Text style={styles.bagTitle}>{title}</Text>
        <Text numberOfLines={2} style={styles.bagHint}>
          {hint}
        </Text>
      </View>
      <MaterialIcons color="#2f5fc4" name="chevron-right" size={22} />
    </Pressable>
  );
}

// 다음 진료일·들은 말 편집. ⚠️ **예약이 아니다** — 병원과 아무것도 주고받지 않는 사용자 메모다.
// 날짜 입력은 검사 수치 화면과 같은 YYYY-MM-DD 직접 입력이다 — 날짜 선택 패키지를 들이지 않고
// 웹·네이티브를 같은 코드로 유지한다. (2026-10-05 돌아보기 탭의 VisitCard 편집부를 옮겼다.)
function VisitEditor({
  scheduledOn,
  outcome,
  onSaved,
  onClose,
}: {
  scheduledOn: string | null;
  outcome: string | null;
  onSaved: (date: string | null, note: string | null) => void;
  onClose: () => void;
}) {
  // 지난 진료일이어도 그 날짜로 시작한다 — 서버는 날짜 없이 메모만 저장하지 않으므로, 다음 진료일이
  // 아직 안 정해진 사람도 들은 말부터 적을 수 있어야 한다.
  const isPast = scheduledOn !== null && (daysUntil(scheduledOn) ?? 0) < 0;
  const [draft, setDraft] = useState(scheduledOn ?? '');
  const [noteDraft, setNoteDraft] = useState(outcome ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const saved = await setNextVisit(draft.trim(), noteDraft);

      onSaved(saved.scheduled_on, saved.outcome);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    const confirmed = await confirmDialog({
      title: '진료 일정 삭제',
      message: '적어 둔 다음 진료일을 지울까요?',
      confirmLabel: '삭제',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      await clearNextVisit();
      onSaved(null, null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '삭제하지 못했습니다.');
    }
  };

  return (
    <View style={styles.editor}>
      <Text style={styles.cardTitle}>진료 메모</Text>

      <Text nativeID="visit-date-label" style={styles.editorLabel}>
        다음 진료일
      </Text>
      <TextInput
        accessibilityLabelledBy="visit-date-label"
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        onChangeText={setDraft}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#a9a6a1"
        style={styles.editorInput}
        value={draft}
      />
      {isPast ? (
        <Text style={styles.editorHint}>지난 진료일이에요. 다음 진료일이 정해지면 바꿔 적어 주세요.</Text>
      ) : null}

      {/* 진료에서 들은 것. **처방을 대신 적는 곳이 아니라 옮겨 적는 곳**이라 서식을 주지 않는다 —
          사용자가 들은 말 그대로가 가장 정확하다. 미동의(403)면 서버가 막고 그 문장을 보여 준다. */}
      <Text nativeID="visit-note-label" style={styles.editorLabel}>
        진료에서 들은 것
      </Text>
      <TextInput
        accessibilityLabelledBy="visit-note-label"
        multiline
        onChangeText={setNoteDraft}
        placeholder="예: 짜게 먹지 말 것, 석 달 뒤 피검사"
        placeholderTextColor="#a9a6a1"
        style={[styles.editorInput, styles.editorNote]}
        value={noteDraft}
      />

      {error !== null ? <Text style={styles.editorError}>{error}</Text> : null}

      <View style={styles.editorActions}>
        <Pressable
          disabled={isSaving}
          onPress={() => void save()}
          style={({ pressed }) => [styles.editorPrimary, pressed && styles.pressed]}>
          <Text style={styles.editorPrimaryText}>{isSaving ? '저장 중…' : '저장'}</Text>
        </Pressable>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.editorGhost, pressed && styles.pressed]}>
          <Text style={styles.editorGhostText}>취소</Text>
        </Pressable>
        {scheduledOn !== null ? (
          <Pressable
            onPress={() => void remove()}
            style={({ pressed }) => [styles.editorGhost, pressed && styles.pressed]}>
            <Text style={styles.editorDangerText}>삭제</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  afterBadge: {
    alignItems: 'center',
    backgroundColor: '#2f5fc4',
    borderColor: '#ffc83d',
    borderRadius: 30,
    borderWidth: 4,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  afterCard: {
    backgroundColor: '#e3ebfb',
    borderBottomWidth: 5,
    borderColor: '#c9d6f2',
    borderRadius: 22,
    borderWidth: 2,
    gap: 10,
    padding: 16,
  },
  afterHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  afterKicker: {
    color: '#1e4290',
    fontSize: 14,
    fontWeight: '800',
  },
  afterTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 23,
  },
  bag: {
    gap: 10,
  },
  bagBody: {
    flex: 1,
    gap: 2,
  },
  bagHint: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 18,
  },
  bagIcon: {
    alignItems: 'center',
    backgroundColor: '#e3ebfb',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  bagRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 4,
    borderColor: '#c9d6f2',
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bagTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 6,
    padding: 14,
  },
  cardHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardMeta: {
    color: '#5c5b57',
    fontSize: 14,
    fontWeight: '800',
  },
  cardTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 21,
  },
  dday: {
    color: '#ffffff',
    fontFamily: DISPLAY_FONT,
    fontSize: 46,
  },
  editor: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#c9d6f2',
    borderRadius: 20,
    borderWidth: 2,
    gap: 8,
    padding: 16,
  },
  editorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  editorDangerText: {
    color: '#b8524e',
    fontSize: 16,
    fontWeight: '800',
  },
  editorError: {
    color: '#b8524e',
    fontSize: 14,
    fontWeight: '700',
  },
  editorGhost: {
    alignItems: 'center',
    borderColor: '#e4e2de',
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
  },
  editorGhostText: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  editorHint: {
    color: '#1e4290',
    fontSize: 13,
    fontWeight: '700',
  },
  editorInput: {
    backgroundColor: '#ffffff',
    borderColor: '#c9d6f2',
    borderRadius: 12,
    borderWidth: 2,
    color: '#22211f',
    fontSize: 17,
    fontWeight: '700',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  editorLabel: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  editorNote: {
    minHeight: 84,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  editorPrimary: {
    alignItems: 'center',
    backgroundColor: '#2f5fc4',
    borderBottomWidth: 4,
    borderColor: '#1e4290',
    borderRadius: 14,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
  },
  editorPrimaryText: {
    color: '#ffffff',
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: '#2f5fc4',
    borderBottomWidth: 5,
    borderColor: '#1e4290',
    borderRadius: 22,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  heroBody: {
    flex: 1,
    gap: 2,
  },
  heroButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 4,
    borderColor: '#1e4290',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
  },
  heroButtonText: {
    color: '#1e4290',
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
  },
  heroKicker: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  heroLink: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    paddingVertical: 4,
    textDecorationLine: 'underline',
  },
  heroText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  heroTitle: {
    color: '#ffffff',
    fontFamily: DISPLAY_FONT,
    fontSize: 24,
  },
  pressed: {
    opacity: 0.74,
  },
  sectionTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 21,
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 4,
    borderColor: '#c9d6f2',
    borderRadius: 14,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  stepIndex: {
    color: '#2f5fc4',
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
  },
  stepLabel: {
    color: '#22211f',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
});
