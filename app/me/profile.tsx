import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { LoadingState } from '@/components/loading-state';
import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/screen';
import { getProfile, ProfileRequest, ProfileResponse, putProfile } from '@/services/health-api';

export default function ProfileEditScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 온보딩 게이트를 통과했으면 프로필이 있어야 하지만, 없어도 빈 폼으로 새로 입력할 수 있다.
      setProfile(await getProfile());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const save = async (input: ProfileRequest) => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await putProfile(input);

      // 내 정보 탭은 useFocusEffect로 복귀 시 다시 읽는다.
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen keyboard="avoid">
      <BackButton />

      <View style={styles.header}>
        <Text style={styles.title}>프로필 수정</Text>
        <Text style={styles.subtitle}>바꾼 값으로 목표 칼로리가 다시 계산됩니다.</Text>
      </View>

      {/* 태어난 해에 가입 연령(만 14세)을 걸지 않는다 — 온보딩(body.tsx)과 다른 점. */}
      {isLoading ? (
        <LoadingState label="프로필을 불러오는 중입니다." />
      ) : (
        <ProfileForm
          errorMessage={errorMessage}
          initial={profile}
          isSaving={isSaving}
          onSave={(input) => void save(input)}
          saveLabel="저장"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
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
