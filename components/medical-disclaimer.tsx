import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

// 의료 판단은 우리가 하지 않는다는 고지.
//
// **약관에 적어 두는 것으로는 부족하다.** Apple App Store Review Guidelines 1.4.1 은 의료
// 앱에 "Apps should remind users to check with a doctor ... before making medical decisions"
// 를 요구하는데, 요구하는 것은 문서에 조항을 두는 것이 아니라 **쓰는 순간에 상기시키는 것**이다
// (`kcalAI-model/docs/LEGAL_COMPLIANCE.md` §6-1). 우리는 만성질환 식이 경고를 내므로 같은 조의
// "greater scrutiny" 대상이다.
//
// 제품 관점에서도 같은 결론이다 — 이 앱의 목표는 판단을 대신하는 것이 아니라 **판단에 필요한
// 근거를 남기는 것**이라(`PRODUCT_STRATEGY.md`), 최종 판단자가 누구인지 화면이 말해야 한다.
//
// 그래서 **수치가 의학적 판단으로 읽힐 수 있는 화면에만** 붙인다. 모든 화면에 깔면 문구가
// 배경이 되어 아무도 읽지 않는다.
export function MedicalDisclaimer({ tone = 'quiet' }: { tone?: 'quiet' | 'strong' }) {
  const isStrong = tone === 'strong';

  return (
    <View style={[styles.box, isStrong && styles.boxStrong]}>
      <MaterialIcons
        color={isStrong ? '#c2410c' : '#8b95a1'}
        name="info-outline"
        size={isStrong ? 16 : 13}
      />
      <Text style={[styles.text, isStrong && styles.textStrong]}>
        참고용 정보입니다. 치료·복약·식이 조절은 담당 의료진과 상의해 결정하세요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 6,
  },
  boxStrong: {
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    gap: 8,
    padding: 12,
  },
  text: {
    color: '#8b95a1',
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  textStrong: {
    color: '#9a3412',
    fontSize: 13,
    lineHeight: 19,
  },
});
