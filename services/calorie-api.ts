import { Platform } from 'react-native';

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

export const CALORIE_API_URL = process.env.EXPO_PUBLIC_CALORIE_API_URL ?? DEFAULT_API_URL;

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

  const response = await fetch(CALORIE_API_URL, {
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

async function readErrorMessage(response: Response) {
  const text = await response.text().catch(() => '');

  if (!text) {
    return '';
  }

  try {
    const data = JSON.parse(text) as { detail?: unknown };

    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item) => {
          if (typeof item === 'object' && item !== null && 'msg' in item) {
            return String(item.msg);
          }

          return String(item);
        })
        .join('\n');
    }

    if (data.detail) {
      return String(data.detail);
    }
  } catch {
    return text;
  }

  return text;
}
