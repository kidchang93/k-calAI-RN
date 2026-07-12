import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ChipGroup } from '@/components/chip-group';
import { ErrorBanner } from '@/components/error-banner';
import { ActivityLevel, getProfile, putProfile, Sex } from '@/services/health-api';

// 선택지는 온보딩 신체 정보 화면(app/onboarding/body.tsx)과 동일하다.
const SEX_OPTIONS = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
];

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: '거의 안 움직여요' },
  { value: 'light', label: '가볍게 움직여요' },
  { value: 'moderate', label: '주 3~5회 운동해요' },
  { value: 'active', label: '거의 매일 운동해요' },
  { value: 'very_active', label: '몸 쓰는 일을 해요' },
];

export default function ProfileEditScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [heightText, setHeightText] = useState('');
  const [weightText, setWeightText] = useState('');
  const [birthYearText, setBirthYearText] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const profile = await getProfile();

      // 온보딩 게이트를 통과했으면 프로필이 있어야 하지만, 없어도 빈 폼으로 새로 입력할 수 있다.
      if (profile !== null) {
        setHeightText(String(profile.height_cm));
        setWeightText(String(profile.weight_kg));
        setBirthYearText(String(profile.birth_year));
        setSex(profile.sex);
        setActivityLevel(profile.activity_level);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // 검증 범위는 온보딩 신체 정보 화면과 동일하다.
  const currentYear = new Date().getFullYear();
  const height = Number(heightText);
  const weight = Number(weightText);
  const birthYear = Number(birthYearText);
  const isValid =
    sex !== null &&
    activityLevel !== null &&
    Number.isFinite(height) &&
    height >= 80 &&
    height <= 250 &&
    Number.isFinite(weight) &&
    weight >= 20 &&
    weight <= 300 &&
    Number.isInteger(birthYear) &&
    birthYear >= 1900 &&
    birthYear <= currentYear;

  const save = async () => {
    if (sex === null || activityLevel === null) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await putProfile({
        sex,
        birth_year: birthYear,
        height_cm: height,
        weight_kg: weight,
        activity_level: activityLevel,
      });

      // 내 정보 탭은 useFocusEffect로 복귀 시 다시 읽는다.
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.container}>
            <BackButton />

            <View style={styles.header}>
              <Text style={styles.title}>프로필 수정</Text>
              <Text style={styles.subtitle}>바꾼 값으로 목표 칼로리가 다시 계산됩니다.</Text>
            </View>

            {isLoading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color="#3182f6" />
                <Text style={styles.stateText}>프로필을 불러오는 중입니다.</Text>
              </View>
            ) : (
              <>
                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>키</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        keyboardType="numeric"
                        onChangeText={setHeightText}
                        placeholder="175"
                        placeholderTextColor="#b0b8c1"
                        style={styles.input}
                        value={heightText}
                      />
                      <Text style={styles.unit}>cm</Text>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>몸무게</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        keyboardType="numeric"
                        onChangeText={setWeightText}
                        placeholder="70.5"
                        placeholderTextColor="#b0b8c1"
                        style={styles.input}
                        value={weightText}
                      />
                      <Text style={styles.unit}>kg</Text>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>태어난 해</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        keyboardType="numeric"
                        maxLength={4}
                        onChangeText={setBirthYearText}
                        placeholder="1993"
                        placeholderTextColor="#b0b8c1"
                        style={styles.input}
                        value={birthYearText}
                      />
                      <Text style={styles.unit}>년</Text>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>성별</Text>
                    <ChipGroup
                      onToggle={(value) => {
                        if (value === 'male' || value === 'female') {
                          setSex(value);
                        }
                      }}
                      options={SEX_OPTIONS}
                      selectedValues={sex === null ? [] : [sex]}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>활동량</Text>
                    <ChipGroup
                      onToggle={(value) => {
                        if (
                          value === 'sedentary' ||
                          value === 'light' ||
                          value === 'moderate' ||
                          value === 'active' ||
                          value === 'very_active'
                        ) {
                          setActivityLevel(value);
                        }
                      }}
                      options={ACTIVITY_OPTIONS}
                      selectedValues={activityLevel === null ? [] : [activityLevel]}
                    />
                  </View>
                </View>

                {errorMessage ? (
                  <ErrorBanner message={errorMessage} onRetry={() => void save()} />
                ) : null}

                <Pressable
                  disabled={!isValid || isSaving}
                  onPress={() => void save()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (!isValid || isSaving) && styles.primaryButtonDisabled,
                    pressed && styles.pressed,
                  ]}>
                  {isSaving ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>저장</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  form: {
    gap: 16,
  },
  header: {
    gap: 4,
  },
  input: {
    color: '#191f28',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    paddingVertical: 14,
  },
  inputGroup: {
    gap: 8,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e8eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  keyboardView: {
    flex: 1,
  },
  label: {
    color: '#4e5968',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: '#b4c7e7',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  stateBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 32,
  },
  stateText: {
    color: '#6b7684',
    fontSize: 14,
  },
  subtitle: {
    color: '#6b7684',
    fontSize: 14,
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
  unit: {
    color: '#8b95a1',
    fontSize: 14,
    fontWeight: '700',
  },
});
