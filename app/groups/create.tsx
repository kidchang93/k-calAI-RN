import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { ChipGroup } from '@/components/chip-group';
import { ErrorBanner } from '@/components/error-banner';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { createGroup, GroupKind } from '@/services/group-api';
import { PlanLimitError } from '@/services/http';

// '챌린지' 종류는 **숨긴다**(2026-09-13, KCAL-18) — 지우지 않는다. 만성질환 관리에 순위·경쟁을 얹으면
// 기록이 성적표가 되므로 지금은 새로 만들 수 없게 두고, 필요해지면 이 목록에 되살린다.
// 챌린지 화면(`components/group-challenges.tsx`)·클라이언트(`services/challenge-api.ts`)·서버 API 는
// 그대로 있다. 이미 있는 챌린지 그룹은 목록·상세에서 이름표만 보인다.
const KIND_OPTIONS = [
  { value: 'family', label: '가족' },
  { value: 'couple', label: '커플' },
  { value: 'friends', label: '친구' },
];

export default function GroupCreateScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GroupKind | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 402(그룹 개수 한도) 전용 — 다시 시도해도 풀리지 않으므로 요금제 안내로 보낸다.
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0 && trimmedName.length <= 100 && kind !== null;

  const save = async () => {
    if (kind === null) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setPlanLimitMessage(null);

    try {
      const group = await createGroup({ name: trimmedName, kind });

      // 뒤로가기가 이 폼으로 돌아오지 않도록 상세로 교체 이동한다. 목록은 포커스 시 재조회된다.
      router.replace({ pathname: '/groups/[id]', params: { id: String(group.id) } });
    } catch (error) {
      if (error instanceof PlanLimitError) {
        setPlanLimitMessage(error.message);
      } else {
        setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen keyboard="avoid">
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
              placeholderTextColor="#a9a6a1"
              style={styles.input}
              value={name}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>어떤 모임인가요?</Text>
          <ChipGroup
            onToggle={(value) => {
              if (value === 'family' || value === 'couple' || value === 'friends') {
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

      {planLimitMessage ? (
        <ErrorBanner
          actionLabel="요금제 업그레이드"
          message={planLimitMessage}
          onRetry={() => router.push('/plan')}
        />
      ) : null}

      <PrimaryButton
        disabled={!isValid}
        label="만들기"
        loading={isSaving}
        onPress={() => void save()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  header: {
    gap: 4,
  },
  input: {
    color: '#22211f',
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
    borderColor: '#e4e2de',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  label: {
    color: '#5c5b57',
    fontSize: 14,
    fontWeight: '700',
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
