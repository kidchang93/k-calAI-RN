import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OnboardingProgress } from '@/components/onboarding-progress';
import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/screen';
import { ProfileRequest, putProfile } from '@/services/health-api';

// 만 14세 미만은 가입할 수 없다 — 개인정보 보호법 제22조의2(법정대리인 동의)와, 이 앱의 식이
// 규칙이 전부 성인 지침에서 왔다는 두 가지 이유다 (서버 docs/LEGAL_COMPLIANCE.md §1).
// 서버가 같은 기준으로 400 을 주며, 여기 검사는 그 전에 이유를 알려주기 위한 것이다.
const MIN_SIGNUP_AGE = 14;

export default function BodyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ consented?: string }>();
  // 동의(1단계)를 거치지 않은 딥링크 진입은 미동의로 간주한다. 민감정보 화면을 열지 않아 403이 나지 않는다.
  const isConsented = params.consented === '1';

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const saveAndNext = async (input: ProfileRequest) => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await putProfile(input);

      // 질병·알러지는 이 앞 단계에서 이미 물었다 (2026-07-25 재편). 여기서는 목표로 간다.
      router.push({
        pathname: '/onboarding/goal',
        params: { consented: isConsented ? '1' : '0' },
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen keyboard="avoid">
      <OnboardingProgress current={isConsented ? 4 : 2} total={isConsented ? 5 : 3} />

      <View style={styles.header}>
        <Text style={styles.title}>키와 몸무게를{'\n'}알려주세요</Text>
        <Text style={styles.subtitle}>하루 목표 칼로리를 계산하는 데 씁니다.</Text>
      </View>

      <ProfileForm
        errorMessage={errorMessage}
        isSaving={isSaving}
        minAge={MIN_SIGNUP_AGE}
        note="키·몸무게는 언제든 내 정보에서 바꿀 수 있어요."
        onSave={(input) => void saveAndNext(input)}
        saveLabel="다음"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6,
  },
  subtitle: {
    color: '#5c5b57',
    fontSize: 14,
  },
  title: {
    color: '#22211f',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 34,
  },
});
