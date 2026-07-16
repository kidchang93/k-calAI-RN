import { Platform } from 'react-native';

import { apiUrl } from '@/services/api-base';
import { apiFetch, readErrorMessage } from '@/services/http';

// 사진 1장에서 인식된 **서로 다른 음식** 한 건 (한 음식의 후보 나열이 아니다 — 서버 22장).
// portion_g는 서버가 추정한 대략적 섭취량 힌트로, 없을 수 있어 null로 좁혀 받는다.
export type FoodDetection = {
  label: string;
  score: number;
  portion_g: number | null;
};

export type PhotoAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

// 서버가 이번 호출까지 반영한 오늘 사용량을 함께 준다 — 화면이 별도 조회 없이 "오늘 2/5건"을 띄운다.
// 쿼터는 사진당 1건이다(음식 개수 무관). 값이 없는 응답(구버전 서버)도 기록 흐름을 막지 않도록
// null로 좁혀 받는다.
export type PredictResult = {
  foods: FoodDetection[];
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
    foods?: unknown;
    predictions?: unknown;
    vision_used?: unknown;
    vision_limit?: unknown;
  };

  // 신규 계약은 foods. 배포 전환기(구버전 서버가 predictions만 줄 때)에도 기록이 막히지
  // 않도록 predictions를 foods로 받아들인다 (서버 응답을 신뢰하지 않는다 — DESIGN 원칙 3).
  const rawFoods = Array.isArray(data.foods)
    ? data.foods
    : Array.isArray(data.predictions)
      ? data.predictions
      : null;

  if (rawFoods === null) {
    throw new Error('서버 응답에 foods 배열이 없습니다.');
  }

  return {
    foods: rawFoods.map(toFood).filter((food) => food.label.length > 0),
    vision_used: toCount(data.vision_used),
    vision_limit: toCount(data.vision_limit),
  };
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toFood(value: unknown): FoodDetection {
  if (!isRecord(value)) {
    return { label: '', score: 0, portion_g: null };
  }

  return {
    label: typeof value.label === 'string' ? value.label : '',
    score: toScore(value.score),
    portion_g: toCount(value.portion_g),
  };
}

function toScore(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

// 0 이상의 유한수만 사용량·섭취량으로 인정한다. 그 외(누락·문자열·음수)는 null.
function toCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
