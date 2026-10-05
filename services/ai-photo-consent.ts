import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { getWebStorage } from '@/services/auth-session';

// 사진 AI 분석 동의(App Store 5.1.2(i)) — 문구는 constants/consent.ts 의 AI_PHOTO_CONSENT_*.
// 사진을 보내기 직전(기록 화면의 '분석')에 묻고, 동의 관리에서 거둔다.
// ponytail: 기기에만 남긴다 — 새 기기에서는 다시 묻는다. 서버 동의 기록이 필요해지면(법적 근거가
// 동의로 바뀌는 경우) consent_service 의 동의 종류로 옮긴다. 지금 국외 이전 근거는 처리위탁 공개다.
const KEY = 'ai_photo_consent';

export async function readAiPhotoConsent(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return getWebStorage()?.getItem(KEY) === 'yes';
  }

  try {
    return (await SecureStore.getItemAsync(KEY)) === 'yes';
  } catch {
    return false;
  }
}

export async function saveAiPhotoConsent(agreed: boolean): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = getWebStorage();

    if (agreed) {
      storage?.setItem(KEY, 'yes');
    } else {
      storage?.removeItem(KEY);
    }

    return;
  }

  if (agreed) {
    await SecureStore.setItemAsync(KEY, 'yes');
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}
