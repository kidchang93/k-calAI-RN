import { Platform } from 'react-native';

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

const DEFAULT_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/predict' : 'http://127.0.0.1:8000/api/predict';
const DEFAULT_CALORIE_DETAIL_API_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api/gpt-predict'
    : 'http://127.0.0.1:8000/api/gpt-predict';

export const CALORIE_API_URL = process.env.EXPO_PUBLIC_CALORIE_API_URL ?? DEFAULT_API_URL;
export const CALORIE_DETAIL_API_URL =
  process.env.EXPO_PUBLIC_CALORIE_DETAIL_API_URL ?? DEFAULT_CALORIE_DETAIL_API_URL;

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

export async function requestCalorieDetail(foodName: string): Promise<string> {
  const response = await apiFetch(CALORIE_DETAIL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: `${foodName} 1인분의 예상 칼로리를 계산해줘. 총 칼로리, 주요 영양성분, 섭취 시 참고할 점을 한국어로 짧고 명확하게 알려줘.`,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `칼로리 계산 실패: ${response.status}`);
  }

  const data = (await response.json()) as { response_text?: unknown };

  if (typeof data.response_text !== 'string') {
    throw new Error('서버 응답에 response_text 값이 없습니다.');
  }

  return data.response_text.trim();
}
