import { StyleSheet, Text, View } from 'react-native';

// 결제 상태 배지. 결제 내역 목록·영수증 상세가 공유한다.
// 색은 docs/DESIGN.md 팔레트만 쓴다: done=파랑(#3182f6)/강조배경, failed=오류(#e5484d)/오류배경,
// canceled·ready=보조(#6b7684)/채움배경. status는 서버 참조값이라 모르는 값은 회색으로 그대로 보여준다.
const STATUS_META: Record<string, { label: string; background: string; color: string }> = {
  done: { label: '결제완료', background: '#edf6ff', color: '#3182f6' },
  failed: { label: '결제실패', background: '#fff5f5', color: '#e5484d' },
  canceled: { label: '결제취소', background: '#f2f4f6', color: '#6b7684' },
  ready: { label: '결제대기', background: '#f2f4f6', color: '#6b7684' },
};

const FALLBACK = { background: '#f2f4f6', color: '#6b7684' };

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
