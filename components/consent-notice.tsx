import { StyleSheet, Text, View } from 'react-native';

import type { ConsentNoticeRow } from '@/constants/consent';

// 동의를 받을 때 알려야 하는 항목(수집 항목·이용 목적·보유 기간·제3자 제공)을 줄마다 나눠 그린다.
// 온보딩(app/onboarding/consent.tsx)과 동의 관리(app/me/consents.tsx) 둘 다 동의 버튼이 있어서
// 두 곳이 같은 고지를 같은 모양으로 보여야 한다. 문구의 정본은 constants/consent.ts 다.
export function ConsentNotice({ rows }: { rows: ConsentNoticeRow[] }) {
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.text}>{row.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: '#22211f',
    fontSize: 13,
    fontWeight: '800',
  },
  list: {
    gap: 10,
  },
  row: {
    gap: 2,
  },
  text: {
    color: '#5c5b57',
    fontSize: 14,
    lineHeight: 20,
  },
});
