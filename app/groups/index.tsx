import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { getGroups, GroupKind, GroupSummary } from '@/services/group-api';

// 값 제약(DATA_MODEL.md 9장)에 붙은 화면 구조 상수. 끼니 라벨처럼 화면마다 코드 상수로 둔다.
const GROUP_KIND_LABELS: Record<GroupKind, string> = {
  family: '가족',
  couple: '커플',
  friends: '친구',
  challenge: '챌린지',
};

export default function GroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setGroups(await getGroups());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 생성·참여 화면에서 돌아왔을 때 목록을 갱신하기 위해 포커스마다 다시 읽는다 (홈 화면 패턴).
  useFocusEffect(
    useCallback(() => {
      void loadGroups();
    }, [loadGroups])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>내 그룹</Text>
            <Text style={styles.subtitle}>가족·친구와 함께 기록을 이어가세요.</Text>
          </View>

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>그룹 목록을 불러오는 중입니다.</Text>
            </View>
          ) : errorMessage ? (
            <ErrorBanner message={errorMessage} onRetry={() => void loadGroups()} />
          ) : groups === null || groups.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialIcons color="#3182f6" name="groups" size={28} />
              <Text style={styles.emptyTitle}>아직 그룹이 없어요</Text>
              <Text style={styles.emptyText}>
                그룹을 만들거나 초대코드로 참여하면 함께 기록할 수 있습니다.
              </Text>
            </View>
          ) : (
            <View style={styles.groupList}>
              {groups.map((group) => (
                <GroupRow
                  key={group.id}
                  group={group}
                  onPress={() =>
                    router.push({ pathname: '/groups/[id]', params: { id: String(group.id) } })
                  }
                />
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push('/groups/create')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>그룹 만들기</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/groups/join')}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>초대코드로 참여</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GroupRow({ group, onPress }: { group: GroupSummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}>
      <MaterialIcons color="#3182f6" name="groups" size={24} />
      <View style={styles.groupBody}>
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.groupMeta}>
          {`${GROUP_KIND_LABELS[group.kind]} · ${group.member_count}명${group.role === 'owner' ? ' · 내가 만든 그룹' : ''}`}
        </Text>
      </View>
      <MaterialIcons color="#b0b8c1" name="chevron-right" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    padding: 24,
  },
  emptyText: {
    color: '#6b7684',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#191f28',
    fontSize: 19,
    fontWeight: '900',
  },
  groupBody: {
    flex: 1,
    gap: 2,
  },
  groupList: {
    gap: 10,
  },
  groupMeta: {
    color: '#6b7684',
    fontSize: 13,
  },
  groupName: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '800',
  },
  groupRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  header: {
    gap: 4,
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    paddingVertical: 14,
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
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e8eb',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#3182f6',
    fontSize: 16,
    fontWeight: '800',
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
});
