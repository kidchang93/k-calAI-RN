import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DISPLAY_FONT } from '@/constants/typography';

export type PathWeek = { label: string; recorded: number; total: number };

// 진료 탭의 **진료까지의 길** (2026-10-05). 케어 루프의 단위는 진료와 진료 사이다(서버
// `docs/CARE_LOOP.md` §1) — 그 사이를 보드게임 길처럼 그려 "오늘 남기는 한 칸이 진료로 이어진다"를
// 보이게 한다.
//
// 출발점이 '지난 진료'가 아니라 **지난 4주**인 이유: 서버는 다음 진료일 하나만 저장한다(PUT 이
// 덮어쓴다, DATA_MODEL 31장). 지난 진료일이 없으니 지어내지 않고 기록이 있는 4주부터 그린다.
// 길은 칸 수가 아니라 '남겼는가'를 말한다 — 빈 주도 벌이 아니라 흰 칸이다.
//
// 모양: 3칸 → 오른쪽에서 돌아 → 3칸 (뱀 주사위판).
//   [3주 전]━[2주 전]━[지난주]╮
//   [도착 ]━[ 남은 길]━[이번 주]╯
export function VisitPath({
  weeks,
  remainingDays,
  visitLabel,
  onPressFinish,
}: {
  // 오래된 주부터 4개. 마지막이 이번 주(오늘 포함 최근 7일)다.
  weeks: PathWeek[];
  // 다음 진료까지 남은 날. 등록 안 했으면 null, 지났으면 음수.
  remainingDays: number | null;
  // '11월 12일' 같은 표시용 날짜. 등록 안 했으면 null.
  visitLabel: string | null;
  onPressFinish: () => void;
}) {
  const [first, second, third, current] = weeks;
  const recordedDays = weeks.reduce((acc, week) => acc + week.recorded, 0);
  const summary =
    remainingDays !== null && remainingDays >= 0
      ? `지난 4주 중 ${recordedDays}일 남김, 다음 진료까지 ${remainingDays}일`
      : `지난 4주 중 ${recordedDays}일 남김, 다음 진료일 미정`;

  return (
    <View accessibilityLabel={summary} style={styles.board}>
      <View style={[styles.track, styles.trackDone, styles.trackTop]} />
      <View style={styles.turn} />
      <View style={[styles.track, styles.trackAhead, styles.trackBottom]} />

      {first ? <WeekStop at="16%" row="top" week={first} /> : null}
      {second ? <WeekStop at="50%" row="top" week={second} /> : null}
      {third ? <WeekStop at="84%" row="top" week={third} /> : null}
      {current ? <WeekStop at="84%" isCurrent row="bottom" week={current} /> : null}

      <Stop at="50%" row="bottom">
        <View style={[styles.node, styles.nodeAhead]}>
          <Text style={[styles.nodeText, styles.nodeTextAhead]}>
            {remainingDays !== null && remainingDays > 0 ? `${remainingDays}일` : '?'}
          </Text>
        </View>
        <Text style={styles.stopLabel}>남은 길</Text>
        <Text style={styles.stopMeta}>
          {remainingDays !== null && remainingDays > 0 ? '하루 한 칸씩' : '날짜 미정'}
        </Text>
      </Stop>

      <Stop at="16%" row="bottom">
        <Pressable
          accessibilityLabel={visitLabel === null ? '다음 진료일 적기' : `다음 진료일 ${visitLabel}`}
          accessibilityRole="button"
          onPress={onPressFinish}
          style={({ pressed }) => [styles.node, styles.nodeFinish, pressed && styles.pressed]}>
          <MaterialIcons color="#ffffff" name="flag" size={28} />
        </Pressable>
        <Text style={styles.stopLabel}>도착</Text>
        <Text style={[styles.stopMeta, styles.stopMetaFinish]}>
          {visitLabel === null ? '진료일 적기' : `${visitLabel} 진료`}
        </Text>
      </Stop>
    </View>
  );
}

function WeekStop({
  week,
  at,
  row,
  isCurrent = false,
}: {
  week: PathWeek;
  at: `${number}%`;
  row: 'top' | 'bottom';
  isCurrent?: boolean;
}) {
  return (
    <Stop at={at} row={row}>
      <View
        style={[
          styles.node,
          isCurrent ? styles.nodeCurrent : week.recorded > 0 ? styles.nodeDone : styles.nodeEmpty,
        ]}>
        <Text
          style={[
            styles.nodeText,
            isCurrent ? styles.nodeTextCurrent : week.recorded > 0 ? null : styles.nodeTextAhead,
          ]}>
          {`${week.recorded}/${week.total}`}
        </Text>
      </View>
      <Text style={styles.stopLabel}>{week.label}</Text>
      <Text style={[styles.stopMeta, isCurrent && styles.stopMetaCurrent]}>
        {isCurrent ? '지금 여기' : `${week.recorded}일 남김`}
      </Text>
    </Stop>
  );
}

function Stop({
  at,
  row,
  children,
}: {
  at: `${number}%`;
  row: 'top' | 'bottom';
  children: ReactNode;
}) {
  return (
    <View style={[styles.stop, row === 'top' ? styles.stopTop : styles.stopBottom, { left: at }]}>
      {children}
    </View>
  );
}

// 행 중심선: 위 36, 아래 154. 길(10)과 돌아가는 굽이(테두리 10)가 이 두 선에 맞물린다.
const styles = StyleSheet.create({
  board: {
    height: 246,
    width: '100%',
  },
  node: {
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 3,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  nodeAhead: {
    backgroundColor: '#ffffff',
    borderColor: '#a9a6a1',
  },
  nodeCurrent: {
    backgroundColor: '#ffebdd',
    borderColor: '#c4561b',
    borderWidth: 4,
  },
  nodeDone: {
    backgroundColor: '#2a7d76',
    borderColor: '#1c5a55',
  },
  nodeEmpty: {
    backgroundColor: '#ffffff',
    borderColor: '#a9a6a1',
  },
  nodeFinish: {
    backgroundColor: '#2f5fc4',
    borderColor: '#1e4290',
  },
  nodeText: {
    color: '#ffffff',
    fontFamily: DISPLAY_FONT,
    fontSize: 18,
  },
  nodeTextAhead: {
    color: '#5c5b57',
  },
  nodeTextCurrent: {
    color: '#8f3b0e',
  },
  pressed: {
    opacity: 0.74,
  },
  stop: {
    alignItems: 'center',
    gap: 2,
    marginLeft: -48,
    position: 'absolute',
    width: 96,
  },
  stopBottom: {
    top: 124,
  },
  stopLabel: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 16,
    marginTop: 2,
  },
  stopMeta: {
    color: '#5c5b57',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  stopMetaCurrent: {
    color: '#8f3b0e',
  },
  stopMetaFinish: {
    color: '#1e4290',
  },
  stopTop: {
    top: 6,
  },
  track: {
    borderRadius: 5,
    height: 10,
    left: '16%',
    position: 'absolute',
    right: '16%',
  },
  trackAhead: {
    backgroundColor: '#e4e2de',
  },
  trackBottom: {
    top: 149,
  },
  trackDone: {
    backgroundColor: '#2a7d76',
  },
  trackTop: {
    top: 31,
  },
  turn: {
    borderBottomRightRadius: 64,
    borderColor: '#2a7d76',
    borderLeftWidth: 0,
    borderTopRightRadius: 64,
    borderWidth: 10,
    height: 128,
    left: '80%',
    position: 'absolute',
    right: 0,
    top: 31,
  },
});
