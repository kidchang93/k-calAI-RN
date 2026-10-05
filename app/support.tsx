import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { Screen } from '@/components/screen';
import { BUSINESS_EMAIL, BUSINESS_INFO_LINES } from '@/constants/legal';

// 고객 지원 (2026-10-05). App Store Connect 의 '지원 URL'(https://api.kcalai.link/support)이 가리키는
// 화면이라 **로그인 없이** 열려야 한다 — 인증 가드가 없는 루트 라우트에 둔다(app/legal 과 같은 이유).
// 심사관이 보는 것은 실제 연락처와, 계정 삭제·동의 철회를 어디서 하는지다.
const FAQ: { question: string; answer: string }[] = [
  {
    question: '회원 탈퇴는 어디서 하나요?',
    answer:
      '앱의 내 정보 › 회원 탈퇴에서 바로 할 수 있어요. 모든 기록이 즉시 지워지고 되돌릴 수 없어요. Apple로 가입했다면 Apple 로그인 연결도 함께 끊어요.',
  },
  {
    question: '건강 정보 동의나 사진 AI 분석 동의를 거두고 싶어요.',
    answer: '내 정보 › 동의 관리에서 언제든 거둘 수 있어요.',
  },
  {
    question: '사진은 어디로 가나요?',
    answer:
      '사진 속 음식을 알아보려고 Google의 생성형 AI(Gemini)로 보내요. 촬영 위치 같은 부가 정보는 지우고 보내며, 사진은 저장하지 않아요.',
  },
  {
    question: '의료 상담을 해 주나요?',
    answer:
      '아니요. 케어테이블은 식단을 기록해 진료 때 보여 드리는 도구예요. 진단이나 치료를 하지 않아요. 치료·복약·식이 조절은 담당 의료진과 상의해 주세요.',
  },
];

export default function SupportScreen() {
  const router = useRouter();

  return (
    <Screen gap={16} contentStyle={styles.content}>
      <BackButton />

      <View style={styles.header}>
        <Text style={styles.title}>고객 지원</Text>
        <Text style={styles.subtitle}>궁금한 점이나 불편한 점을 알려 주세요.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>문의</Text>
        <Text selectable style={styles.email}>
          {BUSINESS_EMAIL}
        </Text>
        <Text style={styles.bodyText}>메일로 보내 주시면 답장드려요.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>자주 묻는 것</Text>
        {FAQ.map((item) => (
          <View key={item.question} style={styles.faqItem}>
            <Text style={styles.question}>{item.question}</Text>
            <Text style={styles.bodyText}>{item.answer}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/legal/terms')}
          style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
          <Text style={styles.linkText}>서비스 이용약관</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/legal/privacy')}
          style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
          <Text style={styles.linkText}>개인정보 처리방침</Text>
        </Pressable>
      </View>

      <View style={styles.businessBox}>
        {BUSINESS_INFO_LINES.map((line) => (
          <Text key={line} selectable style={styles.businessText}>
            {line}
          </Text>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    color: '#5c5b57',
    fontSize: 15,
    lineHeight: 22,
  },
  businessBox: {
    gap: 2,
    paddingHorizontal: 4,
  },
  businessText: {
    color: '#5c5b57',
    fontSize: 13,
    lineHeight: 19,
  },
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
  email: {
    color: '#2a7d76',
    fontSize: 18,
    fontWeight: '800',
  },
  faqItem: {
    gap: 4,
  },
  header: {
    gap: 4,
  },
  linkRow: {
    justifyContent: 'center',
    minHeight: 44,
  },
  linkText: {
    color: '#2a7d76',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
  question: {
    color: '#22211f',
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    color: '#5c5b57',
    fontSize: 15,
  },
  title: {
    color: '#22211f',
    fontSize: 28,
    fontWeight: '900',
  },
});
