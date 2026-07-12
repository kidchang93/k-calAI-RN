import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CALORIE_API_URL, CALORIE_DETAIL_API_URL } from '@/services/calorie-api';

export default function TabTwoScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>분석 상태</Text>
          <Text style={styles.description}>
            Flutter 원본의 촬영, 업로드, 예측 결과 표시 흐름을 React Native로 옮긴 화면입니다.
          </Text>
        </View>

        <StatusItem
          icon="camera-alt"
          title="사진 입력"
          description="카메라 촬영과 앨범 선택을 모두 지원합니다."
        />
        <StatusItem
          icon="cloud-upload"
          title="서버 전송"
          description="multipart/form-data의 file 필드로 이미지를 업로드합니다."
        />
        <StatusItem
          icon="analytics"
          title="예측 결과"
          description="서버의 predictions 배열을 신뢰도 순으로 보여줍니다."
        />
        <StatusItem
          icon="calculate"
          title="칼로리 계산"
          description="선택한 음식명을 gpt-predict API로 보내 예상 칼로리 설명을 받습니다."
        />

        <View style={styles.serverCard}>
          <Text style={styles.serverLabel}>API endpoint</Text>
          <Text style={styles.serverUrl}>{CALORIE_API_URL}</Text>
          <Text style={styles.serverLabel}>Calorie endpoint</Text>
          <Text style={styles.serverUrl}>{CALORIE_DETAIL_API_URL}</Text>
          <Text style={styles.serverHelp}>
            다른 서버를 사용할 때는 EXPO_PUBLIC_CALORIE_API_URL,
            EXPO_PUBLIC_CALORIE_DETAIL_API_URL 환경변수로 교체하세요.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusItem({
  icon,
  title,
  description,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.statusItem}>
      <View style={styles.statusIcon}>
        <MaterialIcons name={icon} size={24} color="#3182f6" />
      </View>
      <View style={styles.statusTextBox}>
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.statusDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  container: {
    gap: 12,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    gap: 10,
    paddingBottom: 8,
    paddingTop: 18,
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
  },
  description: {
    color: '#6b7684',
    fontSize: 15,
    lineHeight: 22,
  },
  statusItem: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  statusIcon: {
    alignItems: 'center',
    backgroundColor: '#edf6ff',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  statusTextBox: {
    flex: 1,
  },
  statusTitle: {
    color: '#333d4b',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },
  statusDescription: {
    color: '#8b95a1',
    fontSize: 14,
    lineHeight: 20,
  },
  serverCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    marginTop: 6,
    padding: 18,
  },
  serverLabel: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '900',
  },
  serverUrl: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  serverHelp: {
    color: '#8b95a1',
    fontSize: 13,
    lineHeight: 19,
  },
});
