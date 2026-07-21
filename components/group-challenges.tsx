import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GROUP_ACTIVITY_SHARE_VERSION } from '@/constants/consent';
import {
  ChallengeDetail,
  ChallengeSummary,
  createChallenge,
  deleteChallenge,
  getChallengeDetail,
  getChallenges,
} from '@/services/challenge-api';
import { formatDateParam } from '@/services/health-api';
import { postConsent } from '@/services/onboarding-api';

// 그룹 운동 챌린지 (kcalAI-model/docs/ACTIVITY_GUIDANCE.md 3-4).
//
// ⚠️ 순위는 **제3자 노출**이다. 동의(group_activity_share)한 멤버만 서버가 순위에 담아 주고,
// 내가 동의하지 않았으면 챌린지는 볼 수 있되 내 기록은 남에게 보이지 않는다 — 그 사실을 화면에 밝힌다.

const DEFAULT_TARGET_MINUTES = 150;
const DEFAULT_PERIOD_DAYS = 7;

export function GroupChallenges({ groupId }: { groupId: number }) {
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [targetText, setTargetText] = useState(String(DEFAULT_TARGET_MINUTES));

  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const list = await getChallenges(groupId);
      setChallenges(list);
      // 진행 중인 챌린지가 있으면 그것을 펼쳐 둔다 — 가장 보고 싶은 것이다.
      const active = list.find((entry) => entry.is_active) ?? list[0] ?? null;
      setOpenId(active?.id ?? null);
      setDetail(active ? await getChallengeDetail(groupId, active.id) : null);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openChallenge = async (id: number) => {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }

    setOpenId(id);

    try {
      setDetail(await getChallengeDetail(groupId, id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  const submit = async (action: () => Promise<unknown>) => {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      await action();
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsBusy(false);
    }
  };

  const create = () => {
    const target = Number(targetText.trim());

    if (title.trim() === '') {
      setErrorMessage('챌린지 이름을 입력해주세요.');
      return;
    }

    if (!Number.isFinite(target) || target < 1) {
      setErrorMessage('목표 시간을 1분 이상으로 입력해주세요.');
      return;
    }

    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + (DEFAULT_PERIOD_DAYS - 1));

    void submit(async () => {
      await createChallenge(groupId, {
        title: title.trim(),
        target_minutes: Math.round(target),
        start_date: formatDateParam(start),
        end_date: formatDateParam(end),
      });
      setTitle('');
      setTargetText(String(DEFAULT_TARGET_MINUTES));
      setIsCreating(false);
    });
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>운동 챌린지</Text>
        <Pressable
          onPress={() => setIsCreating((current) => !current)}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          <MaterialIcons color="#3182f6" name={isCreating ? 'close' : 'add'} size={18} />
        </Pressable>
      </View>

      {errorMessage !== null ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {isCreating ? (
        <View style={styles.card}>
          <TextInput
            maxLength={60}
            onChangeText={setTitle}
            placeholder="예: 이번 주 다 같이 걷기"
            placeholderTextColor="#b0b8c1"
            style={styles.input}
            value={title}
          />
          <View style={styles.targetRow}>
            <Text style={styles.targetLabel}>1인 목표</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setTargetText}
              style={styles.targetInput}
              value={targetText}
            />
            <Text style={styles.targetUnit}>분 / 7일</Text>
          </View>
          <Pressable
            disabled={isBusy}
            onPress={create}
            style={({ pressed }) => [
              styles.primaryButton,
              isBusy && styles.disabled,
              pressed && !isBusy && styles.pressed,
            ]}>
            {isBusy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>챌린지 만들기</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color="#3182f6" />
      ) : challenges.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            아직 챌린지가 없어요. 함께 목표를 정하면 서로의 진행 상황을 볼 수 있어요.
          </Text>
        </View>
      ) : (
        challenges.map((challenge) => (
          <View key={challenge.id} style={styles.card}>
            <Pressable
              onPress={() => void openChallenge(challenge.id)}
              style={({ pressed }) => [styles.challengeHeader, pressed && styles.pressed]}>
              <View style={styles.challengeBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.challengeTitle}>{challenge.title}</Text>
                  {challenge.is_active ? (
                    <View style={styles.activeChip}>
                      <Text style={styles.activeText}>진행 중</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.challengeMeta}>
                  {`1인 ${challenge.target_minutes}분 · ${challenge.start_date} ~ ${challenge.end_date}`}
                </Text>
              </View>
              <MaterialIcons
                color="#8b95a1"
                name={openId === challenge.id ? 'expand-less' : 'expand-more'}
                size={20}
              />
            </Pressable>

            {openId === challenge.id && detail !== null && detail.id === challenge.id ? (
              <View style={styles.detailBody}>
                {/* 내가 공유에 동의하지 않았으면 순위에 안 들어간다 — 숨기지 말고 이유와 방법을 준다. */}
                {!detail.i_am_sharing ? (
                  <View style={styles.consentBox}>
                    <Text style={styles.consentText}>
                      내 활동량은 아직 그룹에 공개되지 않아요. 순위에 참여하려면 활동 공유에
                      동의해주세요. 공개되는 건 이름과 합계 시간뿐이고, 어떤 운동을 했는지는 보이지
                      않아요.
                    </Text>
                    <Pressable
                      disabled={isBusy}
                      onPress={() =>
                        void submit(() =>
                          postConsent('group_activity_share', GROUP_ACTIVITY_SHARE_VERSION)
                        )
                      }
                      style={({ pressed }) => [
                        styles.consentButton,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={styles.consentButtonText}>활동 공유 동의하기</Text>
                    </Pressable>
                  </View>
                ) : null}

                {detail.entries.length === 0 ? (
                  <Text style={styles.emptyText}>아직 참여자가 없어요.</Text>
                ) : (
                  detail.entries.map((entry) => (
                    <View key={entry.user_id} style={styles.entryRow}>
                      <Text style={styles.entryRank}>{entry.rank}</Text>
                      <Text style={[styles.entryName, entry.is_me && styles.entryNameMe]}>
                        {entry.is_me ? `${entry.nickname} (나)` : entry.nickname}
                      </Text>
                      <Text style={styles.entryMinutes}>{`${entry.minutes}분`}</Text>
                      {entry.achieved ? (
                        <MaterialIcons color="#0f8a5f" name="check-circle" size={16} />
                      ) : null}
                    </View>
                  ))
                )}

                {detail.participant_count < detail.member_count ? (
                  <Text style={styles.note}>
                    {`멤버 ${detail.member_count}명 중 ${detail.participant_count}명이 활동을 공유하고 있어요.`}
                  </Text>
                ) : null}

                <Pressable
                  disabled={isBusy}
                  onPress={() => void submit(() => deleteChallenge(groupId, challenge.id))}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                  <Text style={styles.deleteButtonText}>챌린지 삭제</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  activeChip: {
    backgroundColor: '#e9f8f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeText: {
    color: '#0f8a5f',
    fontSize: 11,
    fontWeight: '800',
  },
  addButton: {
    padding: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 16,
  },
  challengeBody: {
    flex: 1,
    gap: 4,
  },
  challengeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  challengeMeta: {
    color: '#8b95a1',
    fontSize: 12,
  },
  challengeTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
  },
  consentBox: {
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    gap: 8,
    padding: 12,
  },
  consentButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    paddingVertical: 10,
  },
  consentButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  consentText: {
    color: '#4e5968',
    fontSize: 12,
    lineHeight: 18,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: '#e5484d',
    fontSize: 13,
    fontWeight: '700',
  },
  detailBody: {
    borderTopColor: '#f2f4f6',
    borderTopWidth: 1,
    gap: 8,
    paddingTop: 10,
  },
  disabled: {
    backgroundColor: '#b0c9f0',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
  },
  emptyText: {
    color: '#8b95a1',
    fontSize: 13,
    lineHeight: 19,
  },
  entryMinutes: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '800',
  },
  entryName: {
    color: '#4e5968',
    flex: 1,
    fontSize: 14,
  },
  entryNameMe: {
    color: '#191f28',
    fontWeight: '800',
  },
  entryRank: {
    color: '#8b95a1',
    fontSize: 13,
    fontWeight: '800',
    width: 20,
  },
  entryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  error: {
    color: '#e5484d',
    fontSize: 13,
  },
  input: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    color: '#191f28',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  note: {
    color: '#8b95a1',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.74,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 8,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '800',
  },
  targetInput: {
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    color: '#191f28',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
    width: 72,
  },
  targetLabel: {
    color: '#6b7684',
    fontSize: 13,
  },
  targetRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  targetUnit: {
    color: '#6b7684',
    fontSize: 13,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
});
