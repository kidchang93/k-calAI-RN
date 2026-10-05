import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DayNutrientsCard } from '@/components/day-nutrients-card';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TabHeader } from '@/components/tab-header';
import { YesterdayCard } from '@/components/yesterday-card';
import { AI_USE_NOTICE, INTAKE_ESTIMATE_NOTICE } from '@/constants/ai-notice';
import { MEAL_TYPE_LABELS, MEAL_TYPES, mealTypeAt } from '@/constants/meal';
import { DISPLAY_FONT } from '@/constants/typography';
import { formatFoodLabel } from '@/services/food-label';
import { formatFullDate } from '@/services/format';
import { consumePendingInvite } from '@/services/group-invite';
import {
  DaySummary,
  formatDateParam,
  getMeals,
  getSummary,
  getTrends,
  MealLog,
  MealType,
  TrendsResponse,
} from '@/services/health-api';
import { photoParams, pickPhoto } from '@/services/photo-picker';
import { daysUntil, getNextVisit } from '@/services/visit-api';
import {
  dismissYesterday,
  isYesterdayDismissed,
  yesterdayDateParam,
} from '@/services/yesterday-summary';

// 오늘의 퀘스트가 세는 끼니. 간식은 칸은 있지만 퀘스트에 넣지 않는다 — 먹지 않은 간식을 '못 채운
// 칸'으로 만들면 기록을 위해 먹으라는 말이 된다.
const QUEST_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner'];

// 칸 자리는 시간과 상관없이 고정이다 — 어르신 사용자는 '점심은 오른쪽 위'처럼 자리로 기억한다.
const TILE_ROWS: MealType[][] = [
  ['breakfast', 'lunch'],
  ['dinner', 'snack'],
];

// 식단 탭 (2026-10-05 화면 재구성 — 옛 '홈' + '기록' 탭).
//
// 예전 홈은 카드 9장이 같은 무게로 쌓여 있었고 맨 위가 '남은 kcal' 큰 링이었다 — 잔액처럼 읽혀
// 핀테크 앱 같았고, 정작 할 일(사진 찍기)은 다른 탭에 있었다. 이제 이 탭은 **오늘 할 일 하나**만
// 말한다: 끼니 칸에 사진 한 장. 칸을 채우면 도장이 찍힌다(잘 먹어서가 아니라 남겨서).
// 질환 가이드는 케어 탭, 그룹(함께 보기)은 내 정보로 옮겼다.
export default function HomeScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [meals, setMeals] = useState<MealLog[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 다음 진료일. 등록돼 있을 때만 한 줄 나타난다 — 없는 사람의 화면을 어지럽히지 않는다.
  const [visitDate, setVisitDate] = useState<string | null>(null);
  // 어제 하루. 요약 API(summary)가 아니라 추이 API를 하루 범위로 읽는다 — 끼니 수(meal_count)가
  // 있어야 "기록 없는 날"과 "0 kcal 기록"을 가를 수 있다. 닫았거나 실패하면 null.
  const [yesterday, setYesterday] = useState<TrendsResponse | null>(null);

  const todayDate = formatDateParam(new Date());

  const loadToday = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const today = formatDateParam(new Date());
      // 칸마다 무엇을 먹었는지 보여야 해서 끼니 목록도 함께 읽는다 — 요약(summary)에는 끼니별
      // kcal 만 있어 0 kcal 기록(물·차)을 '빈 칸'으로 잘못 그린다.
      const [summaryResult, mealsResult] = await Promise.all([getSummary(today), getMeals(today)]);

      setSummary(summaryResult);
      setMeals(mealsResult);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 로그인 전에 열린 초대 링크를 이어받는다. 이 탭은 인증·온보딩을 모두 통과해야 도달하므로,
  // 신규 가입자가 가입 → 온보딩을 마친 직후에도 초대받은 그룹으로 이어진다.
  // 코드는 읽으면서 지워지므로(consume) 다시 와도 반복되지 않는다.
  useEffect(() => {
    const pendingInvite = consumePendingInvite();

    if (pendingInvite) {
      router.replace({ pathname: '/groups/join', params: { code: pendingInvite } });
    }
  }, [router]);

  // 기록 화면에서 저장하고 돌아오면 칸이 채워져 있어야 하므로 포커스마다 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      void getNextVisit()
        .then((visit) => setVisitDate(visit.scheduled_on))
        // 진료일은 부가 정보다 — 실패해도 나머지를 막지 않는다.
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

      void loadToday();
    }, [loadToday])
  );

  const openCompose = (mealType: MealType, extra: Record<string, string> = {}) => {
    router.push({
      pathname: '/meals/compose',
      params: { date: formatDateParam(new Date()), meal_type: mealType, ...extra },
    });
  };

  // '사진 찍기'는 카메라를 바로 연다. 방금 찍은 사진은 지금이 촬영 시각이라 시각을 읽지 않는다
  // (services/photo-picker.ts). 앨범·검색·직접 입력은 '다른 방법으로'가 여는 기록 화면에 있다.
  const takePhoto = async (mealType: MealType) => {
    const asset = await pickPhoto('camera');

    if (asset !== null) {
      openCompose(mealType, photoParams(asset));
    }
  };

  return (
    <Screen gap={16}>
      <TabHeader caption={buildCaption(todayDate, summary)} title="오늘의 식단" />

      {/* 다음 진료까지 남은 날. **오늘 기록해야 할 이유가 여기서 나온다** — 케어 루프는
          진료와 진료 사이 한 바퀴이고(서버 `CARE_LOOP.md` §1), 그 끝이 보여야 기록이
          쌓이는 이유가 생긴다. 등록하지 않았으면 아무것도 그리지 않는다. */}
      <VisitStrip scheduledOn={visitDate} onPress={() => router.push('/visit')} />

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
        <ErrorBanner message={errorMessage} onRetry={() => void loadToday()} />
      ) : summary === null || meals === null ? null : (
        <>
          {summary.target_kcal === null || summary.target_kcal === 0 ? (
            <Pressable
              onPress={() => router.push('/me/goal')}
              style={({ pressed }) => [styles.goalRow, pressed && styles.pressed]}>
              <MaterialIcons color="#2a7d76" name="flag" size={22} />
              <Text style={styles.goalRowText}>하루 목표 칼로리를 정해 주세요</Text>
              <MaterialIcons color="#5c5b57" name="chevron-right" size={20} />
            </Pressable>
          ) : null}

          <MealQuest
            meals={meals}
            nowType={currentMealType(meals, new Date())}
            showSodium={summary.nutrients?.axes.some((axis) => axis.nutrient === 'sodium') ?? false}
            onCompose={openCompose}
            onOpenDay={() => router.push({ pathname: '/meals', params: { date: todayDate } })}
            onRecommend={(mealType) =>
              router.push({ pathname: '/recommendations', params: { meal_type: mealType } })
            }
            onTakePhoto={(mealType) => void takePhoto(mealType)}
          />

          {/* AI기본법 제31조① 사전고지 — 사진 기록이 이 탭에서 바로 시작되므로 여기 둔다
              (constants/ai-notice.ts). 예전엔 기록 탭에 있었다. */}
          <Text style={styles.aiNotice}>{AI_USE_NOTICE}</Text>

          {/* 질환 축 하루 누적(소금 항아리). 질환이 없으면 서버가 null 을 주고 카드는 나타나지
              않는다. 만성질환자에게는 kcal 보다 이 숫자가 중요하다(PRODUCT_STRATEGY.md §1). */}
          <DayNutrientsCard nutrients={summary.nutrients} />
        </>
      )}

      <Text style={styles.disclaimer}>{INTAKE_ESTIMATE_NOTICE}</Text>
    </Screen>
  );
}

// '10월 5일 (월) · 420 / 2,200 kcal'. kcal 은 큰 링이 아니라 이 한 줄이다 — 만성질환자에게 하루의
// 중심은 칼로리 잔액이 아니라 끼니와 질환 축이다.
function buildCaption(todayDate: string, summary: DaySummary | null): string {
  const date = formatFullDate(todayDate);

  if (summary === null) {
    return date;
  }

  const consumed = summary.consumed_kcal.toLocaleString();

  return summary.target_kcal !== null && summary.target_kcal > 0
    ? `${date} · ${consumed} / ${summary.target_kcal.toLocaleString()} kcal`
    : `${date} · ${consumed} kcal`;
}

// '지금' 칸: 지금 시각의 끼니부터 아직 안 남긴 첫 칸. 아침을 남긴 10시엔 점심이 '지금'이 된다 —
// 다음 할 일이 늘 하나 보이게 한다. 경계는 기록 화면과 같다(constants/meal.ts `mealTypeAt`).
function currentMealType(meals: MealLog[], now: Date): MealType | null {
  const start = MEAL_TYPES.indexOf(mealTypeAt(now));

  return MEAL_TYPES.slice(start).find((type) => !meals.some((meal) => meal.meal_type === type)) ?? null;
}

// 다음 진료까지 남은 날 한 줄. 등록되지 않았으면 **아무것도 그리지 않는다** — 진료일이 없는
// 사람에게 빈 안내를 띄우면 이 탭이 할 일 목록이 된다. 등록 유도는 진료 탭이 맡는다.
function VisitStrip({
  scheduledOn,
  onPress,
}: {
  scheduledOn: string | null;
  onPress: () => void;
}) {
  const remaining = scheduledOn === null ? null : daysUntil(scheduledOn);

  // 지난 날짜는 조용히 숨긴다. "지났어요"를 계속 띄우면 잔소리가 되고, 갱신은 진료 탭에서 한다.
  if (remaining === null || remaining < 0) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.visitStrip, pressed && styles.pressed]}>
      <View style={styles.visitIcon}>
        <MaterialIcons color="#2f5fc4" name="work" size={20} />
      </View>
      <Text style={styles.visitText}>
        {remaining === 0 ? (
          '오늘 진료가 있어요'
        ) : (
          <>
            {'다음 진료까지 '}
            <Text style={styles.visitDays}>{`${remaining}일`}</Text>
          </>
        )}
      </Text>
      <Text style={styles.visitLink}>길 보기</Text>
      <MaterialIcons color="#2f5fc4" name="chevron-right" size={20} />
    </Pressable>
  );
}

function MealQuest({
  meals,
  nowType,
  showSodium,
  onTakePhoto,
  onCompose,
  onRecommend,
  onOpenDay,
}: {
  meals: MealLog[];
  nowType: MealType | null;
  // 나트륨 축이 있는 사람(질환 등록자)에게만 칸에 나트륨을 적는다. 그 외엔 kcal.
  showSodium: boolean;
  onTakePhoto: (mealType: MealType) => void;
  onCompose: (mealType: MealType) => void;
  onRecommend: (mealType: MealType) => void;
  onOpenDay: () => void;
}) {
  const doneCount = QUEST_MEALS.filter((type) => meals.some((meal) => meal.meal_type === type)).length;

  const tile = (mealType: MealType) => (
    <MealTile
      key={mealType}
      logs={meals.filter((meal) => meal.meal_type === mealType)}
      mealType={mealType}
      isNow={mealType === nowType}
      showSodium={showSodium}
      onCompose={() => onCompose(mealType)}
      onOpenDay={onOpenDay}
      onRecommend={() => onRecommend(mealType)}
      onTakePhoto={() => onTakePhoto(mealType)}
    />
  );

  return (
    <View style={styles.quest}>
      <View style={styles.questTitles}>
        <View style={styles.questHead}>
          <Text accessibilityRole="header" style={styles.questTitle}>
            오늘의 퀘스트
          </Text>
          <View
            accessibilityLabel={`끼니 ${QUEST_MEALS.length}칸 중 ${doneCount}칸 채움`}
            style={styles.questDots}>
            {QUEST_MEALS.map((type, index) => (
              <View key={type} style={[styles.questDot, index < doneCount ? styles.questDotDone : null]}>
                {index < doneCount ? <MaterialIcons color="#4a3200" name="check" size={15} /> : null}
              </View>
            ))}
            <Text style={styles.questCount}>{`${doneCount}/${QUEST_MEALS.length}`}</Text>
          </View>
        </View>
        <Text style={styles.questHint}>끼니마다 사진 한 장 → 도장 하나</Text>
      </View>

      {TILE_ROWS.map((row) => (
        <View key={row.join('-')} style={styles.tileRow}>
          {row.map(tile)}
        </View>
      ))}
    </View>
  );
}

function MealTile({
  mealType,
  logs,
  isNow,
  showSodium,
  onTakePhoto,
  onCompose,
  onRecommend,
  onOpenDay,
}: {
  mealType: MealType;
  logs: MealLog[];
  isNow: boolean;
  showSodium: boolean;
  onTakePhoto: () => void;
  onCompose: () => void;
  onRecommend: () => void;
  onOpenDay: () => void;
}) {
  const label = MEAL_TYPE_LABELS[mealType];

  if (logs.length > 0) {
    const items = logs.flatMap((log) => log.items);
    const measured = items.filter((item) => item.sodium_mg !== null);
    const sodium = measured.reduce((acc, item) => acc + (item.sodium_mg ?? 0), 0);
    const kcal = logs.reduce((acc, log) => acc + log.total_kcal, 0);

    return (
      <Pressable
        accessibilityHint="오늘 기록을 봐요"
        onPress={onOpenDay}
        style={({ pressed }) => [styles.tile, styles.tileDone, pressed && styles.pressed]}>
        <View style={styles.tileHead}>
          <Text style={styles.tileLabel}>{label}</Text>
          <View accessibilityLabel="도장 받음" style={styles.stamp}>
            <MaterialIcons color="#4a3200" name="check" size={22} />
          </View>
        </View>
        <Text numberOfLines={2} style={styles.tileFoods}>
          {items.map((item) => formatFoodLabel(item.food_label)).join(' · ')}
        </Text>
        <Text style={styles.tileChip}>
          {showSodium && measured.length > 0
            ? `나트륨 ${Math.round(sodium).toLocaleString()}mg`
            : `${Math.round(kcal).toLocaleString()} kcal`}
        </Text>
      </Pressable>
    );
  }

  if (isNow) {
    return (
      <View style={[styles.tile, styles.tileNow]}>
        <View style={styles.tileHead}>
          <Text style={[styles.tileLabel, styles.tileLabelNow]}>{label}</Text>
          <Text style={styles.nowBadge}>지금</Text>
        </View>
        <Pressable
          accessibilityLabel={`${label} 사진 찍기`}
          accessibilityRole="button"
          onPress={onTakePhoto}
          style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
          <MaterialIcons color="#8f3b0e" name="photo-camera" size={22} />
          <Text style={styles.photoButtonText}>사진 찍기</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onCompose}
          style={({ pressed }) => [styles.nowLink, pressed && styles.pressed]}>
          <Text style={styles.nowLinkText}>앨범·직접 입력</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onRecommend}
          style={({ pressed }) => [styles.nowLink, pressed && styles.pressed]}>
          <Text style={styles.nowLinkText}>뭐 먹지? 추천 보기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={`${label} 남기기`}
      accessibilityRole="button"
      onPress={onCompose}
      style={({ pressed }) => [styles.tile, styles.tileEmpty, pressed && styles.pressed]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <View style={styles.emptyAction}>
        <View style={styles.plus}>
          <MaterialIcons color="#5c5b57" name="add" size={20} />
        </View>
        <Text style={styles.emptyText}>{mealType === 'snack' ? '먹었으면 남기기' : '남기기'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  aiNotice: {
    color: '#5c5b57',
    fontSize: 12,
    lineHeight: 17,
  },
  disclaimer: {
    color: '#5c5b57',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  emptyAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
  },
  emptyText: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '800',
  },
  goalRow: {
    alignItems: 'center',
    backgroundColor: '#eef7f5',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  goalRowText: {
    color: '#22211f',
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  nowBadge: {
    backgroundColor: '#ffc83d',
    borderRadius: 999,
    color: '#4a3200',
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  nowLink: {
    justifyContent: 'center',
    minHeight: 36,
  },
  nowLinkText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  photoButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 4,
    borderColor: '#8f3b0e',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 52,
  },
  photoButtonText: {
    color: '#8f3b0e',
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
  },
  plus: {
    alignItems: 'center',
    borderColor: '#a9a6a1',
    borderRadius: 17,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  pressed: {
    opacity: 0.74,
  },
  quest: {
    gap: 12,
  },
  questCount: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
    marginLeft: 2,
  },
  questDot: {
    alignItems: 'center',
    borderColor: '#a9a6a1',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  questDotDone: {
    backgroundColor: '#ffc83d',
    borderColor: '#d9a200',
    borderStyle: 'solid',
  },
  questDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  questHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  questHint: {
    color: '#5c5b57',
    fontSize: 15,
  },
  questTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 23,
  },
  questTitles: {
    gap: 2,
  },
  stamp: {
    alignItems: 'center',
    backgroundColor: '#ffc83d',
    borderColor: '#d9a200',
    borderRadius: 21,
    borderWidth: 3,
    height: 42,
    justifyContent: 'center',
    transform: [{ rotate: '-12deg' }],
    width: 42,
  },
  tile: {
    borderRadius: 20,
    flex: 1,
    gap: 8,
    minHeight: 150,
    padding: 14,
  },
  tileChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef7f5',
    borderRadius: 8,
    color: '#1c5a55',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 'auto',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  tileDone: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderWidth: 2,
  },
  tileEmpty: {
    borderColor: '#a9a6a1',
    borderStyle: 'dashed',
    borderWidth: 2,
  },
  tileFoods: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  tileHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
  },
  tileLabel: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 23,
  },
  tileLabelNow: {
    color: '#ffffff',
  },
  tileNow: {
    backgroundColor: '#c4561b',
    borderBottomWidth: 5,
    borderColor: '#8f3b0e',
    borderWidth: 2,
    gap: 6,
  },
  tileRow: {
    flexDirection: 'row',
    gap: 12,
  },
  visitDays: {
    color: '#2f5fc4',
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
  },
  visitIcon: {
    alignItems: 'center',
    backgroundColor: '#e3ebfb',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  visitLink: {
    color: '#2f5fc4',
    fontSize: 15,
    fontWeight: '800',
  },
  visitStrip: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 4,
    borderColor: '#c9d6f2',
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 12,
  },
  visitText: {
    color: '#22211f',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
});
