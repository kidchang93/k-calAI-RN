import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { ErrorBanner } from '@/components/error-banner';
import { OnboardingProgress } from '@/components/onboarding-progress';
import { ActivityLevel, putProfile, Sex } from '@/services/health-api';

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

export default function BodyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ consented?: string }>();
  // 동의(1단계)를 거치지 않은 딥링크 진입은 미동의로 간주한다. 민감정보 화면을 열지 않아 403이 나지 않는다.
  const isConsented = params.consented === '1';

  const [heightText, setHeightText] = useState('');
  const [weightText, setWeightText] = useState('');
  const [birthYearText, setBirthYearText] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const saveAndNext = async () => {
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

      // 동의하지 않았으면 혈액형·질병·알러지를 건너뛰고 목표로 직행한다.
      if (isConsented) {
        router.push({ pathname: '/onboarding/blood', params: { consented: '1' } });
      } else {
        router.push({ pathname: '/onboarding/goal', params: { consented: '0' } });
      }
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
            <OnboardingProgress current={2} total={isConsented ? 6 : 3} />

            <View style={styles.header}>
              <Text style={styles.title}>키와 몸무게를{'\n'}알려주세요</Text>
              <Text style={styles.subtitle}>하루 목표 칼로리를 계산하는 데 씁니다.</Text>
            </View>

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

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>키·몸무게는 언제든 내 정보에서 바꿀 수 있어요.</Text>
            </View>

            {errorMessage ? (
              <ErrorBanner message={errorMessage} onRetry={() => void saveAndNext()} />
            ) : null}

            <Pressable
              disabled={!isValid || isSaving}
              onPress={() => void saveAndNext()}
              style={({ pressed }) => [
                styles.primaryButton,
                (!isValid || isSaving) && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}>
              {isSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>다음</Text>
              )}
            </Pressable>
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
    gap: 6,
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
  noteBox: {
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    padding: 16,
  },
  noteText: {
    color: '#4e5968',
    fontSize: 13,
    lineHeight: 19,
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
  subtitle: {
    color: '#6b7684',
    fontSize: 14,
  },
  title: {
    color: '#191f28',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 34,
  },
  unit: {
    color: '#8b95a1',
    fontSize: 14,
    fontWeight: '700',
  },
});
