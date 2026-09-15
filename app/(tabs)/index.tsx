import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AI_USE_NOTICE } from '@/constants/ai-notice';
import { formatDateParam } from '@/services/health-api';
import { pickPhoto } from '@/services/photo-picker';
import { readPhotoTakenAt } from '@/services/photo-time';

// 기록 탭은 '오늘 기록 만들기'의 진입점이다. 실제 다중 항목 구성·저장은 끼니 구성 화면
// (app/meals/compose.tsx)이 한 곳에서 담당한다 — 과거 날짜·기존 끼니 추가와 같은 로직을 공유한다.
export default function RecordScreen() {
  const router = useRouter();

  const openCompose = (params: Record<string, string>) => {
    router.push({
      pathname: '/meals/compose',
      params: { date: formatDateParam(new Date()), ...params },
    });
  };

  // 촬영 시각은 **앨범일 때만** 읽는다 — 카메라로 방금 찍은 사진은 현재 시각과 같아 의미가 없고,
  // 구성 화면에는 URI만 넘어가 웹에서는 원본 파일을 다시 못 읽는다.
  const pickAndCompose = async (source: 'camera' | 'library') => {
    const asset = await pickPhoto(source);

    if (asset === null) {
      return;
    }

    const params = photoParams(asset);
    const takenAt = source === 'library' ? await readPhotoTakenAt(asset) : null;

    if (takenAt !== null) {
      params.photoTakenAt = takenAt.toISOString();
    }

    openCompose(params);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>CARE TABLE</Text>
            <Text style={styles.title}>사진 한 장으로{'\n'}식단을 기록해요</Text>
          </View>
          <Image
            accessibilityIgnoresInvertColors
            source={require('@/assets/images/meal_care_logo.png')}
            style={styles.logoMark}
          />
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introTitle}>한 끼에 여러 메뉴도 담을 수 있어요</Text>
          <Text style={styles.introText}>
            사진을 고른 뒤 분석을 누르면 생성형 AI(Google Gemini)가 음식을 인식해 담아드려요.
            검색이나 직접 입력으로 메뉴를 더 추가할 수도 있어요.
          </Text>
        </View>

        <View style={styles.actionGrid}>
          <ActionButton icon="photo-camera" label="촬영" onPress={() => void pickAndCompose('camera')} />
          <ActionButton icon="photo-library" label="앨범" onPress={() => void pickAndCompose('library')} />
        </View>

        <Pressable
          onPress={() => openCompose({})}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <MaterialIcons color="#2a7d76" name="edit-note" size={20} />
          <Text style={styles.secondaryButtonText}>검색·직접 입력으로 추가</Text>
        </Pressable>

        {/* AI기본법 제31조① 사전고지 — 사진 기록을 시작하기 전 화면이다 (constants/ai-notice.ts). */}
        <Text style={styles.disclaimer}>{AI_USE_NOTICE}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function photoParams(asset: ImagePicker.ImagePickerAsset): Record<string, string> {
  const params: Record<string, string> = { photoUri: asset.uri };

  if (asset.fileName) {
    params.photoName = asset.fileName;
  }

  if (asset.mimeType) {
    params.photoMime = asset.mimeType;
  }

  return params;
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
      <View style={styles.actionIcon}>
        <MaterialIcons color="#2a7d76" name={icon} size={24} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: '#bee2dd',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  actionLabel: {
    color: '#22211f',
    fontSize: 16,
    fontWeight: '800',
  },
  container: {
    gap: 18,
    padding: 20,
    paddingBottom: 36,
  },
  disclaimer: {
    color: '#a9a6a1',
    fontSize: 13,
    textAlign: 'center',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 18,
  },
  introCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    gap: 8,
    padding: 22,
  },
  introText: {
    color: '#5c5b57',
    fontSize: 14,
    lineHeight: 20,
  },
  introTitle: {
    color: '#22211f',
    fontSize: 18,
    fontWeight: '900',
  },
  kicker: {
    color: '#2a7d76',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  logoMark: {
    height: 56,
    resizeMode: 'contain',
    width: 56,
  },
  pressed: {
    opacity: 0.74,
  },
  safeArea: {
    backgroundColor: '#f7f6f4',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#bee2dd',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 54,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#2a7d76',
    fontSize: 16,
    fontWeight: '800',
  },
  title: {
    color: '#22211f',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 39,
  },
});
