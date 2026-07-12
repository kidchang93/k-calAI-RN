import { Platform } from 'react-native';

import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

export type Prediction = {
  label: string;
  score: number;
};

export type PhotoAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export const CALORIE_API_URL = apiUrl('/api/predict', process.env.EXPO_PUBLIC_CALORIE_API_URL);

export async function uploadFoodPhoto(asset: PhotoAsset): Promise<Prediction[]> {
  const formData = new FormData();
  const fileName = asset.fileName ?? `food-photo-${Date.now()}.jpg`;
  const mimeType = asset.mimeType ?? 'image/jpeg';

  if (Platform.OS === 'web') {
    const photoResponse = await fetch(asset.uri);
    const photoBlob = await photoResponse.blob();
    formData.append('file', photoBlob, fileName);
  } else {
    formData.append('file', {
      uri: asset.uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);
  }

  const response = await apiFetch(CALORIE_API_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `업로드 실패: ${response.status}`);
  }

  const data = (await response.json()) as { predictions?: Prediction[] };

  if (!Array.isArray(data.predictions)) {
    throw new Error('서버 응답에 predictions 배열이 없습니다.');
  }

  return data.predictions.map((prediction) => ({
    label: String(prediction.label),
    score: Number(prediction.score),
  }));
}
