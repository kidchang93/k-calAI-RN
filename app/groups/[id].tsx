import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { useAuthSession } from '@/services/auth-session';
import {
  attachPetToGroup,
  deleteGroup,
  detachPetFromGroup,
  getGroupDetail,
  GroupDetail,
  GroupKind,
  GroupMemberItem,
  GroupPetItem,
  leaveGroup,
  removeMember,
} from '@/services/group-api';
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
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const groupId = Number(params.id);
  const isValidId = Number.isInteger(groupId) && groupId > 0;

  // 소유자 판별: 상세 응답의 owner_id를 내 세션 user.id와 비교한다.
  // 인증 가드(_layout)를 통과한 화면이라 정상 흐름에서는 항상 authenticated다.
  const sessionState = useAuthSession();
  const myUserId = sessionState.status === 'authenticated' ? sessionState.session.user.id : null;

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [myPets, setMyPets] = useState<PetResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sharingPetId, setSharingPetId] = useState<number | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);
  const [detachingPetId, setDetachingPetId] = useState<number | null>(null);
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

  // 라이프사이클 액션(나가기·삭제·제거·해제)의 실패는 서버 한국어 detail을 Alert로 그대로 보여준다.
  const alertActionError = (title: string, error: unknown) => {
    Alert.alert(title, error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
  };

  const confirmLeave = (group: GroupDetail) => {
    Alert.alert('그룹 나가기', `'${group.name}' 그룹에서 나갈까요? 공유한 반려동물도 함께 빠져요.`, [
      { text: '취소', style: 'cancel' },
      { text: '나가기', style: 'destructive', onPress: () => void handleLeave() },
    ]);
  };

  const handleLeave = async () => {
    setIsLeaving(true);

    try {
      await leaveGroup(groupId);
      // 목록으로 복귀. 목록은 useFocusEffect로 재조회한다.
      router.back();
    } catch (error) {
      alertActionError('그룹 나가기 실패', error);
    } finally {
      setIsLeaving(false);
    }
  };

  const confirmDeleteGroup = (group: GroupDetail) => {
    Alert.alert(
      '그룹 삭제',
      `'${group.name}' 그룹을 삭제할까요? 멤버·반려동물 참여가 모두 해제되며 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => void handleDeleteGroup() },
      ],
    );
  };

  const handleDeleteGroup = async () => {
    setIsDeletingGroup(true);

    try {
      await deleteGroup(groupId);
      router.back();
    } catch (error) {
      alertActionError('그룹 삭제 실패', error);
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const confirmRemoveMember = (member: GroupMemberItem) => {
    Alert.alert(
      '멤버 제거',
      `${member.phone_number_masked} 님을 그룹에서 제거할까요? 이 멤버가 공유한 반려동물도 함께 빠져요.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '제거', style: 'destructive', onPress: () => void handleRemoveMember(member.user_id) },
      ],
    );
  };

  const handleRemoveMember = async (userId: number) => {
    setRemovingUserId(userId);

    try {
      await removeMember(groupId, userId);
      await loadDetail();
    } catch (error) {
      alertActionError('멤버 제거 실패', error);
    } finally {
      setRemovingUserId(null);
    }
  };

  const confirmDetachPet = (pet: GroupPetItem) => {
    Alert.alert('참여 해제', `'${pet.name}'의 그룹 참여를 해제할까요? 급여 기록은 지워지지 않아요.`, [
      { text: '취소', style: 'cancel' },
      { text: '해제', style: 'destructive', onPress: () => void handleDetachPet(pet.pet_id) },
    ]);
  };

  const handleDetachPet = async (petId: number) => {
    setDetachingPetId(petId);

    try {
      await detachPetFromGroup(groupId, petId);
      await loadDetail();
    } catch (error) {
      alertActionError('참여 해제 실패', error);
    } finally {
      setDetachingPetId(null);
    }
  };

  const isOwner = detail !== null && myUserId !== null && detail.owner_id === myUserId;
  const isActing =
    isLeaving || isDeletingGroup || removingUserId !== null || detachingPetId !== null;

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
                    {isOwner && member.user_id !== myUserId ? (
                      <Pressable
                        disabled={isActing}
                        hitSlop={8}
                        onPress={() => confirmRemoveMember(member)}
                        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                        {removingUserId === member.user_id ? (
                          <ActivityIndicator color="#e5484d" size="small" />
                        ) : (
                          <MaterialIcons color="#e5484d" name="person-remove" size={20} />
                        )}
                      </Pressable>
                    ) : null}
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
                      {isOwner || myPets.some((myPet) => myPet.id === pet.pet_id) ? (
                        // 해제 권한은 펫 소유자 또는 그룹 소유자 (17장).
                        <Pressable
                          disabled={isActing}
                          hitSlop={8}
                          onPress={() => confirmDetachPet(pet)}
                          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                          {detachingPetId === pet.pet_id ? (
                            <ActivityIndicator color="#e5484d" size="small" />
                          ) : (
                            <MaterialIcons color="#e5484d" name="link-off" size={20} />
                          )}
                        </Pressable>
                      ) : null}
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

              <View style={styles.section}>
                {isOwner ? (
                  <Pressable
                    disabled={isActing}
                    onPress={() => confirmDeleteGroup(detail)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <MaterialIcons color="#e5484d" name="delete-outline" size={20} />
                    {isDeletingGroup ? (
                      <ActivityIndicator color="#e5484d" size="small" />
                    ) : (
                      <Text style={styles.dangerLabel}>그룹 삭제</Text>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    disabled={isActing}
                    onPress={() => confirmLeave(detail)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <MaterialIcons color="#e5484d" name="logout" size={20} />
                    {isLeaving ? (
                      <ActivityIndicator color="#e5484d" size="small" />
                    ) : (
                      <Text style={styles.dangerLabel}>그룹 나가기</Text>
                    )}
                  </Pressable>
                )}
              </View>
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
  dangerLabel: {
    color: '#e5484d',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    gap: 4,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
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
