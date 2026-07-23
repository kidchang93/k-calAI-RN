import { Platform } from 'react-native';

// 그룹 초대 링크. 받는 사람이 8자 코드를 손으로 옮겨 적지 않도록 링크에 코드를 실어 보낸다.
// 목적지는 인증 가드 밖의 `/invite` 라우트다 — 미가입자가 링크를 열어도 로그인으로 튕기면서
// 코드가 유실되지 않아야 하기 때문이다 (app/invite.tsx).
//
// FastAPI 가 API(/api/*)와 웹앱(/)을 같은 오리진에서 서빙하므로, 링크를 연 사람은 앱 설치
// 없이 브라우저에서 바로 참여 화면에 닿는다.

const DEFAULT_WEB_ORIGIN = 'https://api.kcalai.link';

const PENDING_INVITE_KEY = 'pending-group-invite';

// 서버 생성 8자(대문자·숫자, 혼동 문자 I/L/O/0/1 제외 — 서버 group_service.INVITE_CODE_ALPHABET).
// 알파벳 구성이 바뀌어도 링크가 막히지 않도록 길이·문자 종류만 본다.
const INVITE_CODE_PATTERN = /^[A-Z0-9]{8}$/;

// 로그인 전에 열린 초대 링크의 코드. 로그인·온보딩을 마치고 홈에 도달하면 소비된다.
let pendingInviteCode: string | null = null;

export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase();
}

// 링크의 `?code=` 를 읽는다. expo-router 는 같은 파라미터가 두 번 오면(`?code=A&code=B`)
// 타입과 달리 배열을 주므로, 조작된 링크에 화면이 죽지 않도록 첫 값만 취한다.
export function readInviteCodeParam(value: string | string[] | undefined): string {
  return normalizeInviteCode((Array.isArray(value) ? value[0] : value) ?? '');
}

export function isInviteCode(value: string): boolean {
  return INVITE_CODE_PATTERN.test(value);
}

export function buildInviteUrl(inviteCode: string): string {
  return `${inviteOrigin()}/invite?code=${normalizeInviteCode(inviteCode)}`;
}

export function buildInviteMessage(groupName: string, inviteCode: string): string {
  const code = normalizeInviteCode(inviteCode);

  return [
    `'${groupName}' 그룹에 초대합니다.`,
    '아래 링크를 열면 바로 참여할 수 있어요.',
    buildInviteUrl(code),
    `초대코드: ${code}`,
  ].join('\n');
}

export function rememberPendingInvite(inviteCode: string): void {
  const code = normalizeInviteCode(inviteCode);

  if (!isInviteCode(code)) {
    return;
  }

  pendingInviteCode = code;
  getWebStorage()?.setItem(PENDING_INVITE_KEY, code);
}

// 읽으면서 지운다 — 한 번 참여 화면으로 보낸 코드가 홈에 올 때마다 다시 끼어들면 안 된다.
export function consumePendingInvite(): string | null {
  const stored = getWebStorage()?.getItem(PENDING_INVITE_KEY) ?? null;
  const code = pendingInviteCode ?? stored;

  pendingInviteCode = null;
  getWebStorage()?.removeItem(PENDING_INVITE_KEY);

  return code !== null && isInviteCode(code) ? code : null;
}

// 웹은 카카오 로그인이 페이지를 오갈 수 있어 localStorage 에도 남긴다(세션 영속화와 같은 이유).
// 네이티브는 유니버설 링크가 없어 미로그인 딥링크 자체가 생기지 않으므로 메모리로 충분하다.
function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function inviteOrigin(): string {
  const override = process.env.EXPO_PUBLIC_PUBLIC_WEB_ORIGIN?.trim();

  if (override) {
    return override.replace(/\/+$/, '');
  }

  // 웹은 지금 접속한 도메인을 그대로 쓴다 — 도메인이 늘어도 공유 링크가 따라온다.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }

  return DEFAULT_WEB_ORIGIN;
}
