import { Platform } from 'react-native';

// 토스페이먼츠 결제창 SDK 어댑터 — **웹 전용**.
//
// SDK를 npm으로 설치하지 않는다. 브라우저 전용(window·document 의존)이라 번들에 들어가면
// 네이티브가 DOM 없는 런타임에서 이 모듈을 평가한다. 웹에서만 script 태그로 동적 로드한다.
//
// 앱이 만지는 키는 checkout 응답의 client_key(공개값)뿐이다. 시크릿 키·빌링키는 서버 밖으로
// 나오지 않는다 (kcalAI-model DATA_MODEL.md 24장). client_key도 EXPO_PUBLIC_*로 굳히지 않는다 —
// 요금제·판매 상태에 따라 서버가 정하는 값이고, 번들에 박으면 키 교체에 앱 배포가 필요해진다.

const TOSS_SDK_URL = 'https://js.tosspayments.com/v2/standard';

const NOT_WEB_MESSAGE = '결제는 웹에서 진행해주세요.';
const LOAD_FAIL_MESSAGE = '결제 모듈을 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해주세요.';

// SDK 표면 중 우리가 실제로 쓰는 부분만 좁게 선언한다 (any 금지).
type TossPayment = {
  requestBillingAuth: (options: {
    method: 'CARD';
    successUrl: string;
    failUrl: string;
  }) => Promise<void>;
};

type TossPaymentsInstance = {
  payment: (options: { customerKey: string }) => TossPayment;
};

type TossPaymentsFactory = (clientKey: string) => TossPaymentsInstance;

type TossWindow = Window & { TossPayments?: TossPaymentsFactory };

// 스크립트를 두 번 넣지 않도록 프라미스를 캐시한다 (요금제 화면을 여러 번 드나들어도 1회 로드).
let sdkPromise: Promise<TossPaymentsFactory> | null = null;

// 화면이 결제 버튼을 그릴지, '웹에서 진행해주세요' 안내를 그릴지 판단하는 기준.
export function isBillingSupported(): boolean {
  return Platform.OS === 'web';
}

export async function loadTossSdk(): Promise<TossPaymentsFactory> {
  if (!isBillingSupported()) {
    throw new Error(NOT_WEB_MESSAGE);
  }

  if (sdkPromise === null) {
    sdkPromise = injectSdkScript().catch((error: unknown) => {
      // 실패한 프라미스를 캐시에 남기면 새로고침 전까지 재시도가 영원히 같은 실패를 돌려준다.
      sdkPromise = null;
      throw error;
    });
  }

  return sdkPromise;
}

// 결제창이 돌아올 절대 URL을 만든다. window 접근을 services 안에 가둔다 — 화면은 DOM을 모른다.
export function billingReturnUrl(path: string): string {
  if (!isBillingSupported() || typeof window === 'undefined') {
    throw new Error(NOT_WEB_MESSAGE);
  }

  return `${window.location.origin}${path}`;
}

// 카드 등록(빌링 인증) 결제창을 띄운다.
//
// 정상 흐름에서 이 함수는 **resolve하지 않는다** — 브라우저가 successUrl/failUrl로 통째로
// 이동해 버리기 때문이다. 그래서 호출부는 반환 뒤에 후처리를 붙이지 않는다.
// 성공 → successUrl?authKey=…&customerKey=…  /  실패·취소 → failUrl?code=…&message=…
export async function requestBillingAuth(options: {
  clientKey: string;
  customerKey: string;
  successUrl: string;
  failUrl: string;
}): Promise<void> {
  const tossPayments = await loadTossSdk();
  const payment = tossPayments(options.clientKey).payment({ customerKey: options.customerKey });

  await payment.requestBillingAuth({
    method: 'CARD',
    successUrl: options.successUrl,
    failUrl: options.failUrl,
  });
}

// ── 내부 헬퍼 (export 안 함) ────────────────────────────────────────────────

function injectSdkScript(): Promise<TossPaymentsFactory> {
  // 웹 정적 렌더링(document 없음)을 방어한다.
  if (typeof document === 'undefined') {
    return Promise.reject(new Error(NOT_WEB_MESSAGE));
  }

  return new Promise((resolve, reject) => {
    const loaded = readTossPayments();

    // 이미 전역에 올라와 있으면(뒤로가기 복귀 등) 다시 넣지 않는다.
    if (loaded !== null) {
      resolve(loaded);
      return;
    }

    const script = document.createElement('script');

    script.src = TOSS_SDK_URL;
    script.async = true;
    script.onload = () => {
      const factory = readTossPayments();

      if (factory === null) {
        reject(new Error(LOAD_FAIL_MESSAGE));
        return;
      }

      resolve(factory);
    };
    script.onerror = () => reject(new Error(LOAD_FAIL_MESSAGE));

    document.head.appendChild(script);
  });
}

// 전역 TossPayments는 외부 스크립트가 넣는 값이라 신뢰하지 않는다 — 함수일 때만 받는다.
function readTossPayments(): TossPaymentsFactory | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const factory = (window as TossWindow).TossPayments;

  return typeof factory === 'function' ? factory : null;
}
