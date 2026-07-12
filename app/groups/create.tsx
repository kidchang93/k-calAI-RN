import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { createGroup, GroupKind } from '@/services/group-api';

const KIND_OPTIONS = [
  { value: 'family', label: '가족' },
  { value: 'couple', label: '커플' },
  { value: 'friends', label: '친구' },
  { value: 'challenge', label: '챌린지' },
];

export default function GroupCreateScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GroupKind | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0 && trimmedName.length <= 100 && kind !== null;

  const save = async () => {
    if (kind === null) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const group = await createGroup({ name: trimmedName, kind });

      // 뒤로가기가 이 폼으로 돌아오지 않도록 상세로 교체 이동한다. 목록은 포커스 시 재조회된다.
      router.replace({ pathname: '/groups/[id]', params: { id: String(group.id) } });
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
              <Text style={styles.title}>그룹 만들기</Text>
              <Text style={styles.subtitle}>초대코드는 만들어진 뒤 자동으로 발급됩니다.</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>그룹 이름</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    maxLength={100}
                    onChangeText={setName}
                    placeholder="우리집"
                    placeholderTextColor="#b0b8c1"
                    style={styles.input}
                    value={name}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>어떤 모임인가요?</Text>
                <ChipGroup
                  onToggle={(value) => {
                    if (
                      value === 'family' ||
                      value === 'couple' ||
                      value === 'friends' ||
                      value === 'challenge'
                    ) {
                      setKind(value);
                    }
                  }}
                  options={KIND_OPTIONS}
                  selectedValues={kind === null ? [] : [kind]}
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
                <Text style={styles.primaryButtonText}>만들기</Text>
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
  subtitle: {
    color: '#6b7684',
    fontSize: 14,
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
  },
});
