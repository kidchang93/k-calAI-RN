import { Alert, Platform } from 'react-native';

/**
 * 크로스 플랫폼 확인·알림 다이얼로그.
 *
 * **react-native-web의 `Alert.alert`은 아무것도 하지 않는다** (`static alert() {}` — no-op).
 * 그래서 웹에서는 확인 창이 뜨지도 않고 `onPress` 콜백도 불리지 않아, 로그아웃·회원 탈퇴·펫
 * 삭제 같은 동작이 **조용히 실패**했다 (버튼을 눌러도 아무 일도 일어나지 않음).
 *
 * 웹에서는 `window.confirm`/`window.alert`으로 내려가고, 네이티브에서는 기존 `Alert.alert`을
 * 그대로 쓴다. 호출부는 Promise 로 결과를 받으므로 플랫폼 분기를 알 필요가 없다.
 *
 * (JSX 가 없는 플랫폼 shim 이라 `services/`에 둔다 — API 클라이언트는 아니지만 컴포넌트도 아니다.)
 */

const isWeb = Platform.OS === 'web';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export function confirmDialog({
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (isWeb) {
    if (typeof window === 'undefined') {
      return Promise.resolve(false);
    }

    return Promise.resolve(window.confirm(joinText(title, message)));
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      // 바깥을 눌러 닫아도 Promise 가 영원히 매달리지 않게 한다.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function notifyDialog(title: string, message?: string): void {
  if (isWeb) {
    if (typeof window !== 'undefined') {
      window.alert(joinText(title, message));
    }

    return;
  }

  Alert.alert(title, message);
}

function joinText(title: string, message?: string): string {
  return message ? `${title}\n\n${message}` : title;
}
