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

// 서버가 이번 호출까지 반영한 오늘 사용량을 함께 준다 — 화면이 별도 조회 없이 "오늘 2/3건"을 띄운다.
// 값이 없는 응답(구버전 서버)도 기록 흐름을 막지 않도록 null로 좁혀 받는다.
export type PredictResult = {
  predictions: Prediction[];
  vision_used: number | null;
  vision_limit: number | null;
};

export const CALORIE_API_URL = apiUrl('/api/predict', process.env.EXPO_PUBLIC_CALORIE_API_URL);

// 한도를 넘으면 apiFetch가 402를 PlanLimitError로 바꿔 던진다 (services/http.ts).
export async function uploadFoodPhoto(asset: PhotoAsset): Promise<PredictResult> {
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

  const data = (await response.json()) as {
    predictions?: Prediction[];
    vision_used?: unknown;
    vision_limit?: unknown;
  };

  if (!Array.isArray(data.predictions)) {
    throw new Error('서버 응답에 predictions 배열이 없습니다.');
  }

  return {
    predictions: data.predictions.map((prediction) => ({
      label: String(prediction.label),
      score: Number(prediction.score),
    })),
    vision_used: toCount(data.vision_used),
    vision_limit: toCount(data.vision_limit),
  };
}

// 0 이상의 유한수만 사용량으로 인정한다. 그 외(누락·문자열·음수)는 null → 화면이 표시를 생략한다.
function toCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
