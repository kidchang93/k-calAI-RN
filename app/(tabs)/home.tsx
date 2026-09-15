import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConditionGuideCard } from '@/components/condition-guide-card';
import { DayNutrientsCard } from '@/components/day-nutrients-card';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { MealTypeCard } from '@/components/meal-type-card';
import { NextMealCard } from '@/components/next-meal-card';
import { ProgressRing } from '@/components/progress-ring';
import { Screen } from '@/components/screen';
import { YesterdayCard } from '@/components/yesterday-card';
import { INTAKE_ESTIMATE_NOTICE } from '@/constants/ai-notice';
import { MEAL_TYPE_LABELS } from '@/constants/meal';
import { GuideSummary, listGuides } from '@/services/guide-api';
import { consumePendingInvite } from '@/services/group-invite';
import { daysUntil, getNextVisit } from '@/services/visit-api';
import {
  DaySummary,
  formatDateParam,
  getSummary,
  getTrends,
  MealBreakdown,
  MealType,
  TrendsResponse,
} from '@/services/health-api';
import {
  dismissYesterday,
  isYesterdayDismissed,
  yesterdayDateParam,
} from '@/services/yesterday-summary';
import {
  DietRecommendation,
  getRecommendation,
  nextMealType,
} from '@/services/recommendation-api';

const MEAL_ORDER: { meal_type: MealType; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { meal_type: 'breakfast', icon: 'wb-sunny' },
  { meal_type: 'lunch', icon: 'restaurant' },
  { meal_type: 'dinner', icon: 'dinner-dining' },
  { meal_type: 'snack', icon: 'cookie' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 다음 끼니 추천. 홈에서는 미리보기일 뿐이라 **실패해도 조용히 넘어간다** —
  // 403(민감정보 미동의)·네트워크 오류로 오늘 요약까지 막히면 안 된다.
  const [recommendation, setRecommendation] = useState<DietRecommendation | null>(null);
  const [mealType] = useState<MealType>(() => nextMealType());
  // 질환 가이드 진입점. 콘텐츠는 지침이 바뀔 때만 바뀌므로 마운트 1회만 읽는다.
  const [guides, setGuides] = useState<GuideSummary[]>([]);
  // 다음 진료일. 등록돼 있을 때만 한 줄 나타난다 — 없는 사람의 홈을 어지럽히지 않는다.
  const [visitDate, setVisitDate] = useState<string | null>(null);
  // 어제 하루. 요약 API(summary)가 아니라 추이 API를 하루 범위로 읽는다 — 끼니 수(meal_count)가
  // 있어야 "기록 없는 날"과 "0 kcal 기록"을 가를 수 있다. 닫았거나 실패하면 null.
  const [yesterday, setYesterday] = useState<TrendsResponse | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const today = formatDateParam(new Date());
      setSummary(await getSummary(today));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 로그인 전에 열린 초대 링크를 이어받는다. 홈은 인증·온보딩을 모두 통과해야 도달하므로,
  // 신규 가입자가 가입 → 온보딩을 마친 직후에도 초대받은 그룹으로 이어진다.
  // 코드는 읽으면서 지워지므로(consume) 홈에 다시 와도 반복되지 않는다.
  useEffect(() => {
    const pendingInvite = consumePendingInvite();

    if (pendingInvite) {
      router.replace({ pathname: '/groups/join', params: { code: pendingInvite } });
    }
  }, [router]);

  // 마운트 시 1회가 아니라 탭이 포커스될 때마다 다시 읽는다.
  // 기록 탭에서 끼니를 저장하고 돌아왔을 때 합계를 갱신하기 위함이다.
  useFocusEffect(
    useCallback(() => {
      void getNextVisit()
        .then((visit) => setVisitDate(visit.scheduled_on))
        // 진료일은 부가 정보다 — 실패해도 홈의 나머지를 막지 않는다.
        .catch(() => setVisitDate(null));

      const yesterdayDate = yesterdayDateParam();

      if (isYesterdayDismissed(yesterdayDate)) {
        setYesterday(null);
      } else {
        void getTrends(yesterdayDate, yesterdayDate)
          .then(setYesterday)
          // 어제 요약도 부가 정보다 — 실패하면 카드만 빠진다.
          .catch(() => setYesterday(null));
      }

      void loadSummary();
    }, [loadSummary])
  );

  // 추천은 (사용자, 날짜, 끼니)로 서버에 캐시돼 하루 동안 같은 결과다 — 포커스마다 다시
  // 부를 이유가 없어 마운트 1회만 읽는다.
  useEffect(() => {
    let isCancelled = false;

    getRecommendation(mealType, formatDateParam(new Date()))
      .then((result) => {
        if (!isCancelled) {
          setRecommendation(result);
        }
      })
      .catch(() => {
        // 미리보기는 있으면 좋은 것이다. 카드는 설명만 담은 채로 남고 진입은 계속 열려 있다.
      });

    return () => {
      isCancelled = true;
    };
  }, [mealType]);

  // 가이드 목록도 있으면 좋은 것이다 — 실패해도 조용히 넘어간다(카드가 안 그려질 뿐).
  useEffect(() => {
    let isCancelled = false;

    listGuides()
      .then((result) => {
        if (!isCancelled) {
          setGuides(result);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>오늘</Text>
        <Text style={styles.subtitle}>오늘의 섭취량과 목표를 확인하세요.</Text>
      </View>

      {/* 다음 진료까지 남은 날. **오늘 기록해야 할 이유가 여기서 나온다** — 케어 루프는
          진료와 진료 사이 한 바퀴이고(서버 `CARE_LOOP.md` §1), 그 끝이 보여야 기록이
          쌓이는 이유가 생긴다. 등록하지 않았으면 아무것도 그리지 않는다. */}
      <VisitStrip scheduledOn={visitDate} onPress={() => router.push('/(tabs)/trends')} />

      {/* 어제를 닫는 자리. 오늘을 보기 전에 한 번 지나가고, 닫으면 그날은 다시 안 뜬다
          (서버 `CARE_LOOP.md` §6). 기록이 없던 날도 그 사실을 말한다. */}
      {yesterday !== null ? (
        <YesterdayCard
          trends={yesterday}
          onPress={() =>
            router.push({ pathname: '/meals', params: { date: yesterday.start_date } })
          }
          onDismiss={() => {
            dismissYesterday(yesterday.start_date);
            setYesterday(null);
          }}
        />
      ) : null}

      {isLoading ? (
        <LoadingState label="오늘 기록을 불러오는 중입니다." />
      ) : errorMessage ? (
        <ErrorBanner message={errorMessage} onRetry={() => void loadSummary()} />
      ) : summary === null ? null : summary.target_kcal === null || summary.target_kcal === 0 ? (
        <View style={styles.emptyGoalCard}>
          <MaterialIcons color="#2a7d76" name="flag" size={28} />
          <Text style={styles.emptyGoalTitle}>목표를 설정해주세요</Text>
          <Text style={styles.emptyGoalText}>
            하루 목표 칼로리를 정하면 진행률을 볼 수 있습니다.
          </Text>
          <Pressable
            onPress={() => router.push('/me/goal')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>목표 설정하기</Text>
          </Pressable>
        </View>
      ) : (
        <SummaryRing targetKcal={summary.target_kcal} consumedKcal={summary.consumed_kcal} />
      )}

      {/* 질환 축 하루 누적. 질환이 없으면 서버가 null 을 주고 카드는 나타나지 않는다.
          칼로리 링 **바로 아래**인 것이 핵심이다 — 만성질환자에게는 kcal 보다 이 숫자가
          중요하다(kcalAI-model/docs/PRODUCT_STRATEGY.md §1). */}
      {summary !== null ? <DayNutrientsCard nutrients={summary.nutrients} /> : null}

      {/* 수치 **바로 다음**이 "이게 무슨 뜻이지"가 이어지는 자리다. 여기를 놓치면
          가이드는 아무도 찾지 않는 화면이 된다 (서버 `docs/CARE_LOOP.md` §5-2). */}
      <ConditionGuideCard guides={guides} />

      {/* "다음에 뭘 먹지"가 "끼니별 기록 조회"보다 먼저다. 예전에는 그룹 진입과 나란한
          회색 행이어서, 가장 쓸모 있는 화면이 가장 눈에 안 띄었다. */}
      {summary !== null ? (
        <NextMealCard
          mealType={mealType}
          recommendation={recommendation}
          onPress={() =>
            router.push({ pathname: '/recommendations', params: { meal_type: mealType } })
          }
        />
      ) : null}

      {summary !== null && summary.target_kcal !== null && summary.target_kcal !== 0 ? (
        <MealCards
          meals={summary.meals}
          onPressMeal={() => router.push({ pathname: '/meals', params: { date: summary.date } })}
        />
      ) : null}

      {/* 그룹은 내 정보가 아니라 홈에서 진입한다 — 매일 보는 곳이라야 모임이 굴러간다. */}
      <Pressable
        onPress={() => router.push('/groups')}
        style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}>
        <MaterialIcons color="#2a7d76" name="groups" size={24} />
        <View style={styles.groupRowBody}>
          <Text style={styles.groupRowTitle}>함께 보기</Text>
          <Text style={styles.groupRowText}>보호자·가족과 식생활을 함께 확인해요</Text>
        </View>
        <MaterialIcons color="#a9a6a1" name="chevron-right" size={20} />
      </Pressable>

      <Text style={styles.disclaimer}>{INTAKE_ESTIMATE_NOTICE}</Text>
    </Screen>
  );
}

// 다음 진료까지 남은 날 한 줄. 등록되지 않았으면 **아무것도 그리지 않는다** — 진료일이 없는
// 사람에게 빈 안내를 띄우면 홈이 할 일 목록이 된다. 등록 유도는 진료 탭이 맡는다.
function VisitStrip({
  scheduledOn,
  onPress,
}: {
  scheduledOn: string | null;
  onPress: () => void;
}) {
  if (scheduledOn === null) {
    return null;
  }

  const remaining = daysUntil(scheduledOn);

  if (remaining === null) {
    return null;
  }

  // 지난 날짜는 조용히 숨긴다. "지났어요"를 홈에 계속 띄우면 잔소리가 되고, 갱신은
  // 진료 탭에서 하면 된다.
  if (remaining < 0) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.visitStrip, pressed && styles.pressed]}>
      <MaterialIcons color="#2a7d76" name="event" size={18} />
      <Text style={styles.visitStripText}>
        {remaining === 0 ? '오늘 진료가 있어요' : `다음 진료까지 ${remaining}일`}
      </Text>
      <Text style={styles.visitStripLink}>기록 정리</Text>
      <MaterialIcons color="#a9a6a1" name="chevron-right" size={18} />
    </Pressable>
  );
}

// 링과 끼니 카드를 나눠 둔다 — 사이에 오늘의 영양·다음 끼니 추천이 들어오기 때문이다.
function SummaryRing({ targetKcal, consumedKcal }: { targetKcal: number; consumedKcal: number }) {
  const remaining = targetKcal - consumedKcal;
  const isOver = remaining < 0;

  return (
    <View style={styles.ringCard}>
      <ProgressRing
        progress={targetKcal > 0 ? consumedKcal / targetKcal : 0}
        size={220}
        strokeWidth={18}>
        <Text style={styles.ringValue}>{Math.abs(remaining).toLocaleString()}</Text>
        <Text style={styles.ringLabel}>{isOver ? '목표보다 많은 kcal' : '남은 kcal'}</Text>
      </ProgressRing>
      <Text style={styles.ringSummary}>
        {`오늘 ${consumedKcal.toLocaleString()} / ${targetKcal.toLocaleString()} kcal`}
      </Text>
    </View>
  );
}

function MealCards({ meals, onPressMeal }: { meals: MealBreakdown; onPressMeal: () => void }) {
  return (
    <View style={styles.mealSection}>
      {MEAL_ORDER.map((meal) => (
        <MealTypeCard
          key={meal.meal_type}
          icon={meal.icon}
          label={MEAL_TYPE_LABELS[meal.meal_type]}
          kcal={meals[meal.meal_type]}
          onPress={onPressMeal}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  visitStrip: {
    alignItems: 'center',
    backgroundColor: '#e4f1ef',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  visitStripText: {
    color: '#22211f',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  visitStripLink: {
    color: '#2a7d76',
    fontSize: 13,
    fontWeight: '700',
  },
  disclaimer: {
    color: '#a9a6a1',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyGoalCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    padding: 24,
  },
  emptyGoalText: {
    color: '#5c5b57',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyGoalTitle: {
    color: '#22211f',
    fontSize: 19,
    fontWeight: '900',
  },
  groupRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  groupRowBody: {
    flex: 1,
    gap: 2,
  },
  groupRowText: {
    color: '#5c5b57',
    fontSize: 13,
  },
  groupRowTitle: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  header: {
    gap: 4,
  },
  mealSection: {
    gap: 10,
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#60beb8',
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  ringCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 16,
    padding: 24,
  },
  ringLabel: {
    color: '#a9a6a1',
    fontSize: 15,
    fontWeight: '700',
  },
  ringSummary: {
    color: '#5c5b57',
    fontSize: 16,
    fontWeight: '800',
  },
  ringValue: {
    color: '#22211f',
    fontSize: 40,
    fontWeight: '900',
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
});
