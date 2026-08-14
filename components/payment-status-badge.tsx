import { StyleSheet, Text, View } from 'react-native';

// 결제 상태 배지. 결제 내역 목록·영수증 상세가 공유한다.
// 색은 docs/DESIGN.md 팔레트만 쓴다: done=민트(#2a7d76)/강조배경, failed=오류(#b8524e)/오류배경,
// canceled·ready=보조(#5c5b57)/채움배경. status는 서버 참조값이라 모르는 값은 회색으로 그대로 보여준다.
const STATUS_META: Record<string, { label: string; background: string; color: string }> = {
  done: { label: '결제완료', background: '#bee2dd', color: '#2a7d76' },
  failed: { label: '결제실패', background: '#fbeaea', color: '#b8524e' },
  canceled: { label: '결제취소', background: '#e4e2de', color: '#5c5b57' },
  ready: { label: '결제대기', background: '#e4e2de', color: '#5c5b57' },
};

const FALLBACK = { background: '#e4e2de', color: '#5c5b57' };

export function PaymentStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status];
  const label = meta ? meta.label : status;
  const background = meta ? meta.background : FALLBACK.background;
  const color = meta ? meta.color : FALLBACK.color;

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
  },
});
