import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ErrorBanner } from '@/components/error-banner';
import { MedicalDisclaimer } from '@/components/medical-disclaimer';
import { ConditionGuide, GuideAxis, getGuide, GuideNotFoundError } from '@/services/guide-api';

// 질환별 식이 가이드 (서버 `docs/CARE_LOOP.md` §5).
//
// **축을 접어 둔다.** 축이 4개이고 각각 본문이 길어서 전부 펼치면 스크롤만 길어지고 아무것도
// 읽히지 않는다. 대신 요약 한 줄은 항상 보이므로 무엇이 있는지는 접힌 상태에서도 알 수 있다.
//
// `?axis=sodium` 으로 들어오면 그 축만 펼친 채 시작한다 — 경고 배너의 "왜 이 경고가 떴나요?"가
// 이 경로로 들어온다. 목록에서 들어오면 전부 접혀 있다.
export default function ConditionGuideScreen() {
  const params = useLocalSearchParams<{ condition?: string; axis?: string }>();
  const condition = typeof params.condition === 'string' ? params.condition : '';
  const initialAxis = typeof params.axis === 'string' ? params.axis : null;

  const [guide, setGuide] = useState<ConditionGuide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openAxis, setOpenAxis] = useState<string | null>(initialAxis);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setGuide(await getGuide(condition));
    } catch (error) {
      // 가이드 없음(404)도 화면에서는 같은 안내다 — 보여줄 것이 없다는 점에서 같다.
      setErrorMessage(
        error instanceof GuideNotFoundError
          ? error.message
          : error instanceof Error
            ? error.message
            : '알 수 없는 오류가 발생했습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [condition]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#3182f6" />
              <Text style={styles.stateText}>가이드를 불러오는 중입니다.</Text>
            </View>
          ) : errorMessage !== null ? (
            <ErrorBanner message={errorMessage} onRetry={() => void load()} />
          ) : guide === null ? null : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{`${guide.label} 식단 가이드`}</Text>
                <Text style={styles.intro}>{guide.intro}</Text>
              </View>

              {guide.axes.map((axis) => (
                <AxisCard
                  key={axis.axis}
                  axis={axis}
                  isOpen={openAxis === axis.axis}
                  onToggle={() => setOpenAxis(openAxis === axis.axis ? null : axis.axis)}
                />
              ))}

              <Text style={styles.notice}>{guide.notice}</Text>
              <MedicalDisclaimer tone="strong" />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AxisCard({
  axis,
  isOpen,
  onToggle,
}: {
  axis: GuideAxis;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={onToggle}
        style={({ pressed }) => [styles.cardHead, pressed && styles.pressed]}>
        <View style={styles.cardHeadBody}>
          <Text style={styles.axisLabel}>{axis.label}</Text>
          <Text style={styles.axisSummary}>{axis.summary}</Text>
        </View>
        <MaterialIcons
          color="#8b95a1"
          name={isOpen ? 'expand-less' : 'expand-more'}
          size={22}
        />
      </Pressable>

      {isOpen ? (
        <View style={styles.cardBody}>
          {axis.sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.paragraphs.map((paragraph) => (
                <Text key={paragraph} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}

          {/* 병존에서 방향이 엇갈리는 축(칼륨)의 경고. 본문보다 눈에 띄어야 한다 —
              서로 반대인 안내를 각각 읽고 혼자 판단하는 것이 가장 위험하다. */}
          {axis.caution !== null ? (
            <View style={styles.cautionBox}>
              <MaterialIcons color="#c2410c" name="warning-amber" size={16} />
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  axisLabel: {
    color: '#191f28',
    fontSize: 17,
    fontWeight: '900',
  },
  axisSummary: {
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardBody: {
    borderTopColor: '#f2f4f6',
    borderTopWidth: 1,
    gap: 18,
    padding: 18,
  },
  cardHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 18,
  },
  cardHeadBody: {
    flex: 1,
    gap: 4,
  },
  cautionBox: {
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  cautionText: {
    color: '#9a3412',
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  container: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 720,
    width: '100%',
  },
  header: {
    gap: 8,
  },
  intro: {
    color: '#4e5968',
    fontSize: 15,
    lineHeight: 23,
  },
  notice: {
    color: '#8b95a1',
    fontSize: 12,
    lineHeight: 18,
  },
  paragraph: {
    color: '#333d4b',
    fontSize: 15,
    lineHeight: 24,
  },
  pressed: {
    opacity: 0.74,
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: '#3182f6',
    fontSize: 14,
    fontWeight: '900',
  },
  sourceItem: {
    color: '#8b95a1',
    fontSize: 12,
    lineHeight: 18,
  },
  sources: {
    backgroundColor: '#f7f8fa',
    borderRadius: 8,
    gap: 4,
    padding: 12,
  },
  sourcesTitle: {
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
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
  title: {
    color: '#191f28',
    fontSize: 26,
    fontWeight: '900',
  },
});
