import { Platform, Share } from 'react-native';

/**
 * 크로스 플랫폼 텍스트 공유.
 *
 * **react-native-web 의 `Share.share` 는 웹에서 공유 시트를 띄우지 못한다.** 그래서 웹에서
 * 초대 링크 공유 버튼을 눌러도 조용히 아무 일도 일어나지 않았다 (`dialog.ts` 의 `Alert.alert`
 * 와 같은 문제). 웹은 Web Share API → 클립보드 순으로 내려간다.
 *
 * 어느 경로로 공유됐는지 화면이 알아야 안내 문구를 고를 수 있어서 결과를 돌려준다.
 */

export type ShareOutcome = 'shared' | 'copied' | 'unavailable';

export async function shareText(message: string): Promise<ShareOutcome> {
  if (Platform.OS !== 'web') {
    try {
      await Share.share({ message });
    } catch {
      // 공유 시트 취소는 오류가 아니다.
    }

    return 'shared';
  }

  return shareOnWeb(message);
}

async function shareOnWeb(message: string): Promise<ShareOutcome> {
  if (typeof navigator === 'undefined') {
    return 'unavailable';
  }

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: message });

      return 'shared';
    } catch (error) {
      // 사용자가 공유 시트를 닫은 것(AbortError)은 실패가 아니다 — 여기서 클립보드로 내려가면
      // 공유를 취소한 사람에게 "복사했어요"가 뜬다. 그 외(미지원·거부)만 클립보드로 내려간다.
      if (error instanceof Error && error.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  try {
    await navigator.clipboard?.writeText(message);

    return 'copied';
  } catch {
    return 'unavailable';
  }
}
