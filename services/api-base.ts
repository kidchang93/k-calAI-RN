import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 백엔드(kcalAI-model) 포트.
const SERVER_PORT = 8000;

/**
 * 백엔드에 닿을 호스트를 결정한다.
 *
 * 실기기(Expo Go)에서 `127.0.0.1`은 폰 자신을 가리켜 백엔드에 닿지 못한다. 그래서 Expo
 * 개발 서버(패키저)의 호스트 = **개발 머신의 LAN IP**를 꺼내 쓴다 — 폰이 QR로 붙는 바로 그 IP다.
 * 시뮬레이터/에뮬레이터나 호스트를 못 구하는 경우엔 플랫폼별 로컬 폴백을 쓴다.
 * (`--tunnel` 모드는 hostUri가 IP가 아니라 폴백으로 빠지므로, 실기기는 같은 Wi-Fi + LAN 모드를 쓴다.)
 */
function resolveHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // 구버전/Expo Go 호환 경로
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost;
  const host = hostUri ? hostUri.split(':')[0] : undefined;

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return host; // 개발 머신 LAN IP (실기기가 도달 가능)
  }

  // 시뮬레이터/에뮬레이터 폴백: Android 에뮬레이터는 10.0.2.2가 호스트를 가리킨다.
  return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
}

/** 백엔드 오리진 (예: `http://192.168.0.12:8000`). */
export const API_ORIGIN = `http://${resolveHost()}:${SERVER_PORT}`;

/**
 * 리소스 base URL을 만든다. `override`(EXPO_PUBLIC_* 환경변수)가 있으면 그것을 우선한다.
 * 예: `apiUrl('/api/auth', process.env.EXPO_PUBLIC_AUTH_API_URL)`.
 */
export function apiUrl(path: string, override?: string): string {
  return override ?? `${API_ORIGIN}${path}`;
}
