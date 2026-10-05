import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChunkyButton } from '@/components/chunky-button';
import { DetailHeader } from '@/components/detail-header';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { MedicalDisclaimer } from '@/components/medical-disclaimer';
import { Screen } from '@/components/screen';
import { DISPLAY_FONT } from '@/constants/typography';
import { ConditionGuide, GuideAxis, getGuide } from '@/services/guide-api';
import { addVisitQuestion } from '@/services/visit-api';

// 질환별 식이 가이드 — '질환 도감' (서버 `docs/CARE_LOOP.md` §5, 2026-10-05 상세 화면 재구성).
//
// **축은 카드 한 장씩 고른다.** 축이 4개이고 각각 본문이 길어서 전부 펼치면 스크롤만 길어지고
// 아무것도 읽히지 않는다. 위 2열 카드로 무엇이 있는지 보이고, 고른 한 장만 아래에 펼친다.
//
// `?axis=sodium` 으로 들어오면 그 축을 고른 채 시작한다 — 경고 배너의 "왜 이 경고가 떴나요?"가
// 이 경로로 들어온다. 없거나 모르는 축이면 첫 카드다.
//
// '읽음/새 카드' 표시는 넣지 않는다 — 읽은 기록을 둘 저장소가 없다.
export default function ConditionGuideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ condition?: string; axis?: string }>();
  const condition = typeof params.condition === 'string' ? params.condition : '';
  const initialAxis = typeof params.axis === 'string' ? params.axis : null;

  const [guide, setGuide] = useState<ConditionGuide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAxis, setSelectedAxis] = useState<string | null>(initialAxis);
  const [isBagging, setIsBagging] = useState(false);
  const [bagStatus, setBagStatus] = useState<'added' | 'exists' | null>(null);
  const [bagError, setBagError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setGuide(await getGuide(condition));
    } catch (error) {
      // 가이드 없음(404)도 화면에서는 같은 안내다 — 보여줄 것이 없다는 점에서 같다.
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [condition]);

  useEffect(() => {
    void load();
  }, [load]);

  const axis =
    guide === null
      ? null
      : (guide.axes.find((item) => item.axis === selectedAxis) ?? guide.axes[0] ?? null);

  const selectAxis = (code: string) => {
    setSelectedAxis(code);
    setBagStatus(null);
    setBagError(null);
  };

  // 칼륨·인처럼 기준이 검사로 정해지는 것은 앱이 답하지 않고 의료진에게 물을 거리로 넘긴다 —
  // 판단 대행을 하지 않는다(서버 PRODUCT_STRATEGY §0-1).
  const addToBag = async (target: GuideAxis) => {
    const question = bagQuestion(target);

    setIsBagging(true);
    setBagStatus(null);
    setBagError(null);

    try {
      const { added } = await addVisitQuestion(question);

      setBagStatus(added ? 'added' : 'exists');
    } catch (error) {
      // 민감정보 미동의(403)는 서버가 사용자용 문장을 준다 — 그대로 보여 준다.
      setBagError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsBagging(false);
    }
  };

  return (
    <Screen
      footer={
        axis === null ? null : (
          <>
            <ChunkyButton
              label="진료 때 물어볼 것에 담기"
              loading={isBagging}
              onPress={() => void addToBag(axis)}
              tone="visit"
              variant="outline"
            />
            {bagError !== null ? (
              <Text style={styles.bagError}>{bagError}</Text>
            ) : bagStatus === null ? (
              <Text style={styles.bagHint}>{`‘${bagQuestion(axis)}’가 진료 가방에 들어가요`}</Text>
            ) : (
              <View style={styles.bagDone}>
                <Text style={styles.bagDoneText}>
                  {bagStatus === 'added' ? '진료 가방에 담았어요' : '이미 담겨 있어요'}
                </Text>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push('/visit')}
                  style={({ pressed }) => [styles.bagLink, pressed && styles.pressed]}>
                  <Text style={styles.bagLinkText}>진료 탭에서 보기</Text>
                  <MaterialIcons color="#1e4290" name="chevron-right" size={20} />
                </Pressable>
              </View>
            )}
          </>
        )
      }
      gap={14}>
      <DetailHeader
        caption={guide === null ? null : `카드 ${guide.axes.length}장`}
        title={guide === null ? '질환 도감' : `${guide.label} 도감`}
        tone="care"
      />

      {isLoading ? (
        <LoadingState label="가이드를 불러오는 중입니다." />
      ) : errorMessage !== null ? (
        <ErrorBanner message={errorMessage} onRetry={() => void load()} />
      ) : guide === null ? null : (
        <>
          <Text style={styles.intro}>{guide.intro}</Text>

          <View style={styles.grid}>
            {guide.axes.map((item) => (
              <AxisTile
                key={item.axis}
                axis={item}
                isSelected={axis !== null && axis.axis === item.axis}
                onPress={() => selectAxis(item.axis)}
              />
            ))}
          </View>

          {/* key 로 축이 바뀌면 접힘 상태를 첫 섹션 펼침으로 되돌린다. */}
          {axis !== null ? <AxisDetail key={axis.axis} axis={axis} /> : null}

          <Text style={styles.notice}>{guide.notice}</Text>
          <MedicalDisclaimer tone="strong" />
        </>
      )}
    </Screen>
  );
}

function bagQuestion(axis: GuideAxis): string {
  return `${axis.label} — 제 경우엔 어떻게 하면 될까요?`;
}

function AxisTile({
  axis,
  isSelected,
  onPress,
}: {
  axis: GuideAxis;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        isSelected && styles.tileSelected,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.tileLabel}>{axis.label}</Text>
      {isSelected ? (
        <Text style={styles.tileCurrent}>지금 보는 카드</Text>
      ) : (
        <Text numberOfLines={1} style={styles.tileSummary}>
          {axis.summary}
        </Text>
      )}
    </Pressable>
  );
}

function AxisDetail({ axis }: { axis: GuideAxis }) {
  const [openSection, setOpenSection] = useState<string | null>(axis.sections[0]?.title ?? null);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {axis.label}
        </Text>
        <Text style={styles.summary}>{axis.summary}</Text>
      </View>

      {axis.sections.map((section) => {
        const isOpen = openSection === section.title;

        return (
          <View key={section.title} style={styles.section}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              onPress={() => setOpenSection(isOpen ? null : section.title)}
              style={({ pressed }) => [styles.sectionHead, pressed && styles.pressed]}>
              <Text style={[styles.sectionTitle, isOpen && styles.sectionTitleOpen]}>
                {section.title}
              </Text>
              <MaterialIcons
                color={isOpen ? '#1c5a55' : '#a9a6a1'}
                name={isOpen ? 'expand-less' : 'expand-more'}
                size={24}
              />
            </Pressable>
            {isOpen
              ? section.paragraphs.map((paragraph) => (
                  <Text key={paragraph} style={styles.paragraph}>
                    {paragraph}
                  </Text>
                ))
              : null}
          </View>
        );
      })}

      {/* 병존에서 방향이 엇갈리는 축(칼륨)의 경고. 본문보다 눈에 띄어야 한다 —
          서로 반대인 안내를 각각 읽고 혼자 판단하는 것이 가장 위험하다. */}
      {axis.caution !== null ? (
        <View style={styles.cautionBox}>
          <View style={styles.cautionHead}>
            <MaterialIcons color="#a4603f" name="warning-amber" size={18} />
            <Text style={styles.cautionTitle}>다른 질환이 함께 있다면</Text>
          </View>
          <Text style={styles.cautionText}>{axis.caution}</Text>
        </View>
      ) : null}

      {/* 출처를 접거나 숨기지 않는다 — 근거를 밝히는 것이 이 화면의 존재 이유다. */}
      <View style={styles.sources}>
        <Text style={styles.sourcesTitle}>근거</Text>
        {axis.sources.map((source) => (
          <Text key={source} style={styles.sourceItem}>
            {`· ${source}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bagDone: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  bagDoneText: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '800',
  },
  bagError: {
    color: '#b8524e',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  bagHint: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  bagLink: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 4,
  },
  bagLinkText: {
    color: '#1e4290',
    fontFamily: DISPLAY_FONT,
    fontSize: 17,
  },
  card: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 20,
    borderWidth: 2,
    gap: 12,
    padding: 16,
  },
  cardHead: {
    gap: 4,
  },
  cardTitle: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 24,
  },
  cautionBox: {
    backgroundColor: '#fbeee7',
    borderRadius: 14,
    gap: 4,
    padding: 12,
  },
  cautionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cautionText: {
    color: '#22211f',
    fontSize: 15,
    lineHeight: 22,
  },
  cautionTitle: {
    color: '#a4603f',
    fontSize: 15,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  intro: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 23,
  },
  notice: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 22,
  },
  paragraph: {
    color: '#22211f',
    fontSize: 15,
    lineHeight: 24,
  },
  pressed: {
    opacity: 0.74,
  },
  section: {
    borderTopColor: '#e4e2de',
    borderTopWidth: 2,
    gap: 8,
  },
  sectionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  sectionTitle: {
    color: '#22211f',
    flex: 1,
    fontFamily: DISPLAY_FONT,
    fontSize: 18,
  },
  sectionTitleOpen: {
    color: '#1c5a55',
  },
  sourceItem: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 21,
  },
  sources: {
    backgroundColor: '#f7f6f4',
    borderRadius: 14,
    gap: 4,
    padding: 12,
  },
  sourcesTitle: {
    color: '#5c5b57',
    fontSize: 15,
    fontWeight: '800',
  },
  summary: {
    color: '#22211f',
    fontSize: 15,
    lineHeight: 23,
  },
  tile: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 5,
    borderColor: '#e4e2de',
    borderRadius: 16,
    borderWidth: 2,
    flexBasis: '40%',
    flexGrow: 1,
    gap: 2,
    minHeight: 84,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tileCurrent: {
    color: '#1c5a55',
    fontSize: 15,
    fontWeight: '800',
  },
  tileLabel: {
    color: '#22211f',
    fontFamily: DISPLAY_FONT,
    fontSize: 21,
  },
  tileSelected: {
    backgroundColor: '#eef7f5',
    borderBottomWidth: 6,
    borderColor: '#2a7d76',
    borderWidth: 3,
  },
  tileSummary: {
    color: '#5c5b57',
    fontSize: 15,
  },
});
