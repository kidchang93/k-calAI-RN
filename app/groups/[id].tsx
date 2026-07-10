import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { attachPetToGroup, getGroupDetail, GroupDetail, GroupKind } from '@/services/group-api';
import { getPets, PetResponse } from '@/services/pet-api';

const GROUP_KIND_LABELS: Record<GroupKind, string> = {
  family: '가족',
  couple: '커플',
  friends: '친구',
  challenge: '챌린지',
};

const ROLE_LABELS: Record<'owner' | 'member', string> = {
  owner: '방장',
  member: '멤버',
};

const SPECIES_LABELS: Record<string, string> = {
  dog: '강아지',
  cat: '고양이',
  other: '기타',
};

export default function GroupDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const groupId = Number(params.id);
  const isValidId = Number.isInteger(groupId) && groupId > 0;

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [myPets, setMyPets] = useState<PetResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sharingPetId, setSharingPetId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!isValidId) {
      setIsLoading(false);
      setErrorMessage('그룹을 찾을 수 없습니다.');

      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      setDetail(await getGroupDetail(groupId));

      // 내 반려동물 목록은 공유 진입점 표시에만 쓴다. 실패해도 상세 화면을 막지 않는다.
      try {
        setMyPets(await getPets());
      } catch {
        setMyPets([]);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [groupId, isValidId]);

  // 반려동물 등록 화면 등을 다녀왔을 때 갱신되도록 포커스마다 다시 읽는다 (홈 화면 패턴).
  useFocusEffect(
    useCallback(() => {
      void loadDetail();
    }, [loadDetail])
  );

  const shareInviteCode = async (group: GroupDetail) => {
    try {
      await Share.share({
        message: `'${group.name}' 그룹 초대코드: ${group.invite_code}\nk-cal 앱에서 초대코드로 참여해주세요.`,
      });
    } catch {
      // 공유 시트 취소·미지원(web)은 오류로 취급하지 않는다.
    }
  };

  const sharePet = async (petId: number) => {
    setSharingPetId(petId);
    setErrorMessage(null);

    try {
      await attachPetToGroup(groupId, petId);
      await loadDetail();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setSharingPetId(null);
    }
  };

  // 이미 그룹에 참여한 펫은 공유 후보에서 제외한다.
  const sharablePets =
    detail === null
      ? []
      : myPets.filter((pet) => !detail.pets.some((groupPet) => groupPet.pet_id === pet.id));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>그룹 정보를 불러오는 중입니다.</Text>
            </View>
          ) : detail === null ? (
            errorMessage ? (
              <ErrorBanner message={errorMessage} onRetry={() => void loadDetail()} />
            ) : null
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{detail.name}</Text>
                <Text style={styles.subtitle}>
                  {`${GROUP_KIND_LABELS[detail.kind]} · ${detail.members.length}명`}
                </Text>
              </View>

              {errorMessage ? (
                <ErrorBanner message={errorMessage} onRetry={() => void loadDetail()} />
              ) : null}

              <View style={styles.inviteCard}>
                <View style={styles.inviteBody}>
                  <Text style={styles.inviteLabel}>초대코드</Text>
                  <Text style={styles.inviteCode}>{detail.invite_code}</Text>
                </View>
                <Pressable
                  onPress={() => void shareInviteCode(detail)}
                  style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
                  <MaterialIcons color="#3182f6" name="ios-share" size={18} />
                  <Text style={styles.shareButtonText}>공유</Text>
                </Pressable>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>멤버</Text>
                {detail.members.map((member) => (
                  <View key={member.user_id} style={styles.row}>
                    <MaterialIcons color="#4e5968" name="person" size={20} />
                    <Text style={styles.rowLabel}>{member.phone_number_masked}</Text>
                    <Text
                      style={[styles.roleBadge, member.role === 'owner' && styles.roleBadgeOwner]}>
                      {ROLE_LABELS[member.role]}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>함께하는 반려동물</Text>
                {detail.pets.length === 0 ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteText}>아직 그룹에 참여한 반려동물이 없어요.</Text>
                  </View>
                ) : (
                  detail.pets.map((pet) => (
                    <View key={pet.pet_id} style={styles.row}>
                      <MaterialIcons color="#4e5968" name="pets" size={20} />
                      <Text style={styles.rowLabel}>{pet.name}</Text>
                      <Text style={styles.rowMeta}>{SPECIES_LABELS[pet.species] ?? pet.species}</Text>
                    </View>
                  ))
                )}
              </View>

              {sharablePets.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>내 반려동물 공유하기</Text>
                  <Text style={styles.sectionHint}>
                    공유하면 그룹 멤버가 함께 급여를 기록할 수 있어요.
                  </Text>
                  {sharablePets.map((pet) => (
                    <View key={pet.id} style={styles.row}>
                      <MaterialIcons color="#4e5968" name="pets" size={20} />
                      <Text style={styles.rowLabel}>{pet.name}</Text>
                      <Pressable
                        disabled={sharingPetId !== null}
                        onPress={() => void sharePet(pet.id)}
                        style={({ pressed }) => [
                          styles.attachButton,
                          sharingPetId !== null && styles.attachButtonDisabled,
                          pressed && styles.pressed,
                        ]}>
                        {sharingPetId === pet.id ? (
                          <ActivityIndicator color="#3182f6" size="small" />
                        ) : (
                          <Text style={styles.attachButtonText}>공유</Text>
                        )}
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  attachButton: {
    alignItems: 'center',
    backgroundColor: '#edf6ff',
    borderRadius: 8,
    minWidth: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  attachButtonDisabled: {
    opacity: 0.5,
  },
  attachButtonText: {
    color: '#3182f6',
    fontSize: 14,
    fontWeight: '800',
  },
  container: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    width: '100%',
  },
  header: {
    gap: 4,
  },
  inviteBody: {
    flex: 1,
    gap: 2,
  },
  inviteCard: {
    alignItems: 'center',
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  inviteCode: {
    color: '#191f28',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },
  inviteLabel: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  noteBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
  },
  noteText: {
    color: '#6b7684',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.74,
  },
  roleBadge: {
    backgroundColor: '#f2f4f6',
    borderRadius: 999,
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleBadgeOwner: {
    backgroundColor: '#edf6ff',
    color: '#3182f6',
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  rowLabel: {
    color: '#191f28',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  rowMeta: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    gap: 10,
  },
  sectionHint: {
    color: '#6b7684',
    fontSize: 13,
  },
  sectionTitle: {
    color: '#191f28',
    fontSize: 17,
    fontWeight: '800',
  },
  shareButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  shareButtonText: {
    color: '#3182f6',
    fontSize: 14,
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
