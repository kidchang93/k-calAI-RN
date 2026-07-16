import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { notifyDialog } from '@/services/dialog';
import { formatDateParam } from '@/services/health-api';

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

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      notifyDialog('카메라 권한 필요', '음식 사진을 촬영하려면 카메라 권한을 허용해주세요.');

      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.86,
    });

    if (!result.canceled) {
      openCompose(photoParams(result.assets[0]));
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      notifyDialog('사진 권한 필요', '앨범에서 음식 사진을 선택하려면 사진 접근 권한을 허용해주세요.');

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.86,
    });

    if (!result.canceled) {
      openCompose(photoParams(result.assets[0]));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>K-Cal AI</Text>
            <Text style={styles.title}>사진 한 장으로{'\n'}식단을 기록해요</Text>
          </View>
          <View style={styles.logoMark}>
            <MaterialIcons color="#ffffff" name="restaurant" size={28} />
          </View>
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introTitle}>한 끼에 여러 메뉴도 담을 수 있어요</Text>
          <Text style={styles.introText}>
            사진을 고른 뒤 분석을 누르면 음식을 인식해 담아드려요. 검색이나 직접 입력으로 메뉴를
            더 추가할 수도 있어요.
          </Text>
        </View>

        <View style={styles.actionGrid}>
          <ActionButton icon="photo-camera" label="촬영" onPress={() => void pickFromCamera()} />
          <ActionButton icon="photo-library" label="앨범" onPress={() => void pickFromLibrary()} />
        </View>

        <Pressable
          onPress={() => openCompose({})}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <MaterialIcons color="#3182f6" name="edit-note" size={20} />
          <Text style={styles.secondaryButtonText}>검색·직접 입력으로 추가</Text>
        </Pressable>

        <Text style={styles.disclaimer}>AI 추정값이며 실제와 다를 수 있습니다.</Text>
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
        <MaterialIcons color="#3182f6" name={icon} size={24} />
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
    backgroundColor: '#edf6ff',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  actionLabel: {
    color: '#333d4b',
    fontSize: 16,
    fontWeight: '800',
  },
  container: {
    gap: 18,
    padding: 20,
    paddingBottom: 36,
  },
  disclaimer: {
    color: '#8b95a1',
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
    color: '#6b7684',
    fontSize: 14,
    lineHeight: 20,
  },
  introTitle: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
  kicker: {
    color: '#3182f6',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: '#3182f6',
    borderRadius: 20,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  pressed: {
    opacity: 0.74,
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#edf6ff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 54,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#3182f6',
    fontSize: 16,
    fontWeight: '800',
  },
  title: {
    color: '#191f28',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 39,
  },
});
