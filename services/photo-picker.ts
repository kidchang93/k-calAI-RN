import * as ImagePicker from 'expo-image-picker';

import { notifyDialog } from '@/services/dialog';

// 음식 사진 고르기 — 기록 탭(app/(tabs)/index.tsx)과 끼니 구성(app/meals/compose.tsx)이 같은 권한 안내·
// 옵션을 쓴다. 권한이 거부되면 안내를 띄우고 null, 사용자가 취소해도 null.
// 앨범은 exif 를 켠다 — 촬영 시각(services/photo-time.ts)으로 끼니를 정하기 때문이다.
export async function pickPhoto(
  source: 'camera' | 'library'
): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      notifyDialog('카메라 권한 필요', '음식 사진을 촬영하려면 카메라 권한을 허용해주세요.');

      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.86,
    });

    return result.canceled ? null : result.assets[0];
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    notifyDialog('사진 권한 필요', '앨범에서 음식 사진을 선택하려면 사진 접근 권한을 허용해주세요.');

    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.86,
    exif: true,
  });

  return result.canceled ? null : result.assets[0];
}
