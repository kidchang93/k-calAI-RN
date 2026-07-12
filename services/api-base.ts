import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 백엔드(kcalAI-model) 포트.
const SERVER_PORT = 8000;

/** Expo 개발 서버(패키저) 호스트에서 개발 머신 LAN IP를 꺼낸다(실기기/시뮬레이터 dev용). */
function devServerHost(): string | undefined {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost;
  const host = hostUri ? hostUri.split(':')[0] : undefined;
  return host && host !== 'localhost' && host !== '127.0.0.1' ? host : undefined;
}

/**
 * 백엔드 오리진을 결정한다. **빈 문자열('')이면 상대경로(같은 오리진)**를 뜻한다.
 *
 * 우선순위:
 * 1) `EXPO_PUBLIC_API_ORIGIN` — 명시 지정. 네이티브 프로덕션 빌드가 원격 서버를 볼 때 이 한 줄이면 된다.
 * 2) 웹: 프로덕션 빌드는 FastAPI가 **같은 오리진**에서 서빙하므로 `''`(상대경로). dev(`expo start --web`)는 `:8000` 별도 포트.
 * 3) 네이티브: Expo dev 서버 호스트의 LAN IP(실기기/시뮬레이터 dev), 없으면 로컬 폴백.
 */
function resolveOrigin(): string {
  const override = process.env.EXPO_PUBLIC_API_ORIGIN?.trim();
  if (override) return override.replace(/\/+$/, '');

  if (Platform.OS === 'web') {
    // 웹 프로덕션(FastAPI가 webapp/ 서빙): 상대경로 → 어느 도메인이든 같은 오리진 API로.
    return __DEV__ ? `http://127.0.0.1:${SERVER_PORT}` : '';
  }

  const host = devServerHost();
  if (host) return `http://${host}:${SERVER_PORT}`;
  return Platform.OS === 'android'
    ? `http://10.0.2.2:${SERVER_PORT}`
    : `http://127.0.0.1:${SERVER_PORT}`;
}

/** 백엔드 오리진. `''`이면 상대경로(웹 프로덕션 = FastAPI 동일 오리진). */
export const API_ORIGIN = resolveOrigin();

/**
 * 리소스 base URL을 만든다. `override`(개별 `EXPO_PUBLIC_*_API_URL`)가 있으면 그것을 우선한다.
 * 예: `apiUrl('/api/auth', process.env.EXPO_PUBLIC_AUTH_API_URL)`.
 * `API_ORIGIN`이 `''`이면 `/api/auth` 같은 상대경로가 된다.
 */
export function apiUrl(path: string, override?: string): string {
  return override ?? `${API_ORIGIN}${path}`;
}
