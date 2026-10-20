import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { CitationLinks } from '@/components/citation-links';
import { ErrorBanner } from '@/components/error-banner';
import { LoadingState } from '@/components/loading-state';
import { MedicalDisclaimer } from '@/components/medical-disclaimer';
import { Screen } from '@/components/screen';
import { SessionLoading } from '@/components/session-loading';
import { MFDS_DB_CITATION, MIFFLIN_CITATION } from '@/constants/citations';
import { useAuthSession } from '@/services/auth-session';
import { type CitationLink, fetchCitations } from '@/services/citations';

const APP_CITATIONS = [MIFFLIN_CITATION, MFDS_DB_CITATION];

// 근거와 출처 (2026-10-20 App Store 1.4.1 반려 — 출처를 사용자가 쉽게 찾을 수 있게). 내 정보에서 진입.
// 서버가 쓰는 문헌(GET /api/citations, Bearer)과 앱이 직접 쓰는 계산식·데이터를 한곳에 모은다.
// Bearer 가 필요한 단일 루트 라우트라 이용권 화면(app/plan.tsx)처럼 화면 자신이 가드를 건다.
export default function SourcesScreen() {
  const authState = useAuthSession();
  const isAuthenticated = authState.status === 'authenticated';
  const [citations, setCitations] = useState<CitationLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsLoading(true);
    setHasError(false);

    try {
      setCitations(await fetchCitations());
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  if (authState.status === 'loading') {
    return <SessionLoading />;
  }

  if (authState.status === 'unauthenticated') {
    return <Redirect href="/auth" />;
  }

  return (
    <Screen gap={16} contentStyle={styles.content}>
      <BackButton />

      <View style={styles.header}>
        <Text style={styles.title}>근거와 출처</Text>
        <Text style={styles.subtitle}>
          케어테이블이 보여 주는 기준·계산은 아래 자료에서 왔어요. 수치 옆의 &apos;출처&apos;를 눌러도
          원문을 볼 수 있어요.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>학회 지침·공공 자료</Text>
        {isLoading ? (
          <LoadingState label="출처를 불러오는 중입니다." />
        ) : hasError ? (
          <ErrorBanner
            message="목록을 불러오지 못했어요. 아래 계산식·데이터 출처는 그대로 볼 수 있어요."
            onRetry={() => void load()}
          />
        ) : (
          <CitationLinks citations={citations} />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>계산식·데이터</Text>
        <CitationLinks citations={APP_CITATIONS} />
      </View>

      <MedicalDisclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 12,
    padding: 18,
  },
  cardTitle: {
    color: '#22211f',
    fontSize: 18,
    fontWeight: '900',
  },
  content: {
    paddingBottom: 36,
  },
  header: {
    gap: 4,
  },
  subtitle: {
    color: '#5c5b57',
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    color: '#22211f',
    fontSize: 30,
    fontWeight: '900',
  },
});
