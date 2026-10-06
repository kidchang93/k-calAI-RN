import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SignupTerms } from '@/services/auth-api';

export type SignupAgreements = Omit<SignupTerms, 'plan_code'>;

export const NO_AGREEMENTS: SignupAgreements = { agreed_terms: false, agreed_privacy: false };

// 가입 필수 동의 2종(모두 동의 + 이용약관·처리방침). 카카오·Apple 가입 단계와 이메일 가입이 함께 쓴다.
export function SignupConsents({
  value,
  onChange,
}: {
  value: SignupAgreements;
  onChange: (next: SignupAgreements) => void;
}) {
  const hasAgreedAll = value.agreed_terms && value.agreed_privacy;

  return (
    <View style={styles.consentSection}>
      <Text style={styles.label}>약관 동의</Text>
      <Pressable
        onPress={() => onChange({ agreed_terms: !hasAgreedAll, agreed_privacy: !hasAgreedAll })}
        style={({ pressed }) => [styles.agreeAllRow, pressed && styles.pressed]}>
        <CheckBox isChecked={hasAgreedAll} />
        <Text style={styles.agreeAllText}>모두 동의</Text>
      </Pressable>
      <ConsentRow
        href="/legal/terms"
        isChecked={value.agreed_terms}
        label="[필수] 서비스 이용약관"
        onToggle={() => onChange({ ...value, agreed_terms: !value.agreed_terms })}
      />
      <ConsentRow
        href="/legal/privacy"
        isChecked={value.agreed_privacy}
        label="[필수] 개인정보 처리방침"
        onToggle={() => onChange({ ...value, agreed_privacy: !value.agreed_privacy })}
      />
    </View>
  );
}

function CheckBox({ isChecked }: { isChecked: boolean }) {
  return (
    <View style={[styles.checkBox, isChecked && styles.checkBoxChecked]}>
      <MaterialIcons color={isChecked ? '#22211f' : '#a9a6a1'} name="check" size={16} />
    </View>
  );
}

// 동의 체크박스 + 전문 '보기'. 링크를 체크박스 **밖**에 둔다 — 안에 두면 문서를 열려다
// 동의가 토글된다. 2026-07-16 이전에는 이 링크가 없어, 읽을 수 없는 문서에 동의를 받고 있었다.
function ConsentRow({
  href,
  isChecked,
  label,
  onToggle,
}: {
  href: '/legal/terms' | '/legal/privacy';
  isChecked: boolean;
  label: string;
  onToggle: () => void;
}) {
  const router = useRouter();

  return (
    <View style={styles.consentRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isChecked }}
        onPress={onToggle}
        style={({ pressed }) => [styles.consentToggle, pressed && styles.pressed]}>
        <CheckBox isChecked={isChecked} />
        <Text style={styles.consentText}>{label}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push(href)}
        style={({ pressed }) => [styles.consentViewButton, pressed && styles.pressed]}>
        <Text style={styles.consentViewText}>보기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: '#22211f',
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
  },
  consentSection: {
    gap: 8,
  },
  agreeAllRow: {
    alignItems: 'center',
    backgroundColor: '#e4e2de',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  agreeAllText: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '900',
  },
  consentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  // 체크박스와 라벨만 토글 영역이다. '보기'는 이 밖에 있어야 문서를 열 때 동의가 켜지지 않는다.
  consentToggle: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  consentViewButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  consentViewText: {
    color: '#5c5b57',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  consentText: {
    color: '#5c5b57',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  checkBox: {
    alignItems: 'center',
    backgroundColor: '#e4e2de',
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkBoxChecked: {
    backgroundColor: '#60beb8',
  },
});
