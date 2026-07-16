import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { LegalDocument } from '@/constants/legal';

// 약관·처리방침 공용 렌더러. 두 문서가 같은 구조(제목 + 문단 배열)라 화면을 나눌 이유가 없다.
// 마크다운 파서를 쓰지 않는다 — 문단 배열이라 Text 로 그대로 그린다(의존성 0).

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>{document.title}</Text>
            <Text style={styles.meta}>
              {`버전 ${document.version} · 시행일 ${document.effectiveDate}`}
            </Text>
          </View>

          {/* 초안 경고는 문서 맨 위에 둔다 — 읽는 사람이 가장 먼저 알아야 한다. */}
          {document.draftNotice === null ? null : (
            <View style={styles.draftBox}>
              <MaterialIcons color="#e5484d" name="info-outline" size={16} />
              <Text style={styles.draftText}>{document.draftNotice}</Text>
            </View>
          )}

          {document.sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.paragraphs.map((paragraph, index) => (
                <Text key={index} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
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
  draftBox: {
    alignItems: 'flex-start',
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 14,
  },
  draftText: {
    color: '#4e5968',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  header: {
    gap: 4,
  },
  meta: {
    color: '#8b95a1',
    fontSize: 13,
  },
  paragraph: {
    color: '#4e5968',
    fontSize: 14,
    lineHeight: 22,
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 10,
    padding: 18,
  },
  sectionTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  title: {
    color: '#191f28',
    fontSize: 28,
    fontWeight: '900',
  },
});
